import { describe, it, expect } from 'vitest'
import { shouldCompress, webpFileName } from './imageCompressor'

function makeFile(sizeBytes: number, type: string, name = 'photo.jpg'): File {
    return new File([new Uint8Array(sizeBytes)], name, { type })
}

describe('shouldCompress', () => {
    it('compresses large jpeg/png/webp', () => {
        expect(shouldCompress(makeFile(2_000_000, 'image/jpeg'))).toBe(true)
        expect(shouldCompress(makeFile(2_000_000, 'image/png'))).toBe(true)
        expect(shouldCompress(makeFile(2_000_000, 'image/webp'))).toBe(true)
    })

    it('skips small files', () => {
        expect(shouldCompress(makeFile(500_000, 'image/jpeg'))).toBe(false)
    })

    it('skips gifs to preserve animation', () => {
        expect(shouldCompress(makeFile(5_000_000, 'image/gif'))).toBe(false)
    })

    it('skips non-image types', () => {
        expect(shouldCompress(makeFile(5_000_000, 'video/mp4'))).toBe(false)
    })
})

describe('webpFileName', () => {
    it('replaces the extension', () => {
        expect(webpFileName('IMG_1234.JPEG')).toBe('IMG_1234.webp')
        expect(webpFileName('a.b.c.png')).toBe('a.b.c.webp')
    })

    it('handles names without extension', () => {
        expect(webpFileName('pasted')).toBe('pasted.webp')
    })

    it('falls back for empty stem', () => {
        expect(webpFileName('.png')).toBe('image.webp')
    })
})
