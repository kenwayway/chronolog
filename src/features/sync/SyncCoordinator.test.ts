import { describe, expect, it, vi } from 'vitest'
import type { Note, RevisionSyncData, Session, SyncMutation } from '@/types'
import {
  SyncCoordinator,
  type SyncDataSnapshot,
  type SyncOutbox,
  type SyncStorage,
} from './SyncCoordinator'

function note(id: string, content: string): Note {
  return { id, content, timestamp: 1 }
}

function session(id: string, content: string): Session {
  return { id, content, startAt: 1, endAt: null }
}

function snapshot(notes: Note[] = [], sessions: Session[] = []): SyncDataSnapshot {
  return { notes, sessions, contentTypes: [], mediaItems: [] }
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
} {
  const values = new Map(initial.map(mutation => [mutation.key, mutation]))
  const queued: SyncMutation[][] = []
  return {
    values,
    queued,
    async load() { return [...values.values()] },
    async queue(mutations) {
      queued.push(mutations)
      mutations.forEach(mutation => values.set(mutation.key, mutation))
    },
    async acknowledge(mutationIds) {
      const ids = new Set(mutationIds)
      values.forEach((mutation, key) => {
        if (ids.has(mutation.mutationId)) values.delete(key)
      })
    },
  }
}

function remoteData(overrides: Partial<RevisionSyncData> = {}): RevisionSyncData {
  return {
    notes: [],
    sessions: [],
    contentTypes: [],
    mediaItems: [],
    deleted: { notes: [], sessions: [], contentTypes: [], mediaItems: [] },
    revision: 1,
    incremental: true,
    ...overrides,
  }
}

const seededStorage = () => memoryStorage({ chronolog_outbox_v2_seeded: '1' })

describe('SyncCoordinator', () => {
  it('queues independent note and session mutations', async () => {
    const outbox = memoryOutbox()
    const coordinator = new SyncCoordinator({
      initialData: snapshot([note('n', 'before')], [session('s', 'before')]),
      importData: vi.fn(),
      storage: seededStorage(),
      outbox,
      fetch: vi.fn() as unknown as typeof fetch,
    })

    await coordinator.observeData(snapshot(
      [note('n', 'after'), note('new', 'created')],
      [{ ...session('s', 'before'), endAt: 20 }],
    ))

    expect(outbox.queued.flat()).toEqual(expect.arrayContaining([
      expect.objectContaining({ entityType: 'note', entityId: 'n', operation: 'upsert' }),
      expect.objectContaining({ entityType: 'note', entityId: 'new', operation: 'upsert' }),
      expect.objectContaining({ entityType: 'session', entityId: 's', operation: 'upsert' }),
    ]))
  })

  it('pulls from the stored revision and imports both domains', async () => {
    const storage = memoryStorage({
      chronolog_outbox_v2_seeded: '1',
      chronolog_pull_revision: '2',
    })
    const importData = vi.fn()
    const fetchFn = vi.fn(async () => Response.json(remoteData({
      notes: [note('remote-note', 'cloud')],
      sessions: [session('remote-session', 'cloud work')],
      revision: 3,
    }))) as unknown as typeof fetch
    const coordinator = new SyncCoordinator({
      initialData: snapshot(),
      importData,
      storage,
      outbox: memoryOutbox(),
      fetch: fetchFn,
      apiBase: () => 'https://chronolog.test',
    })

    await coordinator.pull('token')

    expect(fetchFn).toHaveBeenCalledWith(
      'https://chronolog.test/api/data?revision=2',
      { headers: { Authorization: 'Bearer token' } },
    )
    expect(importData).toHaveBeenCalledWith(expect.objectContaining({
      notes: [expect.objectContaining({ id: 'remote-note' })],
      sessions: [expect.objectContaining({ id: 'remote-session' })],
    }))
    expect(storage.values.get('chronolog_pull_revision')).toBe('3')
  })

  it('does not overwrite locally dirty entities during a pull', async () => {
    const dirty: SyncMutation = {
      key: 'note:n',
      mutationId: 'mutation-1',
      entityType: 'note',
      entityId: 'n',
      operation: 'upsert',
      value: note('n', 'local edit'),
      createdAt: 1,
    }
    const importData = vi.fn()
    const coordinator = new SyncCoordinator({
      initialData: snapshot([note('n', 'local edit')]),
      importData,
      storage: seededStorage(),
      outbox: memoryOutbox([dirty]),
      fetch: vi.fn(async () => Response.json(remoteData({
        notes: [note('n', 'remote edit')],
      }))) as unknown as typeof fetch,
    })

    await coordinator.pull('token')
    expect(importData.mock.calls[0][0].notes[0].content).toBe('local edit')
  })

  it('pushes domain mutations and acknowledges them', async () => {
    const mutation: SyncMutation = {
      key: 'session:s',
      mutationId: 'mutation-1',
      entityType: 'session',
      entityId: 's',
      operation: 'upsert',
      value: session('s', 'work'),
      createdAt: 1,
    }
    const outbox = memoryOutbox([mutation])
    let requestBody = ''
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestBody = init?.body as string
      return Response.json({ appliedMutationIds: ['mutation-1'] })
    }) as unknown as typeof fetch
    const coordinator = new SyncCoordinator({
      initialData: snapshot(),
      importData: vi.fn(),
      storage: seededStorage(),
      outbox,
      fetch: fetchFn,
      apiBase: () => 'https://chronolog.test',
    })

    await coordinator.push('token')

    expect(JSON.parse(requestBody)).toEqual({
      mutations: [expect.objectContaining({
        entityType: 'session',
        entityId: 's',
      })],
    })
    expect(outbox.values.size).toBe(0)
  })

  it('seeds a fresh outbox with every existing domain entity', async () => {
    const outbox = memoryOutbox()
    const storage = memoryStorage()
    const coordinator = new SyncCoordinator({
      initialData: snapshot([note('n', 'note')], [session('s', 'session')]),
      importData: vi.fn(),
      storage,
      outbox,
      fetch: vi.fn(async () => Response.json(remoteData())) as unknown as typeof fetch,
    })

    await coordinator.pull('token')

    expect(outbox.values.has('note:n')).toBe(true)
    expect(outbox.values.has('session:s')).toBe(true)
    expect(storage.values.get('chronolog_outbox_v2_seeded')).toBe('1')
  })
})
