import { describe, it, expect } from 'vitest'
import { formatDuration, generateId } from './formatters'

describe('formatDuration', () => {
    it('formats seconds only', () => {
        expect(formatDuration(5000)).toBe('5s')
        expect(formatDuration(0)).toBe('0s')
    })

    it('formats minutes and seconds', () => {
        expect(formatDuration(90_000)).toBe('1m 30s')
        expect(formatDuration(60_000)).toBe('1m 0s')
    })

    it('formats hours and minutes', () => {
        expect(formatDuration(3_600_000)).toBe('1h 0m')
        expect(formatDuration(5_400_000)).toBe('1h 30m')
        expect(formatDuration(7_200_000)).toBe('2h 0m')
    })

    it('truncates sub-second durations to 0s', () => {
        expect(formatDuration(500)).toBe('0s')
        expect(formatDuration(999)).toBe('0s')
    })
})

describe('generateId', () => {
    it('generates unique IDs', () => {
        const ids = new Set(Array.from({ length: 100 }, () => generateId()))
        expect(ids.size).toBe(100)
    })

    it('includes timestamp component', () => {
        const before = Date.now()
        const id = generateId()
        const timestamp = parseInt(id.split('-')[0], 10)
        expect(timestamp).toBeGreaterThanOrEqual(before)
    })

    it('returns a non-empty string', () => {
        const id = generateId()
        expect(id.length).toBeGreaterThan(0)
        expect(typeof id).toBe('string')
    })
})
