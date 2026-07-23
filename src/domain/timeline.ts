import type { Note, Session, TimelineItem } from '@/types'

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
