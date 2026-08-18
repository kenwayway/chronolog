import { describe, it, expect } from 'vitest'
import { formatDuration, generateId } from './formatters'

describe('formatDuration', () => {
    it('formats seconds only', () => {
        expect(formatDuration(5000)).toBe('5s')
        expect(formatDuration(0)).toBe('0s')
    })

    it('drops seconds once there is a minute to report', () => {
        expect(formatDuration(90_000)).toBe('1m')
        expect(formatDuration(60_000)).toBe('1m')
        expect(formatDuration(1_610_000)).toBe('26m')
    })

    it('stays within six characters so the meta column cannot wrap', () => {
        const widest = [59_000, 3_540_000, 43_140_000, 359_940_000]
        for (const ms of widest) {
            expect(formatDuration(ms).length).toBeLessThanOrEqual(6)
        }
    })

    it('formats hours and minutes', () => {
        expect(formatDuration(3_600_000)).toBe('1h 0m')
        expect(formatDuration(5_400_000)).toBe('1h 30m')
        expect(formatDuration(7_200_000)).toBe('2h 0m')
    })

    it('drops minutes past ten hours', () => {
        expect(formatDuration(37_800_000)).toBe('10h')
        expect(formatDuration(359_940_000)).toBe('99h')
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
