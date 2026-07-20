import type { Entry, ContentType } from '@/types'
import { generateId } from '@/utils/formatters'
import { pairSessions } from '@/utils/sessionPairing'

/**
 * One-time sessionId backfill for legacy data: SESSION_STARTs without a
 * sessionId get a generated one, and each SESSION_END inherits the sessionId
 * of the START it pairs with chronologically. From then on pairing no longer
 * depends on timestamp order.
 * Returns entryId → sessionId for every entry that needs patching.
 */
function computeSessionIdBackfill(entries: Entry[]): Map<string, string> {
    const backfill = new Map<string, string>()

    for (const entry of entries) {
        if (entry.type === 'SESSION_START' && !entry.sessionId) {
            backfill.set(entry.id, generateId())
        }
    }

    const effective = backfill.size > 0
        ? entries.map(e => backfill.has(e.id) ? { ...e, sessionId: backfill.get(e.id) } : e)
        : entries

    for (const session of pairSessions(effective)) {
        if (session.end && !session.end.sessionId && session.start.sessionId) {
            backfill.set(session.end.id, session.start.sessionId)
        }
    }

    return backfill
}

/**
 * Migrate and clean up entries at load time.
 * Pure function — returns a new array with all fixups applied.
 */
export function migrateEntries(entries: Entry[], contentTypes: ContentType[]): Entry[] {
    const validTypeIds = new Set(contentTypes.map(ct => ct.id))
    const sessionIdBackfill = computeSessionIdBackfill(entries)

    return entries.map(entry => {
        let patched = entry
        let dirty = false

        // 0. Backfill sessionId on legacy session boundaries
        const backfilledSessionId = sessionIdBackfill.get(patched.id)
        if (backfilledSessionId && !patched.sessionId) {
            patched = { ...patched, sessionId: backfilledSessionId }
            dirty = true
        }

        // 1. Legacy category=beans|sparks → contentType
        const legacyCat = patched.category as string | undefined
        if ((legacyCat === 'beans' || legacyCat === 'sparks') && !patched.contentType) {
            patched = { ...patched, contentType: legacyCat, category: undefined }
            dirty = true
        }

        // 2. SESSION_END should never have a category
        if (patched.type === 'SESSION_END' && patched.category) {
            patched = dirty ? patched : { ...patched }
            patched.category = undefined
            dirty = true
        }

        // 3. contentType references a type that doesn't exist → clear
        if (patched.contentType && !validTypeIds.has(patched.contentType)) {
            patched = dirty ? patched : { ...patched }
            patched.contentType = undefined
            patched.fieldValues = undefined
            dirty = true
        }

        // 4. Has fieldValues but no contentType → clear fieldValues
        if (!patched.contentType && patched.fieldValues) {
            patched = dirty ? patched : { ...patched }
            patched.fieldValues = undefined
            dirty = true
        }

        // 5. Strip unknown fieldValues keys (only for types with defined fields)
        if (patched.contentType && patched.fieldValues) {
            const typeDef = contentTypes.find(ct => ct.id === patched.contentType)
            if (typeDef && typeDef.fields.length > 0) {
                const validKeys = new Set(typeDef.fields.map(f => f.id))
                const fv = patched.fieldValues as Record<string, unknown>
                const keys = Object.keys(fv)
                const unknownKeys = keys.filter(k => !validKeys.has(k))
                if (unknownKeys.length > 0) {
                    const cleaned: Record<string, unknown> = {}
                    for (const k of keys) {
                        if (validKeys.has(k)) cleaned[k] = fv[k]
                    }
                    patched = dirty ? patched : { ...patched }
                    patched.fieldValues = cleaned
                    dirty = true
                }
            }
        }

        return patched
    })
}
