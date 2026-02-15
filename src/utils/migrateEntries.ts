import type { Entry, ContentType } from '../types'

/**
 * Migrate and clean up entries at load time.
 * Pure function — returns a new array with all fixups applied.
 */
export function migrateEntries(entries: Entry[], contentTypes: ContentType[]): Entry[] {
    const validTypeIds = new Set(contentTypes.map(ct => ct.id))

    return entries.map(entry => {
        let patched = entry
        let dirty = false

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
