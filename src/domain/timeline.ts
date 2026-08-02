import type { Note, Session, TimelineItem } from '@/types'
import { zaddyCommentTargetId } from '@/utils/zaddyComment'

export function sessionStartTimelineId(sessionId: string): string {
  return `session:${sessionId}:start`
}

export function sessionEndTimelineId(sessionId: string): string {
  return `session:${sessionId}:end`
}

/** Build timeline-only boundary views from first-class notes and sessions. */
export function projectTimelineItems(notes: Note[], sessions: Session[]): TimelineItem[] {
  const items: TimelineItem[] = notes.map(note => ({
    ...note,
    id: note.id,
    entityId: note.id,
    kind: 'note',
  }))

  for (const session of sessions) {
    items.push({
      id: sessionStartTimelineId(session.id),
      entityId: session.id,
      kind: 'session-start',
      content: session.content,
      timestamp: session.startAt,
      sessionId: session.id,
      category: session.category,
      contentType: session.contentType,
      fieldValues: session.fieldValues,
      linkedItems: session.linkedItems,
      tags: session.tags,
      origin: session.origin,
    })

    if (session.endAt !== null) {
      items.push({
        id: sessionEndTimelineId(session.id),
        entityId: session.id,
        kind: 'session-end',
        content: session.endContent || '',
        timestamp: session.endAt,
        sessionId: session.id,
        linkedItems: session.linkedItems,
        tags: session.endTags,
        origin: session.origin,
      })
    }
  }

  return items.sort((left, right) => left.timestamp - right.timestamp)
}

/** Resolve a domain ID to its canonical timeline view (session start or note). */
export function timelineItemForEntity(items: TimelineItem[], entityId: string): TimelineItem | undefined {
  return items.find(item =>
    item.entityId === entityId && (item.kind === 'note' || item.kind === 'session-start')
  )
}

export interface TimelineLinkIndex {
  /** Canonical (non-session-end) timeline item per entity ID. */
  byEntityId: Map<string, TimelineItem>
  /** Entity IDs whose linkedItems point at the keyed entity. */
  incoming: Map<string, string[]>
}

/**
 * Precompute link lookups once per projection so each rendered timeline row
 * resolves its links in O(own links) instead of scanning all history.
 *
 * Zaddy comments are skipped entirely: their link to their target is an
 * anchor, not a cross-reference, and surfacing it as a link chip would let a
 * comment alter how the entry it is about renders.
 */
export function buildTimelineLinkIndex(items: TimelineItem[]): TimelineLinkIndex {
  const byEntityId = new Map<string, TimelineItem>()
  const incomingSets = new Map<string, Set<string>>()

  for (const item of items) {
    if (zaddyCommentTargetId(item)) continue
    if (item.kind !== 'session-end' && !byEntityId.has(item.entityId)) {
      byEntityId.set(item.entityId, item)
    }
    if (!item.linkedItems) continue
    for (const target of item.linkedItems) {
      if (target === item.entityId) continue
      let sources = incomingSets.get(target)
      if (!sources) incomingSets.set(target, sources = new Set())
      sources.add(item.entityId)
    }
  }

  const incoming = new Map<string, string[]>()
  incomingSets.forEach((sources, target) => incoming.set(target, [...sources]))
  return { byEntityId, incoming }
}

/** Zaddy comments grouped by the entity they are about, oldest first. */
export type ZaddyCommentIndex = ReadonlyMap<string, TimelineItem[]>

/**
 * Build the comment index from the full projection rather than a filtered
 * view: a comment carries no category or tags of its own, so filtering it
 * alongside ordinary entries would silently strip it off a visible target.
 */
export function buildZaddyCommentIndex(items: TimelineItem[]): ZaddyCommentIndex {
  const byTarget = new Map<string, TimelineItem[]>()

  for (const item of items) {
    const targetId = zaddyCommentTargetId(item)
    if (!targetId) continue
    const existing = byTarget.get(targetId)
    if (existing) existing.push(item)
    else byTarget.set(targetId, [item])
  }

  for (const comments of byTarget.values()) {
    comments.sort((left, right) => left.timestamp - right.timestamp)
  }
  return byTarget
}
