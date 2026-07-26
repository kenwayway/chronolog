import { describe, expect, it } from 'vitest'
import { appendAttachmentLines } from './attachments'

describe('appendAttachmentLines', () => {
    it('returns trimmed content untouched without attachments', () => {
        expect(appendAttachmentLines('  hello  ', {})).toBe('hello')
    })

    it('appends location and image lines in order', () => {
        expect(appendAttachmentLines('note', { location: 'Ottawa', imageUrl: '/api/image/a.jpg' }))
            .toBe('note\n📍 Ottawa\n🖼️ /api/image/a.jpg')
    })

    it('skips empty attachment values', () => {
        expect(appendAttachmentLines('note', { location: '', imageUrl: null })).toBe('note')
    })
})
