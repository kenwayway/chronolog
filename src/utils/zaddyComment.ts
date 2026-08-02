/**
 * Zaddy comments — zaddy-authored remarks about one existing entry.
 *
 * Ambient annotations (see `observe`) are time-anchored: they carry their own
 * timestamp and float in the timeline stream near whatever happened around
 * them. A comment is entry-anchored instead — the entry it points at is its
 * whole meaning — so it renders attached to that entry and never becomes a
 * timeline row, an annotation cluster member, or a retrospective candidate.
 *
 * Keep this file free of '@/' alias imports and runtime dependencies so both
 * tsconfig projects can consume it: functions/api/mcp.ts imports it directly.
 */

export const ZADDY_COMMENT_CONTENT_TYPE = 'zaddy-comment'

/** The structural shape both Note/Session and TimelineItem satisfy. */
interface ZaddyCommentShape {
    origin?: string
    contentType?: string
    linkedItems?: string[]
}

export function isZaddyComment(entry: ZaddyCommentShape): boolean {
    return entry.origin === 'zaddy' && entry.contentType === ZADDY_COMMENT_CONTENT_TYPE
}

/**
 * The single entry a comment is about, or undefined when it is not a comment.
 * A comment always carries exactly one link; the write path enforces it.
 */
export function zaddyCommentTargetId(entry: ZaddyCommentShape): string | undefined {
    return isZaddyComment(entry) ? entry.linkedItems?.[0] : undefined
}
