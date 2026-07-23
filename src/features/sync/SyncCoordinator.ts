import type {
  ContentType,
  Entry,
  ImportDataPayload,
  MediaItem,
  NotionSyncStatus,
  RevisionSyncData,
  SyncMutation,
} from '@/types'
import {
  acknowledgeSyncMutations,
  loadSyncOutbox,
  queueSyncMutations,
} from '@/utils/indexedDbService'
import { mergeRevisionEntities } from '@/utils/syncMerge'
import { buildSyncMutations, dirtyIdsByType } from '@/utils/syncOutbox'

const PULL_REVISION_KEY = 'chronolog_pull_revision'
const LEGACY_SYNC_KEY = 'chronolog_last_sync_at'
const OUTBOX_MIGRATION_KEY = 'chronolog_outbox_v1_seeded'
const MAX_MUTATIONS_PER_PUSH = 20

export interface SyncDataSnapshot {
  entries: Entry[]
  contentTypes: ContentType[]
  mediaItems: MediaItem[]
}

export interface SyncState {
  isSyncing: boolean
  lastSynced: number | null
  error: string | null
  notionSync: NotionSyncStatus
}

export interface SyncOutbox {
  load(): Promise<SyncMutation[]>
  queue(mutations: SyncMutation[]): Promise<void>
  acknowledge(mutationIds: string[]): Promise<void>
}

export interface SyncStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface SyncCoordinatorDependencies {
  initialData: SyncDataSnapshot
  importData: (data: ImportDataPayload) => void
  apiBase?: () => string
  fetch?: typeof fetch
  storage?: SyncStorage
  outbox?: SyncOutbox
  now?: () => number
}

type StateListener = (state: SyncState) => void

function defaultOutbox(): SyncOutbox {
  return {
    load: loadSyncOutbox,
    queue: queueSyncMutations,
    acknowledge: acknowledgeSyncMutations,
  }
}

function wireMutation(mutation: SyncMutation) {
  return {
    mutationId: mutation.mutationId,
    entityType: mutation.entityType,
    entityId: mutation.entityId,
    operation: mutation.operation,
    value: mutation.value,
  }
}

function customContentTypes(contentTypes: ContentType[]): ContentType[] {
  return contentTypes.filter(type => !type.builtIn)
}

function mutationsBetween(previous: SyncDataSnapshot, current: SyncDataSnapshot): SyncMutation[] {
  return [
    ...buildSyncMutations(previous.entries, current.entries, 'entry'),
    ...buildSyncMutations(
      customContentTypes(previous.contentTypes),
      customContentTypes(current.contentTypes),
      'contentType',
    ),
    ...buildSyncMutations(previous.mediaItems, current.mediaItems, 'mediaItem'),
  ]
}

/**
 * Framework-independent owner of the cloud sync protocol.
 *
 * React (or any future client) only reports immutable local snapshots and
 * subscribes to state. This class owns ordering, durable mutation handling,
 * revision cursors, remote merging, and import acknowledgement.
 */
export class SyncCoordinator {
  private currentData: SyncDataSnapshot
  private observedData: SyncDataSnapshot
  private pendingImportData: SyncDataSnapshot | null = null
  private importData: (data: ImportDataPayload) => void
  private readonly apiBase: () => string
  private readonly fetchFn: typeof fetch
  private readonly storage: SyncStorage
  private readonly outbox: SyncOutbox
  private readonly now: () => number
  private readonly listeners = new Set<StateListener>()

  private state: SyncState = {
    isSyncing: false,
    lastSynced: null,
    error: null,
    notionSync: { pending: 0, failed: 0 },
  }

  private syncLock: Promise<void> = Promise.resolve()
  private outboxInitPromise: Promise<void> | null = null
  private observationQueue: Promise<void> = Promise.resolve()

  constructor(dependencies: SyncCoordinatorDependencies) {
    this.currentData = dependencies.initialData
    this.observedData = dependencies.initialData
    this.importData = dependencies.importData
    this.apiBase = dependencies.apiBase ?? (() => '')
    this.fetchFn = dependencies.fetch ?? fetch
    this.storage = dependencies.storage ?? localStorage
    this.outbox = dependencies.outbox ?? defaultOutbox()
    this.now = dependencies.now ?? Date.now
  }

  getState(): SyncState {
    return this.state
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  setImportHandler(importData: (data: ImportDataPayload) => void): void {
    this.importData = importData
  }

  /**
   * Report the latest immutable application snapshot.
   *
   * When React flushes a remote import and a local edit in the same render,
   * diff against the exact imported snapshot instead of discarding the whole
   * transition as "remote". This preserves the concurrent local edit.
   */
  observeData(data: SyncDataSnapshot): Promise<void> {
    this.currentData = data
    const baseline = this.pendingImportData ?? this.observedData
    const mutations = mutationsBetween(baseline, data)

    this.pendingImportData = null
    this.observedData = data

    if (mutations.length === 0) return this.observationQueue

    const operation = this.observationQueue
      .then(() => this.ensureOutboxReady())
      .then(() => this.outbox.queue(mutations))

    this.observationQueue = operation.catch(error => {
      console.error('Failed to queue cloud sync mutations:', error)
      this.patchState({
        error: error instanceof Error ? error.message : 'Failed to queue cloud sync mutations',
      })
    })
    return operation
  }

  isImporting(): boolean {
    return this.pendingImportData !== null
  }

  pull(token: string | null, forceFullFetch = false): Promise<void> {
    return this.withSyncLock(async () => {
      try {
        this.patchState({ isSyncing: true, error: null })
        await this.ensureOutboxReady()
        await this.waitForObservations()

        const revision = this.readPullRevision(forceFullFetch)
        const headers: Record<string, string> = {}
        if (token) headers.Authorization = `Bearer ${token}`

        const response = await this.fetchFn(
          `${this.apiBase()}/api/data?revision=${revision}`,
          { headers },
        )
        if (!response.ok) throw new Error(`Failed to fetch data: ${response.status}`)

        const remote = await response.json() as RevisionSyncData
        await this.waitForObservations()
        const pending = await this.outbox.load()
        const dirty = dirtyIdsByType(pending)
        const full = !remote.incremental

        const merged: SyncDataSnapshot = {
          entries: mergeRevisionEntities(
            this.currentData.entries,
            remote.entries ?? [],
            remote.deleted?.entries ?? [],
            dirty.entry,
            full,
          ),
          contentTypes: mergeRevisionEntities(
            customContentTypes(this.currentData.contentTypes),
            remote.contentTypes ?? [],
            remote.deleted?.contentTypes ?? [],
            dirty.contentType,
            full,
          ),
          mediaItems: mergeRevisionEntities(
            this.currentData.mediaItems,
            remote.mediaItems ?? [],
            remote.deleted?.mediaItems ?? [],
            dirty.mediaItem,
            full,
          ),
        }

        const hasChanges = full
          || (remote.entries?.length ?? 0) > 0
          || (remote.contentTypes?.length ?? 0) > 0
          || (remote.mediaItems?.length ?? 0) > 0
          || (remote.deleted?.entries.length ?? 0) > 0
          || (remote.deleted?.contentTypes.length ?? 0) > 0
          || (remote.deleted?.mediaItems.length ?? 0) > 0

        if (hasChanges) {
          this.pendingImportData = merged
          // Advance the coordinator's own snapshot immediately. React may not
          // flush the import before another serialized pull begins.
          this.currentData = merged
          this.importData(merged)
        }

        // A pull response, never a push acknowledgement, advances this cursor.
        if (Number.isSafeInteger(remote.revision) && remote.revision >= 0) {
          this.storage.setItem(PULL_REVISION_KEY, String(remote.revision))
        }

        this.patchState({
          isSyncing: false,
          lastSynced: this.now(),
          notionSync: remote.notionSync ?? this.state.notionSync,
        })
      } catch (error) {
        this.patchState({
          isSyncing: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    })
  }

  push(token: string | null): Promise<void> {
    if (!token) return Promise.resolve()

    return this.withSyncLock(async () => {
      try {
        await this.ensureOutboxReady()
        await this.waitForObservations()
        const pending = await this.outbox.load()
        if (pending.length === 0) return

        this.patchState({ isSyncing: true, error: null })
        let notionSync: NotionSyncStatus | undefined

        for (let index = 0; index < pending.length; index += MAX_MUTATIONS_PER_PUSH) {
          const batch = pending.slice(index, index + MAX_MUTATIONS_PER_PUSH)
          const response = await this.fetchFn(`${this.apiBase()}/api/data`, {
            method: 'PUT',
            keepalive: true,
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ mutations: batch.map(wireMutation) }),
          })
          if (!response.ok) {
            const body = await response.text().catch(() => '')
            throw new Error(`Save failed (${response.status}): ${body}`)
          }

          const result = await response.json() as {
            appliedMutationIds?: string[]
            notionSync?: NotionSyncStatus
          }
          notionSync = result.notionSync ?? notionSync
          await this.outbox.acknowledge(
            result.appliedMutationIds ?? batch.map(item => item.mutationId),
          )
        }

        this.patchState({
          isSyncing: false,
          lastSynced: this.now(),
          notionSync: notionSync ?? this.state.notionSync,
        })
      } catch (error) {
        this.patchState({
          isSyncing: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    })
  }

  resetState(): void {
    this.pendingImportData = null
    this.observedData = this.currentData
    this.state = {
      isSyncing: false,
      lastSynced: null,
      error: null,
      notionSync: { pending: 0, failed: 0 },
    }
    this.emit()
  }

  clearPullCursor(): void {
    this.storage.removeItem(PULL_REVISION_KEY)
    this.storage.removeItem(LEGACY_SYNC_KEY)
  }

  private patchState(patch: Partial<SyncState>): void {
    this.state = { ...this.state, ...patch }
    this.emit()
  }

  private emit(): void {
    this.listeners.forEach(listener => listener(this.state))
  }

  private readPullRevision(forceFullFetch: boolean): number {
    if (forceFullFetch) return 0
    const value = Number(this.storage.getItem(PULL_REVISION_KEY) ?? 0)
    return Number.isSafeInteger(value) && value > 0 ? value : 0
  }

  private ensureOutboxReady(): Promise<void> {
    if (this.outboxInitPromise) return this.outboxInitPromise

    const initialization = (async () => {
      if (this.storage.getItem(OUTBOX_MIGRATION_KEY)) return

      const existing = await this.outbox.load()
      if (existing.length === 0) {
        await this.outbox.queue([
          ...buildSyncMutations([], this.currentData.entries, 'entry'),
          ...buildSyncMutations([], customContentTypes(this.currentData.contentTypes), 'contentType'),
          ...buildSyncMutations([], this.currentData.mediaItems, 'mediaItem'),
        ])
      }
      this.storage.setItem(OUTBOX_MIGRATION_KEY, '1')
    })()
    this.outboxInitPromise = initialization.catch(error => {
      // IndexedDB can be temporarily blocked by another tab during an upgrade.
      // Allow a later sync attempt to retry initialization.
      this.outboxInitPromise = null
      throw error
    })

    return this.outboxInitPromise
  }

  private async waitForObservations(): Promise<void> {
    let pending: Promise<void>
    do {
      pending = this.observationQueue
      await pending
    } while (pending !== this.observationQueue)
  }

  private withSyncLock<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.syncLock
    let release: () => void
    this.syncLock = new Promise<void>(resolve => { release = resolve })
    return previous.then(operation).finally(() => release())
  }
}
