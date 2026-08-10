import { applyMutationsWithNotionSync } from './_notionSync.ts';
import type { RevisionMutation } from './_revisionSync.ts';
import type {
    Env,
    Note,
    Session,
    ZaddyTopicAppendRow,
    ZaddyTopicBufferRow,
} from './types.ts';

/** Quiet for this long and the topic is over; the buffer waits to be summarized. */
const STALE_MS = 15 * 60 * 1000;
/** Nobody came back to summarize it within a day: keep the log rather than lose it. */
const ABANDONED_MS = 24 * 60 * 60 * 1000;
/** Hand back at most this many at once — a long queue gets summarized carelessly. */
const HANDOFF_LIMIT = 2;
/** How far back an append may claim to have happened. */
const BACKDATE_MS = 15 * 60 * 1000;
const ABANDONED_BATCH_LIMIT = 20;

export interface ObserveZaddyTopicInput {
    bufferId?: string;
    /** One line for the running log. Optional only when finalizing with a summary. */
    content?: string;
    /** The single entry that lands in the timeline. Required to finalize. */
    summary?: string;
    observedAt: number;
    category?: string;
    finalize?: boolean;
}

export type ZaddyTimelineEntity =
    | { entityType: 'note'; value: Note }
    | { entityType: 'session'; value: Session };

/** A buffer that went quiet, handed back with its log so it can be summarized. */
export interface ZaddyTopicHandoff {
    id: string;
    category?: string;
    appends: { at: number; content: string }[];
}

function publicBuffer(row: ZaddyTopicBufferRow, appendCount: number) {
    return {
        id: row.id,
        summary: row.content,
        lastAppendAt: row.last_append_at,
        appendCount,
        ...(row.category ? { category: row.category } : {}),
        status: row.status,
        ...(row.entity_type ? { entityType: row.entity_type } : {}),
        ...(row.entity_id ? { entityId: row.entity_id } : {}),
    };
}

async function loadAppends(env: Env, bufferId: string): Promise<ZaddyTopicAppendRow[]> {
    const rows = await env.CHRONOLOG_DB.prepare(`
        SELECT * FROM zaddy_topic_appends WHERE buffer_id = ? ORDER BY observed_at ASC
    `).bind(bufferId).all<ZaddyTopicAppendRow>();
    return rows.results ?? [];
}

/**
 * An observation with a real span becomes a historical Session. A
 * single-point observation remains a Note. Both are explicitly
 * zaddy-authored and never participate in the user's active-session state.
 *
 * The span comes from the appends, so summarizing hours later — or from
 * another conversation entirely — cannot move the entry on the timeline.
 * An unsummarized buffer materializes as its raw log; that is the last
 * resort, and it is still better than dropping the day on the floor.
 */
export function buildZaddyTimelineEntity(
    row: ZaddyTopicBufferRow,
    appends: ZaddyTopicAppendRow[],
): ZaddyTimelineEntity {
    const times = appends.map(append => append.observed_at);
    const startAt = times.length ? Math.min(...times) : row.last_append_at;
    const endAt = times.length ? Math.max(...times) : row.last_append_at;
    const summary = row.content.trim();
    const common = {
        id: `zaddy:${row.id}`,
        content: summary || appends.map(append => append.content).join('\n'),
        ...(row.category ? { category: row.category } : {}),
        origin: 'zaddy' as const,
    };
    if (endAt > startAt) {
        return { entityType: 'session', value: { ...common, startAt, endAt } };
    }
    return { entityType: 'note', value: { ...common, timestamp: endAt } };
}

async function finalizeBuffer(
    env: Env,
    row: ZaddyTopicBufferRow,
    appends: ZaddyTopicAppendRow[],
) {
    if (row.status === 'closed' && row.entity_type && row.entity_id) {
        return {
            buffer: publicBuffer(row, appends.length),
            entity: { entityType: row.entity_type, id: row.entity_id },
        };
    }

    const entity = buildZaddyTimelineEntity(row, appends);
    const mutation: RevisionMutation = {
        mutationId: `zaddy-buffer:${row.id}:finalize`,
        entityType: entity.entityType,
        entityId: entity.value.id,
        operation: 'upsert',
        value: entity.value,
    };
    const result = await applyMutationsWithNotionSync(env, [mutation]);
    if (result.rejectedMutations.length > 0) {
        throw new Error(result.rejectedMutations[0].detail ?? 'zaddy observation was rejected');
    }

    const now = Date.now();
    await env.CHRONOLOG_DB.prepare(`
        UPDATE zaddy_topic_buffers
        SET status = 'closed', entity_type = ?, entity_id = ?, updated_at = ?
        WHERE id = ?
    `).bind(entity.entityType, entity.value.id, now, row.id).run();

    return {
        buffer: publicBuffer({
            ...row,
            status: 'closed',
            entity_type: entity.entityType,
            entity_id: entity.value.id,
            updated_at: now,
        }, appends.length),
        entity: entity.value,
        revision: result.revision,
    };
}

/**
 * Materialize buffers nobody ever came back to summarize. Read paths call this
 * too: a pull may be the only traffic the account sees for days.
 */
export async function expireAbandonedZaddyTopics(
    env: Env,
    now = Date.now(),
): Promise<number> {
    const abandoned = await env.CHRONOLOG_DB.prepare(`
        SELECT * FROM zaddy_topic_buffers
        WHERE status = 'open' AND last_append_at < ?
        ORDER BY last_append_at ASC
        LIMIT ?
    `).bind(now - ABANDONED_MS, ABANDONED_BATCH_LIMIT).all<ZaddyTopicBufferRow>();

    for (const row of abandoned.results ?? []) {
        await finalizeBuffer(env, row, await loadAppends(env, row.id));
    }
    return (abandoned.results ?? []).length;
}

async function loadHandoff(env: Env, row: ZaddyTopicBufferRow): Promise<ZaddyTopicHandoff> {
    const appends = await loadAppends(env, row.id);
    return {
        id: row.id,
        ...(row.category ? { category: row.category } : {}),
        appends: appends.map(append => ({ at: append.observed_at, content: append.content })),
    };
}

/**
 * Buffers whose topic has gone quiet, returned with their log so the next
 * conversation can write the summary. They may belong to a different
 * conversation than the one asking; the log is the material either way.
 *
 * `pinnedBufferId` jumps the queue: a buffer this very call just orphaned must
 * come back now, not once the older ones ahead of it clear the HANDOFF_LIMIT.
 */
export async function collectZaddyHandoffs(
    env: Env,
    now = Date.now(),
    excludeBufferId?: string,
    pinnedBufferId?: string,
): Promise<ZaddyTopicHandoff[]> {
    const handoffs: ZaddyTopicHandoff[] = [];
    if (pinnedBufferId) {
        const pinned = await env.CHRONOLOG_DB.prepare(
            "SELECT * FROM zaddy_topic_buffers WHERE id = ? AND status = 'open'"
        ).bind(pinnedBufferId).first<ZaddyTopicBufferRow>();
        if (pinned) handoffs.push(await loadHandoff(env, pinned));
    }

    const stale = await env.CHRONOLOG_DB.prepare(`
        SELECT * FROM zaddy_topic_buffers
        WHERE status = 'open' AND last_append_at < ? AND id NOT IN (?, ?)
        ORDER BY last_append_at ASC
        LIMIT ?
    `).bind(
        now - STALE_MS,
        excludeBufferId ?? '',
        pinnedBufferId ?? '',
        Math.max(HANDOFF_LIMIT - handoffs.length, 0),
    ).all<ZaddyTopicBufferRow>();

    for (const row of stale.results ?? []) {
        handoffs.push(await loadHandoff(env, row));
    }
    return handoffs;
}

async function appendToBuffer(env: Env, bufferId: string, content: string, observedAt: number) {
    const now = Date.now();
    await env.CHRONOLOG_DB.prepare(`
        INSERT INTO zaddy_topic_appends (id, buffer_id, content, observed_at, created_at)
        VALUES (?, ?, ?, ?, ?)
    `).bind(crypto.randomUUID(), bufferId, content, observedAt, now).run();
}

export async function observeZaddyTopic(env: Env, input: ObserveZaddyTopicInput) {
    const now = Date.now();
    await expireAbandonedZaddyTopics(env, now);

    const finalize = input.finalize === true;
    const content = input.content?.trim();
    const summary = input.summary?.trim();
    if (finalize && !summary) {
        throw new Error('finalize requires a summary; the summary is what lands in the timeline');
    }
    if (!finalize && !content) {
        throw new Error('content is required unless finalizing with a summary');
    }
    if (content && input.observedAt < now - BACKDATE_MS) {
        throw new Error('observedAt cannot be more than 15 minutes in the past');
    }

    let row: ZaddyTopicBufferRow | null = null;
    /** Set when a stale reuse was split off; the old buffer still needs a summary. */
    let splitFrom: ZaddyTopicBufferRow | null = null;
    if (input.bufferId) {
        const current = await env.CHRONOLOG_DB.prepare(
            'SELECT * FROM zaddy_topic_buffers WHERE id = ?'
        ).bind(input.bufferId).first<ZaddyTopicBufferRow>();
        if (!current) throw new Error(`Unknown zaddy buffer "${input.bufferId}"`);
        if (current.status === 'closed') {
            if (finalize) return finalizeBuffer(env, current, await loadAppends(env, current.id));
            throw new Error(`Zaddy buffer "${input.bufferId}" is already closed; start a new observation`);
        }
        if (content && current.last_append_at < now - STALE_MS) splitFrom = current;
        else row = current;
    }
    if (!row) {
        row = {
            id: crypto.randomUUID(),
            content: '',
            last_append_at: input.observedAt,
            category: input.category ?? splitFrom?.category ?? null,
            status: 'open',
            entity_type: null,
            entity_id: null,
            created_at: now,
            updated_at: now,
        };
        await env.CHRONOLOG_DB.prepare(`
            INSERT INTO zaddy_topic_buffers
              (id, content, last_append_at, category, status, created_at, updated_at)
            VALUES (?, '', ?, ?, 'open', ?, ?)
        `).bind(row.id, row.last_append_at, row.category, row.created_at, row.updated_at).run();
    }

    // The summary was written about the topic that just ended, so it belongs to
    // the buffer being split away from — never to the line that outlived it.
    let closed: Awaited<ReturnType<typeof finalizeBuffer>> | null = null;
    if (splitFrom && summary) {
        closed = await finalizeBuffer(env, { ...splitFrom, content: summary }, await loadAppends(env, splitFrom.id));
        await env.CHRONOLOG_DB.prepare(
            'UPDATE zaddy_topic_buffers SET content = ? WHERE id = ?'
        ).bind(summary, splitFrom.id).run();
    }

    if (content) {
        await appendToBuffer(env, row.id, content, input.observedAt);
        row = { ...row, last_append_at: Math.max(row.last_append_at, input.observedAt) };
    }
    const category = input.category ?? row.category;
    if (summary && !splitFrom) row = { ...row, content: summary };
    await env.CHRONOLOG_DB.prepare(`
        UPDATE zaddy_topic_buffers
        SET content = ?, last_append_at = ?, category = ?, updated_at = ?
        WHERE id = ? AND status = 'open'
    `).bind(row.content, row.last_append_at, category ?? null, now, row.id).run();
    row = { ...row, category: category ?? null, updated_at: now };

    const appends = await loadAppends(env, row.id);
    const result = finalize && !splitFrom
        ? await finalizeBuffer(env, row, appends)
        : { buffer: publicBuffer(row, appends.length) };
    const split = splitFrom
        ? {
            split: {
                previousBufferId: splitFrom.id,
                reason: 'stale' as const,
                detail: 'that topic had been quiet past the staleness window; '
                    + 'this line opened a new buffer so the entry cannot span the gap',
            },
            ...(closed ? { entity: closed.entity, revision: closed.revision } : {}),
        }
        : {};
    const pendingHandoff = await collectZaddyHandoffs(
        env,
        now,
        row.id,
        splitFrom && !closed ? splitFrom.id : undefined,
    );
    return {
        ...result,
        ...split,
        ...(pendingHandoff.length ? { pendingHandoff } : {}),
    };
}
