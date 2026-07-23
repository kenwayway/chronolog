import { describe, expect, it } from 'vitest'
import {
  BUILTIN_CONTENT_TYPE_DEFINITIONS,
  BUILTIN_CONTENT_TYPES,
  CONTENT_TYPE_REGISTRY,
  getContentTypeDefaultValues,
  getContentTypeTimelineSymbol,
  prepareContentTypeSubmission,
} from './index'

const NOTION_PAGE_ID = '12345678-90ab-cdef-1234-567890abcdef'

describe('content type registry', () => {
  it('registers every built-in definition exactly once', () => {
    const definitionIds = BUILTIN_CONTENT_TYPES.map(type => type.id)

    expect(new Set(definitionIds).size).toBe(definitionIds.length)
    expect([...CONTENT_TYPE_REGISTRY.keys()]).toEqual(definitionIds)
    expect(Object.keys(BUILTIN_CONTENT_TYPE_DEFINITIONS)).toEqual(definitionIds)
  })

  it('derives initial field values from schema defaults', () => {
    expect(getContentTypeDefaultValues('bookmark')).toEqual({
      type: 'Article',
      status: 'Inbox',
    })
    expect(getContentTypeDefaultValues('mood')).toEqual({
      feeling: 'Calm',
      energy: 3,
    })
    expect(getContentTypeDefaultValues('workout')).toEqual({
      workoutType: 'Strength',
    })
    expect(getContentTypeDefaultValues('media')).toEqual({})
    expect(getContentTypeDefaultValues('custom')).toEqual({})
  })

  it('keeps content-type-specific timeline symbols in the registry', () => {
    expect(getContentTypeTimelineSymbol('beans')).toBe('beans')
    expect(getContentTypeTimelineSymbol('sparks')).toBe('sparks')
    expect(getContentTypeTimelineSymbol('bookmark')).toBeUndefined()
  })

  it('normalizes a valid Notion task and limits it to session starts', () => {
    expect(prepareContentTypeSubmission(
      'notion-task',
      { notionPageId: `https://www.notion.so/Task-${NOTION_PAGE_ID.replace(/-/g, '')}` },
      'session',
    )).toEqual({
      ok: true,
      fieldValues: { notionPageId: NOTION_PAGE_ID },
    })

    expect(prepareContentTypeSubmission(
      'notion-task',
      { notionPageId: NOTION_PAGE_ID },
      'note',
    )).toEqual({
      ok: false,
      error: 'Task can only be attached to a session start.',
    })

  })

  it('rejects malformed required Notion values and preserves custom types', () => {
    expect(prepareContentTypeSubmission(
      'notion-task',
      { notionPageId: 'not-a-page' },
      'session',
    )).toEqual({
      ok: false,
      error: 'Enter a valid Notion task URL or page ID.',
    })

    expect(prepareContentTypeSubmission(
      'custom',
      { anything: 42 },
      'note',
    )).toEqual({
      ok: true,
      fieldValues: { anything: 42 },
    })
  })
})
