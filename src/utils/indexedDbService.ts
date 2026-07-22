import type { ContentType, Entry, MediaItem, Session, SessionState, SessionStatus } from '@/types'
import { STORAGE_KEYS, getStorage, removeStorage } from './storageService'

const DB_NAME = 'chronolog'
const DB_VERSION = 2

const STORES = {
    METADATA: 'metadata',
    ENTRIES: 'entries',
    SESSIONS: 'sessions',
    CONTENT_TYPES: 'contentTypes',
    MEDIA_ITEMS: 'mediaItems',
} as const

const SESSION_METADATA_KEY = 'session'

type PersistedState = Pick<SessionState, 'status' | 'activeSessionId' | 'sessions' | 'entries' | 'contentTypes' | 'mediaItems'>
type Entity = { id: string }

interface SessionMetadata {
    key: typeof SESSION_METADATA_KEY
    status: SessionStatus
    activeSessionId: string | null
}

export interface EntityChanges<T extends Entity> {
    upserts: T[]
    deletedIds: string[]
}

let databasePromise: Promise<IDBDatabase> | null = null
let hydrationPromise: Promise<Partial<SessionState> | null> | null = null

export function createPersistenceQueue<T>(write: (current: T, previous: T | null) => Promise<void>) {
    let queue: Promise<void> = Promise.resolve()
    // This is the last state confirmed by a completed transaction, not merely
    // the last state queued. A failure clears it so the next write is full.
    let persisted: T | null = null

    return {
        seed(state: T | null) {
            persisted = state
        },
        enqueue(current: T): Promise<void> {
            const operation = queue.then(async () => {
                try {
                    await write(current, persisted)
                    persisted = current
                } catch (error) {
                    persisted = null
                    throw error
                }
            })
            queue = operation.catch(() => undefined)
            return operation
        },
    }
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
    })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
        transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
    })
}

function openDatabase(): Promise<IDBDatabase> {
    if (databasePromise) return databasePromise

    databasePromise = new Promise((resolve, reject) => {
        if (!('indexedDB' in globalThis)) {
            reject(new Error('IndexedDB is not available'))
            return
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION)

        request.onupgradeneeded = () => {
            const db = request.result
            if (!db.objectStoreNames.contains(STORES.METADATA)) {
                db.createObjectStore(STORES.METADATA, { keyPath: 'key' })
            }
            if (!db.objectStoreNames.contains(STORES.ENTRIES)) {
                const entries = db.createObjectStore(STORES.ENTRIES, { keyPath: 'id' })
                entries.createIndex('timestamp', 'timestamp')
            }
            if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
                const sessions = db.createObjectStore(STORES.SESSIONS, { keyPath: 'id' })
                sessions.createIndex('startAt', 'startAt')
            }
            if (!db.objectStoreNames.contains(STORES.CONTENT_TYPES)) {
                db.createObjectStore(STORES.CONTENT_TYPES, { keyPath: 'id' })
            }
            if (!db.objectStoreNames.contains(STORES.MEDIA_ITEMS)) {
                db.createObjectStore(STORES.MEDIA_ITEMS, { keyPath: 'id' })
            }
        }

        request.onsuccess = () => {
            const db = request.result
            db.onversionchange = () => {
                db.close()
                databasePromise = null
            }
            resolve(db)
        }
        request.onerror = () => {
            databasePromise = null
            reject(request.error ?? new Error('Failed to open IndexedDB'))
        }
        request.onblocked = () => {
            databasePromise = null
            reject(new Error('IndexedDB upgrade was blocked by another tab'))
        }
    })

    return databasePromise
}

async function readIndexedDbState(): Promise<Partial<SessionState> | null> {
    const db = await openDatabase()
    const transaction = db.transaction(Object.values(STORES), 'readonly')

    const [metadata, entries, sessions, contentTypes, mediaItems] = await Promise.all([
        requestResult(transaction.objectStore(STORES.METADATA).get(SESSION_METADATA_KEY) as IDBRequest<SessionMetadata | undefined>),
        requestResult(transaction.objectStore(STORES.ENTRIES).index('timestamp').getAll() as IDBRequest<Entry[]>),
        requestResult(transaction.objectStore(STORES.SESSIONS).index('startAt').getAll() as IDBRequest<Session[]>),
        requestResult(transaction.objectStore(STORES.CONTENT_TYPES).getAll() as IDBRequest<ContentType[]>),
        requestResult(transaction.objectStore(STORES.MEDIA_ITEMS).getAll() as IDBRequest<MediaItem[]>),
        transactionDone(transaction),
    ])

    if (!metadata && entries.length === 0 && sessions.length === 0 && contentTypes.length === 0 && mediaItems.length === 0) {
        return null
    }

    return {
        status: metadata?.status,
        activeSessionId: metadata?.activeSessionId ?? null,
        entries,
        sessions,
        contentTypes,
        mediaItems,
    }
}

/**
 * Compare immutable entity arrays by ID and reference. Reducer updates replace
 * changed objects, so unchanged records do not need another IndexedDB write.
 */
export function getEntityChanges<T extends Entity>(previous: T[], current: T[]): EntityChanges<T> {
    const previousById = new Map(previous.map(item => [item.id, item]))
    const currentIds = new Set(current.map(item => item.id))

    return {
        upserts: current.filter(item => previousById.get(item.id) !== item),
        deletedIds: previous.filter(item => !currentIds.has(item.id)).map(item => item.id),
    }
}

function applyEntityChanges<T extends Entity>(store: IDBObjectStore, previous: T[], current: T[]) {
    const changes = getEntityChanges(previous, current)
    changes.upserts.forEach(item => store.put(item))
    changes.deletedIds.forEach(id => store.delete(id))
}

async function persistSessionState(current: PersistedState, previous: PersistedState | null): Promise<void> {
    const db = await openDatabase()
    const transaction = db.transaction(Object.values(STORES), 'readwrite')

    transaction.objectStore(STORES.METADATA).put({
        key: SESSION_METADATA_KEY,
        status: current.status,
        activeSessionId: current.activeSessionId,
    } satisfies SessionMetadata)

    const entriesStore = transaction.objectStore(STORES.ENTRIES)
    const sessionsStore = transaction.objectStore(STORES.SESSIONS)
    const contentTypesStore = transaction.objectStore(STORES.CONTENT_TYPES)
    const mediaItemsStore = transaction.objectStore(STORES.MEDIA_ITEMS)

    if (!previous) {
        entriesStore.clear()
        sessionsStore.clear()
        contentTypesStore.clear()
        mediaItemsStore.clear()
        current.entries.forEach(entry => entriesStore.put(entry))
        current.sessions.forEach(session => sessionsStore.put(session))
        current.contentTypes.forEach(contentType => contentTypesStore.put(contentType))
        current.mediaItems.forEach(mediaItem => mediaItemsStore.put(mediaItem))
    } else {
        applyEntityChanges(entriesStore, previous.entries, current.entries)
        applyEntityChanges(sessionsStore, previous.sessions, current.sessions)
        applyEntityChanges(contentTypesStore, previous.contentTypes, current.contentTypes)
        applyEntityChanges(mediaItemsStore, previous.mediaItems, current.mediaItems)
    }

    await transactionDone(transaction)
}

const persistenceQueue = createPersistenceQueue<PersistedState>(persistSessionState)

function legacyState(): Partial<SessionState> | null {
    return getStorage<Partial<SessionState>>(STORAGE_KEYS.STATE)
}

function completePersistedState(state: Partial<SessionState>): PersistedState {
    return {
        status: state.status ?? (state.activeSessionId ? 'STREAMING' : 'IDLE'),
        activeSessionId: state.activeSessionId ?? null,
        entries: state.entries ?? [],
        sessions: state.sessions ?? [],
        contentTypes: state.contentTypes ?? [],
        mediaItems: state.mediaItems ?? [],
    }
}

/** Load IndexedDB state, migrating the legacy localStorage blob exactly once. */
export function loadPersistedSessionState(): Promise<Partial<SessionState> | null> {
    if (hydrationPromise) return hydrationPromise

    hydrationPromise = (async () => {
        try {
            const indexedState = await readIndexedDbState()
            if (indexedState) {
                persistenceQueue.seed(completePersistedState(indexedState))
                // Clean up a legacy copy left behind if a previous migration
                // committed successfully but the page closed before removal.
                removeStorage(STORAGE_KEYS.STATE)
                return indexedState
            }

            const legacy = legacyState()
            if (!legacy) return null

            const migrated = completePersistedState(legacy)
            await persistSessionState(migrated, null)
            persistenceQueue.seed(migrated)
            removeStorage(STORAGE_KEYS.STATE)
            return legacy
        } catch (error) {
            // Preserve and use the legacy copy if IndexedDB is unavailable.
            persistenceQueue.seed(null)
            console.error('Failed to load IndexedDB session state:', error)
            return legacyState()
        }
    })()

    return hydrationPromise
}

/**
 * Serialize writes and advance the diff baseline only after transaction
 * success. If a write fails, the next queued write sees a null baseline and
 * performs a full replacement, repairing an empty or partially stale DB.
 */
export function queuePersistedSessionState(current: PersistedState): Promise<void> {
    const operation = persistenceQueue.enqueue(current)
    operation.catch(error => {
        console.error('Failed to save session state to IndexedDB:', error)
    })
    return operation
}
