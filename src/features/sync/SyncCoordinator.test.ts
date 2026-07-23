import { describe, expect, it, vi } from 'vitest'
import type { Entry, RevisionSyncData, SyncMutation } from '@/types'
import {
  SyncCoordinator,
  type SyncDataSnapshot,
  type SyncOutbox,
  type SyncStorage,
} from './SyncCoordinator'

function entry(id: string, content: string): Entry {
  return {
    id,
    type: 'NOTE',
    content,
    timestamp: 1,
  }
}

function snapshot(entries: Entry[] = []): SyncDataSnapshot {
  return { entries, contentTypes: [], mediaItems: [] }
}

function memoryStorage(initial: Record<string, string> = {}): SyncStorage & { values: Map<string, string> } {
  const values = new Map(Object.entries(initial))
  return {
    values,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
    removeItem: key => { values.delete(key) },
  }
}

function memoryOutbox(initial: SyncMutation[] = []): SyncOutbox & {
  values: Map<string, SyncMutation>
  queued: SyncMutation[][]
  acknowledged: string[][]
} {
  const values = new Map(initial.map(mutation => [mutation.key, mutation]))
  const queued: SyncMutation[][] = []
  const acknowledged: string[][] = []

  return {
    values,
    queued,
    acknowledged,
    async load() {
      return [...values.values()]
    },
    async queue(mutations) {
      queued.push(mutations)
      mutations.forEach(mutation => values.set(mutation.key, mutation))
    },
    async acknowledge(mutationIds) {
      acknowledged.push(mutationIds)
      const ids = new Set(mutationIds)
      values.forEach((mutation, key) => {
        if (ids.has(mutation.mutationId)) values.delete(key)
      })
    },
  }
}

function remoteData(overrides: Partial<RevisionSyncData> = {}): RevisionSyncData {
  return {
    entries: [],
    contentTypes: [],
    mediaItems: [],
    deleted: { entries: [], contentTypes: [], mediaItems: [] },
    revision: 1,
    incremental: true,
    ...overrides,
  }
}

describe('SyncCoordinator', () => {
  it('turns observed local transitions into durable outbox mutations', async () => {
    const outbox = memoryOutbox()
    const coordinator = new SyncCoordinator({
      initialData: snapshot([entry('a', 'before')]),
      importData: vi.fn(),
      storage: memoryStorage({ chronolog_outbox_v1_seeded: '1' }),
      outbox,
      fetch: vi.fn() as unknown as typeof fetch,
    })

    await coordinator.observeData(snapshot([
      entry('a', 'after'),
      entry('b', 'new'),
    ]))

    expect(outbox.queued).toHaveLength(1)
    expect(outbox.queued[0]).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entityType: 'entry',
        entityId: 'a',
        operation: 'upsert',
        value: expect.objectContaining({ content: 'after' }),
      }),
      expect.objectContaining({
        entityType: 'entry',
        entityId: 'b',
        operation: 'upsert',
      }),
    ]))
  })

  it('pulls from the stored revision, merges remote data, and advances only the pull cursor', async () => {
    const storage = memoryStorage({
      chronolog_outbox_v1_seeded: '1',
      chronolog_pull_revision: '2',
    })
    const outbox = memoryOutbox()
    const importData = vi.fn()
    const fetchFn = vi.fn(async () => Response.json(remoteData({
      entries: [entry('remote', 'from cloud')],
      revision: 3,
    }))) as unknown as typeof fetch
    const coordinator = new SyncCoordinator({
      initialData: snapshot([entry('local', 'kept')]),
      importData,
      storage,
      outbox,
      fetch: fetchFn,
      apiBase: () => 'https://chronolog.test',
      now: () => 100,
    })

    await coordinator.pull('token')

    expect(fetchFn).toHaveBeenCalledWith(
      'https://chronolog.test/api/data?revision=2',
      { headers: { Authorization: 'Bearer token' } },
    )
    expect(importData).toHaveBeenCalledWith({
      entries: [
        expect.objectContaining({ id: 'local' }),
        expect.objectContaining({ id: 'remote' }),
      ],
      contentTypes: [],
      mediaItems: [],
    })
    expect(storage.getItem('chronolog_pull_revision')).toBe('3')
    expect(coordinator.getState()).toMatchObject({
      isSyncing: false,
      lastSynced: 100,
      error: null,
    })
  })

  it('preserves a local edit batched into the render that acknowledges a remote import', async () => {
    const outbox = memoryOutbox()
    let imported = snapshot()
    const coordinator = new SyncCoordinator({
      initialData: snapshot(),
      importData: data => {
        imported = data as SyncDataSnapshot
      },
      storage: memoryStorage({ chronolog_outbox_v1_seeded: '1' }),
      outbox,
      fetch: vi.fn(async () => Response.json(remoteData({
        entries: [entry('remote', 'cloud value')],
        revision: 2,
      }))) as unknown as typeof fetch,
    })

    await coordinator.pull('token')
    expect(coordinator.isImporting()).toBe(true)

    await coordinator.observeData(snapshot([
      { ...imported.entries[0], content: 'edited locally during import' },
    ]))

    expect(coordinator.isImporting()).toBe(false)
    expect(outbox.values.get('entry:remote')).toMatchObject({
      entityId: 'remote',
      operation: 'upsert',
      value: expect.objectContaining({ content: 'edited locally during import' }),
    })
  })

  it('keeps an imported revision when another pull starts before the UI render flushes', async () => {
    const imports: SyncDataSnapshot[] = []
    const responses = [
      remoteData({ entries: [entry('a', 'revision 2')], revision: 2 }),
      remoteData({ entries: [entry('b', 'revision 3')], revision: 3 }),
    ]
    const coordinator = new SyncCoordinator({
      initialData: snapshot(),
      importData: data => { imports.push(data as SyncDataSnapshot) },
      storage: memoryStorage({
        chronolog_outbox_v1_seeded: '1',
        chronolog_pull_revision: '1',
      }),
      outbox: memoryOutbox(),
      fetch: vi.fn(async () => Response.json(responses.shift())) as unknown as typeof fetch,
    })

    await coordinator.pull('token')
    await coordinator.pull('token')

    expect(imports).toHaveLength(2)
    expect(imports[1].entries.map(item => item.id)).toEqual(['a', 'b'])
  })

  it('pushes in bounded batches and acknowledges the exact applied mutations', async () => {
    const mutations: SyncMutation[] = Array.from({ length: 21 }, (_, index) => ({
      key: `entry:${index}`,
      mutationId: `mutation-${index}`,
      entityType: 'entry',
      entityId: String(index),
      operation: 'upsert',
      value: entry(String(index), `entry ${index}`),
      createdAt: index,
    }))
    const outbox = memoryOutbox(mutations)
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body)) as {
        mutations: Array<{ mutationId: string }>
      }
      return Response.json({
        appliedMutationIds: payload.mutations.map(mutation => mutation.mutationId),
      })
    }) as unknown as typeof fetch
    const coordinator = new SyncCoordinator({
      initialData: snapshot(),
      importData: vi.fn(),
      storage: memoryStorage({ chronolog_outbox_v1_seeded: '1' }),
      outbox,
      fetch: fetchFn,
      now: () => 200,
    })

    await coordinator.push('token')

    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(outbox.acknowledged.map(batch => batch.length)).toEqual([20, 1])
    expect(outbox.values.size).toBe(0)
    expect(coordinator.getState().lastSynced).toBe(200)
  })

  it('serializes concurrent sync operations', async () => {
    const events: string[] = []
    let releasePull: (() => void) | undefined
    let markPullStarted: (() => void) | undefined
    const pullGate = new Promise<void>(resolve => { releasePull = resolve })
    const pullStarted = new Promise<void>(resolve => { markPullStarted = resolve })
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('?revision=')) {
        events.push('pull:start')
        markPullStarted?.()
        await pullGate
        events.push('pull:end')
        return Response.json(remoteData())
      }
      events.push('push')
      return Response.json({ appliedMutationIds: ['mutation'] })
    }) as unknown as typeof fetch
    const mutation: SyncMutation = {
      key: 'entry:a',
      mutationId: 'mutation',
      entityType: 'entry',
      entityId: 'a',
      operation: 'upsert',
      value: entry('a', 'value'),
      createdAt: 1,
    }
    const coordinator = new SyncCoordinator({
      initialData: snapshot([entry('a', 'value')]),
      importData: vi.fn(),
      storage: memoryStorage({ chronolog_outbox_v1_seeded: '1' }),
      outbox: memoryOutbox([mutation]),
      fetch: fetchFn,
    })

    const pull = coordinator.pull('token')
    const push = coordinator.push('token')
    await pullStarted
    expect(events).toEqual(['pull:start'])

    releasePull?.()
    await Promise.all([pull, push])
    expect(events).toEqual(['pull:start', 'pull:end', 'push'])
  })
})
