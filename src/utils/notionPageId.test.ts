import { describe, expect, it } from 'vitest'
import { normalizeNotionPageId, notionPageUrl } from './notionPageId'

const UUID = '12345678-90ab-cdef-1234-567890abcdef'
const COMPACT = '1234567890abcdef1234567890abcdef'

describe('normalizeNotionPageId', () => {
  it('normalizes compact and hyphenated page IDs', () => {
    expect(normalizeNotionPageId(COMPACT)).toBe(UUID)
    expect(normalizeNotionPageId(UUID.toUpperCase())).toBe(UUID)
  })

  it('extracts IDs from Notion page URLs', () => {
    expect(normalizeNotionPageId(`https://www.notion.so/My-task-${COMPACT}?v=abc`)).toBe(UUID)
    expect(normalizeNotionPageId(`https://workspace.notion.site/My-task-${COMPACT}`)).toBe(UUID)
    expect(normalizeNotionPageId(`https://app.notion.com/p/${COMPACT}`)).toBe(UUID)
  })

  it('rejects empty, malformed, and non-Notion URLs', () => {
    expect(normalizeNotionPageId('')).toBeNull()
    expect(normalizeNotionPageId('not-an-id')).toBeNull()
    expect(normalizeNotionPageId(`https://example.com/${COMPACT}`)).toBeNull()
  })
})

describe('notionPageUrl', () => {
  it('builds a stable Notion URL', () => {
    expect(notionPageUrl(UUID)).toBe(`https://www.notion.so/${COMPACT}`)
  })
})
