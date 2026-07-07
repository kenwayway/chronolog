import { describe, it, expect } from 'vitest'
import { extractImages } from './imageExtractor'
import type { Entry } from '@/types'

function makeEntry(overrides: Partial<Entry>): Entry {
    return {
        id: 'e1',
        type: 'NOTE',
        content: '',
        timestamp: 1000,
        ...overrides,
    }
}

describe('extractImages', () => {
    it('extracts image urls from 🖼️ lines', () => {
        const entry = makeEntry({ content: 'lunch photo\n🖼️ /api/image/a.webp' })
        const result = extractImages([entry])
        expect(result).toHaveLength(1)
        expect(result[0].url).toBe('/api/image/a.webp')
        expect(result[0].entry).toBe(entry)
    })

    it('handles the emoji without variation selector', () => {
        const entry = makeEntry({ content: '🖼 /api/image/b.jpg' })
        expect(extractImages([entry])[0].url).toBe('/api/image/b.jpg')
    })

    it('yields one item per image in a multi-image entry', () => {
        const entry = makeEntry({ content: '🖼️ /a.png\ntext\n🖼️ /b.png' })
        const result = extractImages([entry])
        expect(result.map(i => i.url)).toEqual(['/a.png', '/b.png'])
    })

    it('skips entries without images', () => {
        expect(extractImages([makeEntry({ content: 'plain note' })])).toEqual([])
    })

    it('sorts newest entry first', () => {
        const old = makeEntry({ id: 'old', timestamp: 1, content: '🖼️ /old.png' })
        const recent = makeEntry({ id: 'new', timestamp: 2, content: '🖼️ /new.png' })
        const result = extractImages([old, recent])
        expect(result.map(i => i.url)).toEqual(['/new.png', '/old.png'])
    })

    it('ignores 🖼 mentioned mid-line (not an image line)', () => {
        const entry = makeEntry({ content: 'I love the 🖼 emoji usage' })
        // Mid-line 🖼 without a leading position still matches after trim only
        // if the line *starts* with it — this one starts with "I love"
        expect(extractImages([entry])).toEqual([])
    })
})
