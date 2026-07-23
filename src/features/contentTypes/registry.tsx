import type { ReactNode } from 'react'
import type {
  BookmarkFields,
  ContentType,
  MediaFields,
  MediaItem,
  MoodFields,
  NotionTaskFields,
  VaultFields,
  WorkoutFields,
  TimelineItem,
} from '@/types'
import type { ThemeConfig } from '@/themes'
import { normalizeNotionPageId } from '@/utils/notionPageId'
import {
  BookmarkDisplay,
  MediaDisplay,
  MoodDisplay,
  NotionTaskDisplay,
  VaultDisplay,
  WorkoutDisplay,
} from '@/components/timeline/ContentTypeDisplays'
import {
  BUILTIN_CONTENT_TYPE_DEFINITIONS,
  BUILTIN_CONTENT_TYPES,
} from './definitions'

type FieldValues = Record<string, unknown>
type TimelineSymbolKey = keyof ThemeConfig['symbols']

interface DisplayContext {
  item: TimelineItem
  mediaItems: MediaItem[]
}

interface NormalizationSuccess {
  ok: true
  fieldValues: FieldValues
}

interface NormalizationFailure {
  ok: false
  error: string
}

type NormalizationResult = NormalizationSuccess | NormalizationFailure

export interface ContentTypePlugin {
  definition: ContentType
  supportedTargets?: readonly ('note' | 'session')[]
  timelineSymbol?: TimelineSymbolKey
  normalize?: (fieldValues: FieldValues) => NormalizationResult
  render?: (context: DisplayContext) => ReactNode
}

export type ContentTypeSubmissionResult = NormalizationResult

const contentTypePlugins = [
  {
    definition: BUILTIN_CONTENT_TYPE_DEFINITIONS.note,
  },
  {
    definition: BUILTIN_CONTENT_TYPE_DEFINITIONS.bookmark,
    render: ({ item }: DisplayContext) => (
      <BookmarkDisplay fieldValues={item.fieldValues as BookmarkFields | undefined} />
    ),
  },
  {
    definition: BUILTIN_CONTENT_TYPE_DEFINITIONS.mood,
    render: ({ item }: DisplayContext) => (
      <MoodDisplay fieldValues={item.fieldValues as MoodFields | undefined} />
    ),
  },
  {
    definition: BUILTIN_CONTENT_TYPE_DEFINITIONS.workout,
    render: ({ item }: DisplayContext) => (
      <WorkoutDisplay fieldValues={item.fieldValues as WorkoutFields | undefined} />
    ),
  },
  {
    definition: BUILTIN_CONTENT_TYPE_DEFINITIONS.vault,
    render: ({ item }: DisplayContext) => (
      <VaultDisplay fieldValues={item.fieldValues as VaultFields | undefined} />
    ),
  },
  {
    definition: BUILTIN_CONTENT_TYPE_DEFINITIONS.beans,
    timelineSymbol: 'beans',
  },
  {
    definition: BUILTIN_CONTENT_TYPE_DEFINITIONS.sparks,
    timelineSymbol: 'sparks',
  },
  {
    definition: BUILTIN_CONTENT_TYPE_DEFINITIONS.media,
    render: ({ item, mediaItems }: DisplayContext) => (
      <MediaDisplay
        fieldValues={item.fieldValues as MediaFields | undefined}
        mediaItems={mediaItems}
      />
    ),
  },
  {
    definition: BUILTIN_CONTENT_TYPE_DEFINITIONS['notion-task'],
    supportedTargets: ['session'],
    normalize: (fieldValues: FieldValues): NormalizationResult => {
      const notionPageId = normalizeNotionPageId(fieldValues.notionPageId)
      if (!notionPageId) {
        return { ok: false, error: 'Enter a valid Notion task URL or page ID.' }
      }
      return { ok: true, fieldValues: { ...fieldValues, notionPageId } }
    },
    render: ({ item }: DisplayContext) => (
      <NotionTaskDisplay fieldValues={item.fieldValues as NotionTaskFields | undefined} />
    ),
  },
] satisfies readonly ContentTypePlugin[]

export const CONTENT_TYPE_REGISTRY: ReadonlyMap<string, ContentTypePlugin> = new Map(
  contentTypePlugins.map(plugin => [plugin.definition.id, plugin]),
)

export { BUILTIN_CONTENT_TYPES }

export function getContentTypePlugin(contentTypeId: string | null | undefined): ContentTypePlugin | undefined {
  return contentTypeId ? CONTENT_TYPE_REGISTRY.get(contentTypeId) : undefined
}

export function getContentTypeDefaultValues(contentTypeId: string | null | undefined): FieldValues {
  const plugin = getContentTypePlugin(contentTypeId)
  if (!plugin) return {}

  return Object.fromEntries(
    plugin.definition.fields
      .filter(field => field.default !== undefined)
      .map(field => [field.id, field.default]),
  )
}

export function getContentTypeTimelineSymbol(contentTypeId: string | null | undefined): TimelineSymbolKey | undefined {
  return getContentTypePlugin(contentTypeId)?.timelineSymbol
}

export function renderContentTypeDisplay(item: TimelineItem, mediaItems: MediaItem[]): ReactNode {
  return getContentTypePlugin(item.contentType)?.render?.({ item, mediaItems }) ?? null
}

export function prepareContentTypeSubmission(
  contentTypeId: string | null | undefined,
  fieldValues: FieldValues,
  target: 'note' | 'session',
): ContentTypeSubmissionResult {
  const plugin = getContentTypePlugin(contentTypeId)
  if (!plugin) return { ok: true, fieldValues }

  if (
    plugin.supportedTargets
    && !plugin.supportedTargets.includes(target)
  ) {
    return {
      ok: false,
      error: `${plugin.definition.name} can only be attached to a session start.`,
    }
  }

  const normalized = plugin.normalize?.(fieldValues) ?? { ok: true as const, fieldValues }
  if (!normalized.ok) return normalized

  const missingRequiredField = plugin.definition.fields.find(field => {
    if (!field.required) return false
    const value = normalized.fieldValues[field.id]
    return value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
  })
  if (missingRequiredField) {
    return { ok: false, error: `${missingRequiredField.name} is required.` }
  }

  return normalized
}
