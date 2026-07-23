import { describe, expect, it } from 'vitest'
import type { Category, ContentType, TimelineItem, MediaItem } from '@/types'
import { searchEntries } from './searchEntries'

const entries: TimelineItem[] = [
    {
        id: 'older',
        entityId: 'older',
        kind: 'note',
        content: 'Read React compiler notes',
        timestamp: 100,
        category: 'craft',
        contentType: 'bookmark',
        tags: ['frontend'],
        fieldValues: { title: 'React documentation', status: 'Reading' },
    },
    {
        id: 'newer',
        entityId: 'newer',
        kind: 'note',
        content: 'Evening reading session',
        timestamp: 200,
        category: 'wander',
        contentType: 'media',
        tags: ['relax'],
        fieldValues: { mediaId: 'book-1' },
    },
]

const categories: Category[] = [
    { id: 'craft', label: 'Craft', color: '#000', description: 'Coding and creating' },
    { id: 'wander', label: 'Wander', color: '#111', description: 'Travel and relaxation' },
]

const contentTypes: ContentType[] = [
    { id: 'bookmark', name: 'Bookmark', fields: [] },
    { id: 'media', name: 'Media', fields: [] },
]

const mediaItems: MediaItem[] = [
    { id: 'book-1', title: 'The Left Hand of Darkness', mediaType: 'Book', createdAt: 1 },
]

const context = { categories, contentTypes, mediaItems }

describe('searchEntries', () => {
    it('searches content, tags, and structured field values', () => {
        expect(searchEntries(entries, 'react Reading', context).map(entry => entry.id)).toEqual(['older'])
        expect(searchEntries(entries, 'frontend', context).map(entry => entry.id)).toEqual(['older'])
    })

    it('searches category and content type labels', () => {
        expect(searchEntries(entries, 'coding bookmark', context).map(entry => entry.id)).toEqual(['older'])
    })

    it('resolves media IDs to media library titles', () => {
        expect(searchEntries(entries, 'left hand darkness', context).map(entry => entry.id)).toEqual(['newer'])
    })

    it('normalizes case and full-width characters', () => {
        expect(searchEntries(entries, 'ＲＥＡＣＴ', context).map(entry => entry.id)).toEqual(['older'])
    })

    it('uses AND matching and sorts newest first', () => {
        expect(searchEntries(entries, 'reading', context).map(entry => entry.id)).toEqual(['newer', 'older'])
        expect(searchEntries(entries, 'reading frontend', context).map(entry => entry.id)).toEqual(['older'])
    })

    it('returns no results for an empty query', () => {
        expect(searchEntries(entries, '   ', context)).toEqual([])
    })
})
