import { describe, expect, it } from 'vitest'
import type { TimelineItem } from '@/types'
import { buildTimelineLinkIndex, buildZaddyCommentIndex } from './timeline'
import { ZADDY_COMMENT_CONTENT_TYPE, isZaddyComment, zaddyCommentTargetId } from '@/utils/zaddyComment'

function item(id: string, timestamp: number, overrides: Partial<TimelineItem> = {}): TimelineItem {
    return {
        id,
        entityId: id,
        kind: 'note',
        content: id,
        timestamp,
        ...overrides,
    }
}

function comment(id: string, timestamp: number, targetId: string): TimelineItem {
    return item(id, timestamp, {
        origin: 'zaddy',
        contentType: ZADDY_COMMENT_CONTENT_TYPE,
        linkedItems: [targetId],
    })
}

describe('isZaddyComment', () => {
    it('requires both zaddy authorship and the comment content type', () => {
        expect(isZaddyComment(comment('c1', 5, 'n1'))).toBe(true)
        expect(isZaddyComment(item('n1', 1))).toBe(false)
        expect(isZaddyComment(item('a1', 1, { origin: 'zaddy' }))).toBe(false)
        expect(isZaddyComment(item('n2', 1, { contentType: ZADDY_COMMENT_CONTENT_TYPE }))).toBe(false)
    })

    it('reads the anchor from the single link a comment carries', () => {
        expect(zaddyCommentTargetId(comment('c1', 5, 'n1'))).toBe('n1')
        expect(zaddyCommentTargetId(item('n1', 1, { linkedItems: ['n2'] }))).toBeUndefined()
    })
})

describe('buildZaddyCommentIndex', () => {
    it('groups comments under their target, oldest first', () => {
        const index = buildZaddyCommentIndex([
            item('n1', 1),
            comment('c2', 30, 'n1'),
            comment('c1', 20, 'n1'),
            comment('c3', 40, 's1'),
        ])

        expect(index.get('n1')?.map(entry => entry.id)).toEqual(['c1', 'c2'])
        expect(index.get('s1')?.map(entry => entry.id)).toEqual(['c3'])
    })

    it('ignores ambient annotations and ordinary linked entries', () => {
        const index = buildZaddyCommentIndex([
            item('a1', 10, { origin: 'zaddy' }),
            item('n2', 20, { linkedItems: ['n1'] }),
        ])

        expect(index.size).toBe(0)
    })
})

describe('buildTimelineLinkIndex with comments', () => {
    it('does not turn a comment anchor into a link on the commented entry', () => {
        const index = buildTimelineLinkIndex([
            item('n1', 1),
            comment('c1', 20, 'n1'),
        ])

        expect(index.incoming.get('n1')).toBeUndefined()
        expect(index.byEntityId.has('c1')).toBe(false)
    })

    it('still indexes ordinary links between entries', () => {
        const index = buildTimelineLinkIndex([
            item('n1', 1),
            item('n2', 20, { linkedItems: ['n1'] }),
        ])

        expect(index.incoming.get('n1')).toEqual(['n2'])
    })
})
