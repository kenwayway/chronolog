import { applyMutationsWithNotionSync } from './_notionSync.ts';
import type { RevisionMutation } from './_revisionSync.ts';
import type {
    Env,
    Note,
    Session,
    ZaddyTopicBufferRow,
} from './types.ts';

const STALE_BUFFER_MS = 30 * 60 * 1000;
const STALE_BATCH_LIMIT = 20;

export interface ObserveZaddyTopicInput {
    bufferId?: string;
    content: string;
    observedAt: number;
    firstObservedAt?: number;
    category?: string;
    finalize?: boolean;
}

export type ZaddyTimelineEntity =
    | { entityType: 'note'; value: Note }
    | { entityType: 'session'; value: Session };

function publicBuffer(row: ZaddyTopicBufferRow) {
    return {
        id: row.id,
        content: row.content,
        firstObservedAt: row.first_observed_at,
        lastObservedAt: row.last_observed_at,
        observationCount: row.observation_count,
        ...(row.category ? { category: row.category } : {}),
        status: row.status,
        ...(row.entity_type ? { entityType: row.entity_type } : {}),
        ...(row.entity_id ? { entityId: row.entity_id } : {}),
    };
}

/**
 * An observation with a real span becomes a historical Session. A
 * single-point observation remains a Note. Both are explicitly
 * zaddy-authored and never participate in the user's active-session state.
 */
export function buildZaddyTimelineEntity(row: ZaddyTopicBufferRow): ZaddyTimelineEntity {
    const id = `zaddy:${row.id}`;
    const common = {
        id,
        content: row.content,
        ...(row.category ? { category: row.category } : {}),
        origin: 'zaddy' as const,
    };
    if (row.last_observed_at > row.first_observed_at) {
        return {
            entityType: 'session',
            value: {
                ...common,
                startAt: row.first_observed_at,
                endAt: row.last_observed_at,
            },
        };
    }
    return {
        entityType: 'note',
        value: {
            ...common,
            timestamp: row.last_observed_at,
        },
    };
}

async function finalizeBuffer(env: Env, row: ZaddyTopicBufferRow) {
    if (row.status === 'closed' && row.entity_type && row.entity_id) {
        return {
            buffer: publicBuffer(row),
            entity: { entityType: row.entity_type, id: row.entity_id },
        };
    }

    const entity = buildZaddyTimelineEntity(row);
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
        }),
        entity: entity.value,
        revision: result.revision,
    };
}

export async function finalizeStaleZaddyTopics(
    env: Env,
    now = Date.now(),
): Promise<number> {
    const stale = await env.CHRONOLOG_DB.prepare(`
        SELECT * FROM zaddy_topic_buffers
        WHERE status = 'open' AND last_observed_at < ?
        ORDER BY last_observed_at ASC
        LIMIT ?
    `).bind(now - STALE_BUFFER_MS, STALE_BATCH_LIMIT).all<ZaddyTopicBufferRow>();

    for (const row of stale.results) {
        await finalizeBuffer(env, row);
    }
    return stale.results.length;
}

export async function observeZaddyTopic(env: Env, input: ObserveZaddyTopicInput) {
    await finalizeStaleZaddyTopics(env);

    const now = Date.now();
    let row: ZaddyTopicBufferRow;

    if (input.bufferId) {
        const current = await env.CHRONOLOG_DB.prepare(
            'SELECT * FROM zaddy_topic_buffers WHERE id = ?'
        ).bind(input.bufferId).first<ZaddyTopicBufferRow>();
        if (!current) throw new Error(`Unknown zaddy buffer "${input.bufferId}"`);
        if (current.status === 'closed') {
            if (input.finalize) return finalizeBuffer(env, current);
            throw new Error(`Zaddy buffer "${input.bufferId}" is already closed; start a new observation`);
        }

        const firstObservedAt = Math.min(
            current.first_observed_at,
            input.firstObservedAt ?? current.first_observed_at,
            input.observedAt,
        );
        const lastObservedAt = Math.max(current.last_observed_at, input.observedAt);
        const category = input.category ?? current.category;
        await env.CHRONOLOG_DB.prepare(`
            UPDATE zaddy_topic_buffers
            SET content = ?, first_observed_at = ?, last_observed_at = ?,
                observation_count = observation_count + 1, category = ?, updated_at = ?
            WHERE id = ? AND status = 'open'
        `).bind(
            input.content,
            firstObservedAt,
            lastObservedAt,
            category ?? null,
            now,
            current.id,
        ).run();
        row = {
            ...current,
            content: input.content,
            first_observed_at: firstObservedAt,
            last_observed_at: lastObservedAt,
            observation_count: current.observation_count + 1,
            category: category ?? null,
            updated_at: now,
        };
    } else {
        const firstObservedAt = input.firstObservedAt ?? input.observedAt;
        if (firstObservedAt > input.observedAt) {
            throw new Error('firstObservedAt cannot be after observedAt');
        }
        row = {
            id: crypto.randomUUID(),
            content: input.content,
            first_observed_at: firstObservedAt,
            last_observed_at: input.observedAt,
            observation_count: 1,
            category: input.category ?? null,
            status: 'open',
            entity_type: null,
            entity_id: null,
            created_at: now,
            updated_at: now,
        };
        await env.CHRONOLOG_DB.prepare(`
            INSERT INTO zaddy_topic_buffers
              (id, content, first_observed_at, last_observed_at,
               observation_count, category, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, 1, ?, 'open', ?, ?)
        `).bind(
            row.id,
            row.content,
            row.first_observed_at,
            row.last_observed_at,
            row.category,
            row.created_at,
            row.updated_at,
        ).run();
    }

    if (input.finalize) return finalizeBuffer(env, row);
    return { buffer: publicBuffer(row) };
}
