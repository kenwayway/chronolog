/**
 * Extract images embedded in entry content (🖼️ url lines) for the gallery.
 */

import type { Entry } from '@/types'

export interface EntryImage {
    /** Image URL as written in the entry content */
    url: string
    /** The entry this image belongs to */
    entry: Entry
}

/** Matches an image line: 🖼 (with or without variation selector) + URL */
const IMAGE_LINE_RE = /^🖼[︎️]?\s*(.+)$/

/**
 * Collect all images across entries, newest entry first.
 * An entry with multiple image lines yields one item per image.
 */
export function extractImages(entries: Entry[]): EntryImage[] {
    const images: EntryImage[] = []

    for (const entry of entries) {
        if (!entry.content || !entry.content.includes('🖼')) continue
        for (const line of entry.content.split('\n')) {
            const match = line.trim().match(IMAGE_LINE_RE)
            if (match) {
                images.push({ url: match[1].trim(), entry })
            }
        }
    }

    return images.sort((a, b) => b.entry.timestamp - a.entry.timestamp)
}

/**
 * Thumbnail URL for an app-hosted image ("X" → "X.thumb").
 * External URLs are returned unchanged. Readers should fall back to the
 * original via onError since old uploads have no thumbnail object.
 */
export function thumbUrl(url: string): string {
    return url.includes('/api/image/') ? `${url}.thumb` : url
}
