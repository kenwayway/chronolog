/**
 * Retrospective — weighted random resurfacing of past entries.
 *
 * The pool is deliberately narrow: an entry earns a place only if the user
 * actually wrote something in it, long enough ago that seeing it again is a
 * surprise rather than a scroll. Weighting then biases the draw toward the
 * entries worth re-reading — older, richer, or landing on an anniversary —
 * instead of treating every candidate as equally interesting.
 *
 * Everything here is pure and synchronous: the timeline is already in memory,
 * so a draw never touches the network, IndexedDB, or the sync protocol.
 */

import type { TimelineItem } from '@/types'

const DAY_MS = 86_400_000

/** Entries younger than this are still fresh in memory — no surprise value. */
export const MIN_AGE_DAYS = 30

/** Below this many characters of prose an entry is a marker, not a memory. */
export const MIN_PROSE_LENGTH = 24

/** How far the calendar day may drift and still count as an anniversary. */
const ANNIVERSARY_DAY_TOLERANCE = 1

/** Attachment lines (📍 location, 🖼 image) carry no prose. */
const ATTACHMENT_LINE_RE = /^(?:🖼[︎️]?|📍)/

export type RetroAnniversary =
    | { kind: 'year'; count: number }
    | { kind: 'month'; count: number }

export interface RetroCandidate {
    item: TimelineItem
    /** Whole days between the entry and the reference time. */
    ageDays: number
    anniversary: RetroAnniversary | null
    /** Relative likelihood of being drawn; always > 0. */
    weight: number
}

export interface RetroPoolOptions {
    /** Reference "now", so callers and tests control the clock. */
    now: number
    /** Recently drawn item IDs to avoid repeating. */
    excludeIds?: readonly string[]
}

/**
 * Length of an entry's actual prose, ignoring attachment lines. A photo with
 * a location pin but no words is not something worth resurfacing.
 */
export function retroProseLength(content: string): number {
    return content
        .split('\n')
        .filter(line => !ATTACHMENT_LINE_RE.test(line.trim()))
        .join('')
        .trim()
        .length
}

/** Calendar months from `from` to `to`, ignoring day of month. */
function monthsApart(from: Date, to: Date): number {
    return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
}

/**
 * Whether the entry falls on a monthly or yearly anniversary of the reference
 * date, within a day's tolerance.
 */
export function detectAnniversary(timestamp: number, now: number): RetroAnniversary | null {
    const then = new Date(timestamp)
    const today = new Date(now)
    if (Math.abs(today.getDate() - then.getDate()) > ANNIVERSARY_DAY_TOLERANCE) return null

    const months = monthsApart(then, today)
    if (months <= 0) return null
    if (months % 12 === 0) return { kind: 'year', count: months / 12 }
    return { kind: 'month', count: months }
}

/**
 * Older entries win, but on a log scale: a five-year-old note should be
 * favoured over a two-month-old one without swamping the pool entirely.
 * Returns 1 at exactly MIN_AGE_DAYS and grows by 1 per doubling of age.
 */
function ageWeight(ageDays: number): number {
    return 1 + Math.log2(Math.max(ageDays, MIN_AGE_DAYS) / MIN_AGE_DAYS)
}

/** Entries carrying photos, links, tags, or structure re-read better. */
function richnessWeight(item: TimelineItem): number {
    let weight = 1
    if (item.content.includes('🖼')) weight += 0.6
    if (item.linkedItems?.length) weight += 0.5
    if (item.tags?.length) weight += 0.3
    if (item.contentType && item.contentType !== 'note') weight += 0.4
    return weight
}

function anniversaryWeight(anniversary: RetroAnniversary | null): number {
    if (!anniversary) return 1
    return anniversary.kind === 'year' ? 4 : 1.8
}

/**
 * Whether an entry may ever be drawn. Zaddy observations are excluded: they
 * are ambient AI capture, and mixing them in dilutes the hand-written record
 * that gives a retrospective its point.
 */
export function isRetroEligible(item: TimelineItem, now: number): boolean {
    if (item.origin === 'zaddy') return false
    if (item.timestamp > now) return false
    if ((now - item.timestamp) / DAY_MS < MIN_AGE_DAYS) return false
    return retroProseLength(item.content) >= MIN_PROSE_LENGTH
}

/**
 * Eligible entries with their draw weights, newest first.
 *
 * When `excludeIds` would empty the pool the exclusions are dropped rather
 * than returning nothing — a small history is better than a dead page.
 */
export function buildRetroPool(
    items: readonly TimelineItem[],
    { now, excludeIds }: RetroPoolOptions,
): RetroCandidate[] {
    const candidates: RetroCandidate[] = []

    for (const item of items) {
        if (!isRetroEligible(item, now)) continue
        const ageDays = Math.floor((now - item.timestamp) / DAY_MS)
        const anniversary = detectAnniversary(item.timestamp, now)
        candidates.push({
            item,
            ageDays,
            anniversary,
            weight: ageWeight(ageDays) * richnessWeight(item) * anniversaryWeight(anniversary),
        })
    }

    if (!excludeIds?.length) return candidates

    const excluded = new Set(excludeIds)
    const fresh = candidates.filter(candidate => !excluded.has(candidate.item.id))
    return fresh.length > 0 ? fresh : candidates
}

/**
 * Draw one candidate, each weighted by its share of the total.
 * `random` is injectable so the draw can be pinned in tests.
 */
export function drawRetroCandidate(
    pool: readonly RetroCandidate[],
    random: () => number = Math.random,
): RetroCandidate | null {
    if (pool.length === 0) return null

    const total = pool.reduce((sum, candidate) => sum + candidate.weight, 0)
    if (!(total > 0)) return pool[0]

    let ticket = random() * total
    for (const candidate of pool) {
        ticket -= candidate.weight
        if (ticket < 0) return candidate
    }
    // Only reachable through floating-point drift at the very top of the range.
    return pool[pool.length - 1]
}

/** Human label for how long ago an entry happened. */
export function formatRetroAge(ageDays: number): string {
    if (ageDays < 60) return `${ageDays} DAYS AGO`
    const months = Math.round(ageDays / 30.44)
    if (months < 24) return `${months} MONTHS AGO`
    return `${(ageDays / 365.25).toFixed(1)} YEARS AGO`
}

/** Human label for an anniversary badge, or null when there is none. */
export function formatRetroAnniversary(anniversary: RetroAnniversary | null): string | null {
    if (!anniversary) return null
    if (anniversary.kind === 'year') {
        return anniversary.count === 1 ? 'ONE YEAR AGO TODAY' : `${anniversary.count} YEARS AGO TODAY`
    }
    return anniversary.count === 1 ? 'ONE MONTH AGO TODAY' : `${anniversary.count} MONTHS AGO TODAY`
}
