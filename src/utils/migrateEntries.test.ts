import { describe, it, expect } from 'vitest'
import { migrateEntries } from './migrateEntries'
import type { Entry, ContentType } from '@/types'

// Minimal content types for testing
const testContentTypes: ContentType[] = [
    { id: 'note', name: 'Note', fields: [], builtIn: true },
    { id: 'task', name: 'Task', fields: [{ id: 'done', name: 'Done', type: 'boolean' }], builtIn: true },
    {
        id: 'workout', name: 'Workout', fields: [
            { id: 'workoutType', name: 'Type', type: 'dropdown', options: ['Strength', 'Cardio'] },
            { id: 'duration', name: 'Duration', type: 'number' },
        ], builtIn: true
    },
]

function makeEntry(overrides: Partial<Entry>): Entry {
    return {
        id: 'test-1',
        type: 'NOTE',
        content: 'test',
        timestamp: Date.now(),
        ...overrides,
    }
}

describe('migrateEntries', () => {
    it('migrates legacy beans category to contentType', () => {
        const entry = makeEntry({ category: 'beans' as any })
        const typesWithBeans = [...testContentTypes, { id: 'beans', name: 'Beans', fields: [] }]
        const result = migrateEntries([entry], typesWithBeans)
        expect(result[0].contentType).toBe('beans')
        expect(result[0].category).toBeUndefined()
    })

    it('migrates legacy sparks category to contentType', () => {
        const typesWithSparks = [...testContentTypes, { id: 'sparks', name: 'Sparks', fields: [] }]
        const entry = makeEntry({ category: 'sparks' as any })
        const result = migrateEntries([entry], typesWithSparks)
        expect(result[0].contentType).toBe('sparks')
        expect(result[0].category).toBeUndefined()
    })

    it('clears category on SESSION_END entries', () => {
        const entry = makeEntry({ type: 'SESSION_END', category: 'work' })
        const result = migrateEntries([entry], testContentTypes)
        expect(result[0].category).toBeUndefined()
    })

    it('clears invalid contentType references', () => {
        const entry = makeEntry({ contentType: 'nonexistent', fieldValues: { foo: 'bar' } })
        const result = migrateEntries([entry], testContentTypes)
        expect(result[0].contentType).toBeUndefined()
        expect(result[0].fieldValues).toBeUndefined()
    })

    it('clears orphaned fieldValues (fieldValues without contentType)', () => {
        const entry = makeEntry({ fieldValues: { something: true } })
        const result = migrateEntries([entry], testContentTypes)
        expect(result[0].fieldValues).toBeUndefined()
    })

    it('strips unknown fieldValues keys', () => {
        const entry = makeEntry({
            contentType: 'workout',
            fieldValues: { workoutType: 'Strength', duration: 30, unknownField: 'bad' },
        })
        const result = migrateEntries([entry], testContentTypes)
        const fv = result[0].fieldValues as Record<string, unknown>
        expect(fv.workoutType).toBe('Strength')
        expect(fv.duration).toBe(30)
        expect(fv.unknownField).toBeUndefined()
    })

    it('leaves valid entries unchanged', () => {
        const entry = makeEntry({
            contentType: 'task',
            fieldValues: { done: false },
            category: 'craft',
        })
        const result = migrateEntries([entry], testContentTypes)
        expect(result[0]).toBe(entry) // Same reference — no mutation
    })

    it('handles empty entries array', () => {
        expect(migrateEntries([], testContentTypes)).toEqual([])
    })
})
