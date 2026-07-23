import { describe, it, expect } from 'vitest'
import { extractImages, thumbUrl } from './imageExtractor'
import type { TimelineItem } from '@/types'

function makeItem(overrides: Partial<TimelineItem>): TimelineItem {
    return {
        id: 'e1',
        entityId: 'e1',
        kind: 'note',
        content: '',
        timestamp: 1000,
        ...overrides,
    }
}

describe('extractImages', () => {
    it('extracts image urls from 🖼️ lines', () => {
        const entry = makeItem({ content: 'lunch photo\n🖼️ /api/image/a.webp' })
        const result = extractImages([entry])
        expect(result).toHaveLength(1)
        expect(result[0].url).toBe('/api/image/a.webp')
        expect(result[0].item).toBe(entry)
    })

    it('handles the emoji without variation selector', () => {
        const entry = makeItem({ content: '🖼 /api/image/b.jpg' })
        expect(extractImages([entry])[0].url).toBe('/api/image/b.jpg')
    })

    it('yields one item per image in a multi-image entry', () => {
        const entry = makeItem({ content: '🖼️ /a.png\ntext\n🖼️ /b.png' })
        const result = extractImages([entry])
        expect(result.map(i => i.url)).toEqual(['/a.png', '/b.png'])
    })

    it('skips entries without images', () => {
        expect(extractImages([makeItem({ content: 'plain note' })])).toEqual([])
    })

    it('sorts newest entry first', () => {
        const old = makeItem({ id: 'old', entityId: 'old', timestamp: 1, content: '🖼️ /old.png' })
        const recent = makeItem({ id: 'new', entityId: 'new', timestamp: 2, content: '🖼️ /new.png' })
        const result = extractImages([old, recent])
        expect(result.map(i => i.url)).toEqual(['/new.png', '/old.png'])
    })

    it('ignores 🖼 mentioned mid-line (not an image line)', () => {
        const entry = makeItem({ content: 'I love the 🖼 emoji usage' })
        // Mid-line 🖼 without a leading position still matches after trim only
        // if the line *starts* with it — this one starts with "I love"
        expect(extractImages([entry])).toEqual([])
    })
})

describe('thumbUrl', () => {
    it('appends .thumb to app-hosted image urls', () => {
        expect(thumbUrl('/api/image/a.webp')).toBe('/api/image/a.webp.thumb')
        expect(thumbUrl('https://x.dev/api/image/b.jpg')).toBe('https://x.dev/api/image/b.jpg.thumb')
    })

    it('leaves external urls unchanged', () => {
        expect(thumbUrl('https://example.com/pic.png')).toBe('https://example.com/pic.png')
    })
})
