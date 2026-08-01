import { describe, expect, it } from 'vitest'
import {
    MIN_AGE_DAYS,
    buildRetroPool,
    detectAnniversary,
    drawRetroCandidate,
    formatRetroAge,
    formatRetroAnniversary,
    isRetroEligible,
    retroProseLength,
} from './retrospective'
import type { TimelineItem } from '@/types'

const DAY_MS = 86_400_000
const NOW = new Date(2026, 6, 15, 12, 0).getTime()

function makeItem(overrides: Partial<TimelineItem> = {}): TimelineItem {
    return {
        id: overrides.id ?? 'note:1',
        entityId: overrides.entityId ?? 'entity-1',
        kind: 'note',
        content: 'A long enough reflection to be worth resurfacing later.',
        timestamp: NOW - 200 * DAY_MS,
        ...overrides,
    }
}

describe('retroProseLength', () => {
    it('ignores attachment lines', () => {
        const content = '🖼️ https://example.com/a.png\n📍 Berlin, Germany'
        expect(retroProseLength(content)).toBe(0)
    })

    it('counts only the prose around attachments', () => {
        const content = 'hello\n🖼️ https://example.com/a.png\nworld'
        expect(retroProseLength(content)).toBe('helloworld'.length)
    })

    it('handles the image emoji with and without a variation selector', () => {
        expect(retroProseLength('🖼 https://example.com/a.png')).toBe(0)
        expect(retroProseLength('🖼️ https://example.com/a.png')).toBe(0)
    })
})

describe('isRetroEligible', () => {
    it('accepts an old entry with real prose', () => {
        expect(isRetroEligible(makeItem(), NOW)).toBe(true)
    })

    it('rejects zaddy observations', () => {
        expect(isRetroEligible(makeItem({ origin: 'zaddy' }), NOW)).toBe(false)
    })

    it('rejects entries younger than the minimum age', () => {
        const item = makeItem({ timestamp: NOW - (MIN_AGE_DAYS - 1) * DAY_MS })
        expect(isRetroEligible(item, NOW)).toBe(false)
    })

    it('accepts an entry exactly at the minimum age', () => {
        const item = makeItem({ timestamp: NOW - MIN_AGE_DAYS * DAY_MS })
        expect(isRetroEligible(item, NOW)).toBe(true)
    })

    it('rejects entries that are only an attachment', () => {
        const item = makeItem({ content: '🖼️ https://example.com/a.png' })
        expect(isRetroEligible(item, NOW)).toBe(false)
    })

    it('rejects future-dated entries', () => {
        expect(isRetroEligible(makeItem({ timestamp: NOW + DAY_MS }), NOW)).toBe(false)
    })
})

describe('detectAnniversary', () => {
    it('detects a one-year anniversary', () => {
        const then = new Date(2025, 6, 15, 9, 0).getTime()
        expect(detectAnniversary(then, NOW)).toEqual({ kind: 'year', count: 1 })
    })

    it('detects a multi-month anniversary', () => {
        const then = new Date(2026, 3, 15, 9, 0).getTime()
        expect(detectAnniversary(then, NOW)).toEqual({ kind: 'month', count: 3 })
    })

    it('allows a one-day drift', () => {
        const then = new Date(2025, 6, 16, 9, 0).getTime()
        expect(detectAnniversary(then, NOW)).toEqual({ kind: 'year', count: 1 })
    })

    it('rejects a date that is not near the same day of month', () => {
        const then = new Date(2025, 6, 22, 9, 0).getTime()
        expect(detectAnniversary(then, NOW)).toBeNull()
    })

    it('rejects same-month entries with no elapsed month', () => {
        const then = new Date(2026, 6, 15, 1, 0).getTime()
        expect(detectAnniversary(then, NOW)).toBeNull()
    })
})

describe('buildRetroPool', () => {
    it('keeps only eligible entries', () => {
        const pool = buildRetroPool(
            [
                makeItem({ id: 'keep' }),
                makeItem({ id: 'too-new', timestamp: NOW - DAY_MS }),
                makeItem({ id: 'zaddy', origin: 'zaddy' }),
                makeItem({ id: 'empty', content: '📍 Berlin' }),
            ],
            { now: NOW },
        )
        expect(pool.map(candidate => candidate.item.id)).toEqual(['keep'])
    })

    it('weights an older entry above a newer one', () => {
        const [recent, ancient] = buildRetroPool(
            [
                makeItem({ id: 'recent', timestamp: NOW - 40 * DAY_MS }),
                makeItem({ id: 'ancient', timestamp: NOW - 900 * DAY_MS }),
            ],
            { now: NOW },
        )
        expect(ancient.weight).toBeGreaterThan(recent.weight)
    })

    it('weights a richer entry above a plain one of the same age', () => {
        const [plain, rich] = buildRetroPool(
            [
                makeItem({ id: 'plain' }),
                makeItem({
                    id: 'rich',
                    content: 'A long enough reflection to be worth resurfacing later.\n🖼️ https://example.com/a.png',
                    tags: ['travel'],
                    linkedItems: ['note:99'],
                    contentType: 'mood',
                }),
            ],
            { now: NOW },
        )
        expect(rich.weight).toBeGreaterThan(plain.weight)
    })

    it('boosts an entry landing on a year anniversary', () => {
        const anniversaryTimestamp = new Date(2025, 6, 15, 9, 0).getTime()
        const [ordinary, anniversary] = buildRetroPool(
            [
                makeItem({ id: 'ordinary', timestamp: new Date(2025, 6, 22, 9, 0).getTime() }),
                makeItem({ id: 'anniversary', timestamp: anniversaryTimestamp }),
            ],
            { now: NOW },
        )
        expect(anniversary.anniversary).toEqual({ kind: 'year', count: 1 })
        expect(anniversary.weight).toBeGreaterThan(ordinary.weight)
    })

    it('drops recently shown entries', () => {
        const pool = buildRetroPool(
            [makeItem({ id: 'a' }), makeItem({ id: 'b' })],
            { now: NOW, excludeIds: ['a'] },
        )
        expect(pool.map(candidate => candidate.item.id)).toEqual(['b'])
    })

    it('ignores exclusions rather than returning an empty pool', () => {
        const pool = buildRetroPool(
            [makeItem({ id: 'a' }), makeItem({ id: 'b' })],
            { now: NOW, excludeIds: ['a', 'b'] },
        )
        expect(pool.map(candidate => candidate.item.id)).toEqual(['a', 'b'])
    })
})

describe('drawRetroCandidate', () => {
    it('returns null for an empty pool', () => {
        expect(drawRetroCandidate([], () => 0.5)).toBeNull()
    })

    it('picks by weighted share of the range', () => {
        const pool = buildRetroPool(
            [makeItem({ id: 'a' }), makeItem({ id: 'b' }), makeItem({ id: 'c' })],
            { now: NOW },
        )
        // Equal weights, so the range splits into equal thirds.
        expect(drawRetroCandidate(pool, () => 0)!.item.id).toBe('a')
        expect(drawRetroCandidate(pool, () => 0.5)!.item.id).toBe('b')
        expect(drawRetroCandidate(pool, () => 0.99)!.item.id).toBe('c')
    })

    it('never runs off the end of the pool', () => {
        const pool = buildRetroPool([makeItem({ id: 'only' })], { now: NOW })
        expect(drawRetroCandidate(pool, () => 1)!.item.id).toBe('only')
    })

    it('favours the heavier candidate over many draws', () => {
        const pool = buildRetroPool(
            [
                makeItem({ id: 'light', timestamp: NOW - 30 * DAY_MS }),
                makeItem({ id: 'heavy', timestamp: NOW - 1000 * DAY_MS }),
            ],
            { now: NOW },
        )
        let heavy = 0
        for (let i = 0; i < 1000; i++) {
            if (drawRetroCandidate(pool, () => i / 1000)!.item.id === 'heavy') heavy++
        }
        expect(heavy).toBeGreaterThan(500)
    })
})

describe('formatting', () => {
    it('formats ages across the day, month, and year bands', () => {
        expect(formatRetroAge(45)).toBe('45 DAYS AGO')
        expect(formatRetroAge(200)).toBe('7 MONTHS AGO')
        expect(formatRetroAge(900)).toBe('2.5 YEARS AGO')
    })

    it('formats anniversaries, singular and plural', () => {
        expect(formatRetroAnniversary(null)).toBeNull()
        expect(formatRetroAnniversary({ kind: 'year', count: 1 })).toBe('ONE YEAR AGO TODAY')
        expect(formatRetroAnniversary({ kind: 'year', count: 3 })).toBe('3 YEARS AGO TODAY')
        expect(formatRetroAnniversary({ kind: 'month', count: 1 })).toBe('ONE MONTH AGO TODAY')
        expect(formatRetroAnniversary({ kind: 'month', count: 5 })).toBe('5 MONTHS AGO TODAY')
    })
})
