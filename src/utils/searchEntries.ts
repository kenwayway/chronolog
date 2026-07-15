import type { Category, ContentType, Entry, MediaItem } from '@/types'

export interface EntrySearchContext {
    categories?: Category[]
    contentTypes?: ContentType[]
    mediaItems?: MediaItem[]
}

function normalize(value: string): string {
    return value.normalize('NFKC').toLocaleLowerCase()
}

function collectSearchValues(
    value: unknown,
    values: string[],
    visited: Set<object>,
): void {
    if (value === null || value === undefined) return

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        values.push(String(value))
        return
    }

    if (typeof value !== 'object' || visited.has(value)) return
    visited.add(value)

    if (Array.isArray(value)) {
        value.forEach(item => collectSearchValues(item, values, visited))
        return
    }

    Object.entries(value).forEach(([key, nestedValue]) => {
        values.push(key)
        collectSearchValues(nestedValue, values, visited)
    })
}

/** Build the text searched for a single entry, including structured metadata. */
export function getEntrySearchText(entry: Entry, context: EntrySearchContext = {}): string {
    const values: string[] = [entry.content, entry.type, entry.category ?? '', entry.contentType ?? '']
    values.push(...(entry.tags ?? []))
    collectSearchValues(entry.fieldValues, values, new Set())

    const category = context.categories?.find(item => item.id === entry.category)
    if (category) values.push(category.label, category.description)

    const contentType = context.contentTypes?.find(item => item.id === entry.contentType)
    if (contentType) values.push(contentType.name)

    const mediaId = entry.fieldValues && 'mediaId' in entry.fieldValues
        ? entry.fieldValues.mediaId
        : undefined
    if (typeof mediaId === 'string') {
        const mediaItem = context.mediaItems?.find(item => item.id === mediaId)
        if (mediaItem) values.push(mediaItem.title, mediaItem.mediaType)
    }

    return normalize(values.filter(Boolean).join(' '))
}

/**
 * Search entries using whitespace-separated AND terms and return newest matches first.
 * An empty query deliberately returns no results so the UI can show an idle state.
 */
export function searchEntries(
    entries: Entry[],
    query: string,
    context: EntrySearchContext = {},
): Entry[] {
    const tokens = normalize(query).trim().split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return []

    return entries
        .filter(entry => {
            const searchableText = getEntrySearchText(entry, context)
            return tokens.every(token => searchableText.includes(token))
        })
        .sort((a, b) => b.timestamp - a.timestamp)
}
