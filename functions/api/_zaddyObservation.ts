import { applyMutationsWithNotionSync } from './_notionSync.ts';
import type { RevisionMutation } from './_revisionSync.ts';
import type {
    Env,
    Note,
    Session,
    ZaddyTopicAppendRow,
    ZaddyTopicBufferRow,
} from './types.ts';

/** Quiet for this long and the topic is over; a new line starts its own buffer. */
const STALE_MS = 15 * 60 * 1000;
/**
 * Quiet for this long and the buffer settles onto the timeline by itself.
 *
 * Nothing has to be summarized for a day to be recorded. A summary is an
 * upgrade applied to an entry that already exists, not a toll paid before it
 * may exist — which is the whole point: when finalizing was the only way to
 * land an entry, whoever happened to be passing would summarize a conversation
 * they were never part of, just to stop it rotting.
 */
const SETTLE_MS = 45 * 60 * 1000;
/** How far back an append may claim to have happened. */
const BACKDATE_MS = 15 * 60 * 1000;
const SETTLE_BATCH_LIMIT = 20;
/** Open buffers reported back per call, newest first. */
const OPEN_BUFFER_LIMIT = 8;

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

/** A topic still running, reported so the caller can pick the right one. */
export interface ZaddyOpenBuffer {
    id: string;
    category?: string;
    appendCount: number;
    lastAppendAt: number;
    quietMinutes: number;
    /** How long until it lands on the timeline by itself. */
    settlesInMinutes: number;
    lastLine?: string;
    /** True for the buffer this call just wrote to. */
    current?: boolean;
}

/** A buffer split away from, handed back with its log so it can be summarized. */
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

/**
 * Land the buffer on the timeline. Safe to call again on one already settled:
 * the entity id is derived from the buffer, so a later call with a better
 * summary rewrites the same entry in place rather than adding a second one.
 * That is what makes a summary an upgrade instead of a deadline.
 */
async function finalizeBuffer(
    env: Env,
    row: ZaddyTopicBufferRow,
    appends: ZaddyTopicAppendRow[],
) {
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
 * Land every buffer that has gone quiet past SETTLE_MS. Read paths call this
 * too: a pull may be the only traffic the account sees for days.
 *
 * These settle on their log alone, with no summary, and that is the intended
 * resting state — not a failure mode. Anyone who was actually in the
 * conversation can still call finalize afterwards to replace the log with a
 * real summary; the entry keeps its id and its span either way.
 */
export async function settleQuietZaddyTopics(
    env: Env,
    now = Date.now(),
): Promise<number> {
    const quiet = await env.CHRONOLOG_DB.prepare(`
        SELECT * FROM zaddy_topic_buffers
        WHERE status = 'open' AND last_append_at < ?
        ORDER BY last_append_at ASC
        LIMIT ?
    `).bind(now - SETTLE_MS, SETTLE_BATCH_LIMIT).all<ZaddyTopicBufferRow>();

    for (const row of quiet.results ?? []) {
        await finalizeBuffer(env, row, await loadAppends(env, row.id));
    }
    return (quiet.results ?? []).length;
}

/**
 * Every buffer still open, so the caller can see what it is already holding
 * before it decides to open another one. This is the cure for two habits that
 * only look like different bugs: starting a fresh buffer because the id of the
 * right one was forgotten, and finalizing one topic with another topic's
 * summary. Both come from working blind.
 *
 * Deliberately no logs here, only the last line. A caller that recognizes a
 * buffer from one line was in that conversation; a caller that does not should
 * leave it alone and let it settle on its own.
 */
export async function openZaddyBuffers(
    env: Env,
    now = Date.now(),
    currentBufferId?: string,
): Promise<ZaddyOpenBuffer[]> {
    const rows = await env.CHRONOLOG_DB.prepare(`
        SELECT * FROM zaddy_topic_buffers
        WHERE status = 'open'
        ORDER BY last_append_at DESC
        LIMIT ?
    `).bind(OPEN_BUFFER_LIMIT).all<ZaddyTopicBufferRow>();

    const open: ZaddyOpenBuffer[] = [];
    for (const row of rows.results ?? []) {
        const appends = await loadAppends(env, row.id);
        open.push({
            id: row.id,
            ...(row.category ? { category: row.category } : {}),
            appendCount: appends.length,
            lastAppendAt: row.last_append_at,
            quietMinutes: Math.max(Math.round((now - row.last_append_at) / 60000), 0),
            settlesInMinutes: Math.max(
                Math.round((row.last_append_at + SETTLE_MS - now) / 60000),
                0,
            ),
            ...(appends.length ? { lastLine: appends[appends.length - 1].content } : {}),
            ...(row.id === currentBufferId ? { current: true } : {}),
        });
    }
    return open;
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
    await settleQuietZaddyTopics(env, now);

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
            // Already on the timeline. Finalizing again is the upgrade path: the
            // entry keeps its id and span and just gets better words. A call
            // with no content is necessarily a finalize — the validation above
            // rejects every other shape — so there is nothing else to handle.
            if (!content) {
                return {
                    ...await finalizeBuffer(
                        env,
                        { ...current, content: summary as string },
                        await loadAppends(env, current.id),
                    ),
                    openBuffers: await openZaddyBuffers(env, now),
                };
            }
            // It settled while nobody was talking. This line is a new topic, not
            // a reopening — the settled entry's span must stay where it is.
            splitFrom = current;
        } else if (content && current.last_append_at < now - STALE_MS) {
            splitFrom = current;
        } else {
            row = current;
        }
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
    // A buffer split away from is handed back with its whole log — unlike the
    // open-buffer list, which shows one line. The caller was in that
    // conversation a moment ago, so it is the one person who can summarize it.
    let previous: ZaddyTopicHandoff | undefined;
    if (splitFrom && !closed && splitFrom.status === 'open') {
        const priorAppends = await loadAppends(env, splitFrom.id);
        previous = {
            id: splitFrom.id,
            ...(splitFrom.category ? { category: splitFrom.category } : {}),
            appends: priorAppends.map(a => ({ at: a.observed_at, content: a.content })),
        };
    }

    const split = splitFrom
        ? {
            split: {
                previousBufferId: splitFrom.id,
                reason: splitFrom.status === 'closed' ? ('settled' as const) : ('stale' as const),
                detail: splitFrom.status === 'closed'
                    ? 'that topic had already settled onto the timeline; this line '
                        + 'opened a new buffer rather than moving a finished entry'
                    : 'that topic had been quiet past the staleness window; '
                        + 'this line opened a new buffer so the entry cannot span the gap',
                ...(previous ? { previous } : {}),
            },
            ...(closed ? { entity: closed.entity, revision: closed.revision } : {}),
        }
        : {};
    return {
        ...result,
        ...split,
        openBuffers: await openZaddyBuffers(env, now, row.id),
    };
}
