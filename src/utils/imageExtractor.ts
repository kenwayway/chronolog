/**
 * Extract images embedded in entry content (🖼️ url lines) for the gallery.
 */

import type { TimelineItem } from '@/types'

export interface TimelineImage {
    /** Image URL as written in timeline content */
    url: string
    /** Timeline item this image belongs to */
    item: TimelineItem
}

/** Matches an image line: 🖼 (with or without variation selector) + URL */
const IMAGE_LINE_RE = /^🖼[︎️]?\s*(.+)$/

/**
 * Collect all images across entries, newest entry first.
 * An entry with multiple image lines yields one item per image.
 */
export function extractImages(items: TimelineItem[]): TimelineImage[] {
    const images: TimelineImage[] = []

    for (const item of items) {
        if (!item.content || !item.content.includes('🖼')) continue
        for (const line of item.content.split('\n')) {
            const match = line.trim().match(IMAGE_LINE_RE)
            if (match) {
                images.push({ url: match[1].trim(), item })
            }
        }
    }

    return images.sort((a, b) => b.item.timestamp - a.item.timestamp)
}

/**
 * Thumbnail URL for an app-hosted image ("X" → "X.thumb").
 * External URLs are returned unchanged. Readers should fall back to the
 * original via onError since old uploads have no thumbnail object.
 */
export function thumbUrl(url: string): string {
    return url.includes('/api/image/') ? `${url}.thumb` : url
}
