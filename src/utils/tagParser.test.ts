import { describe, it, expect } from 'vitest'
import { parseTags, formatTags, extractAllTags } from './tagParser'

describe('parseTags', () => {
    it('extracts tags from content', () => {
        const result = parseTags('went to #gym did #squats')
        expect(result.tags).toEqual(['gym', 'squats'])
    })

    it('normalizes tags to lowercase', () => {
        const result = parseTags('#TypeScript is great')
        expect(result.tags).toEqual(['typescript'])
    })

    it('deduplicates tags', () => {
        const result = parseTags('#gym morning #gym evening')
        expect(result.tags).toEqual(['gym'])
    })

    it('removes tags from cleanContent', () => {
        const result = parseTags('hello #world foo')
        expect(result.cleanContent).toBe('hello foo')
    })

    it('preserves newlines in cleanContent', () => {
        const result = parseTags('line1 #tag1\nline2 #tag2')
        expect(result.cleanContent).toBe('line1\nline2')
    })

    it('returns empty tags for content without tags', () => {
        const result = parseTags('just plain text')
        expect(result.tags).toEqual([])
        expect(result.cleanContent).toBe('just plain text')
    })

    it('handles empty string', () => {
        const result = parseTags('')
        expect(result.tags).toEqual([])
        expect(result.cleanContent).toBe('')
    })

    it('supports hyphens and underscores in tags', () => {
        const result = parseTags('#my-tag #my_tag')
        expect(result.tags).toEqual(['my-tag', 'my_tag'])
    })
})

describe('formatTags', () => {
    it('formats tags with # prefix', () => {
        expect(formatTags(['gym', 'workout'])).toBe('#gym #workout')
    })

    it('returns empty string for empty array', () => {
        expect(formatTags([])).toBe('')
    })

    it('returns empty string for null/undefined', () => {
        expect(formatTags(null as unknown as string[])).toBe('')
    })
})

describe('extractAllTags', () => {
    it('counts tag occurrences across entries', () => {
        const entries = [
            { tags: ['gym', 'health'] },
            { tags: ['gym', 'work'] },
            { tags: ['health'] },
        ]
        const result = extractAllTags(entries)
        expect(result).toEqual([
            { tag: 'gym', count: 2 },
            { tag: 'health', count: 2 },
            { tag: 'work', count: 1 },
        ])
    })

    it('sorts by count descending', () => {
        const entries = [
            { tags: ['rare'] },
            { tags: ['common', 'rare'] },
            { tags: ['common'] },
            { tags: ['common'] },
        ]
        const result = extractAllTags(entries)
        expect(result[0]).toEqual({ tag: 'common', count: 3 })
        expect(result[1]).toEqual({ tag: 'rare', count: 2 })
    })

    it('handles entries without tags', () => {
        const entries = [{ tags: ['a'] }, {}, { tags: undefined }]
        const result = extractAllTags(entries)
        expect(result).toEqual([{ tag: 'a', count: 1 }])
    })

    it('returns empty array for no entries', () => {
        expect(extractAllTags([])).toEqual([])
    })
})
