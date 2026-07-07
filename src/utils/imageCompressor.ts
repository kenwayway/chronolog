/**
 * Client-side image compression before upload.
 *
 * Conservative profile: keep the original resolution, re-encode as WebP at
 * quality 0.9 — visually indistinguishable from the source, typically 50-70%
 * smaller than camera JPEGs. Falls back to the original file whenever
 * compression wouldn't help or the browser can't do it.
 */

const COMPRESSIBLE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/** Files at or below this size are uploaded as-is (screenshots, icons, …) */
const MIN_COMPRESS_BYTES = 800 * 1024

const WEBP_QUALITY = 0.9

export function shouldCompress(file: File): boolean {
    // GIFs are excluded: canvas re-encode would drop the animation
    return COMPRESSIBLE_TYPES.includes(file.type) && file.size > MIN_COMPRESS_BYTES
}

export function webpFileName(originalName: string): string {
    const stem = originalName.replace(/\.[^.]+$/, '')
    return `${stem || 'image'}.webp`
}

export async function compressImage(file: File): Promise<File> {
    if (!shouldCompress(file)) return file

    try {
        // createImageBitmap applies EXIF orientation during decode, so the
        // canvas pixels come out upright and no EXIF needs to survive
        const bitmap = await createImageBitmap(file)

        const canvas = document.createElement('canvas')
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        const ctx = canvas.getContext('2d')
        if (!ctx) return file
        ctx.drawImage(bitmap, 0, 0)
        bitmap.close()

        const blob = await new Promise<Blob | null>(resolve =>
            canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY)
        )

        // toBlob silently falls back to PNG when WebP encoding is
        // unsupported; also skip if re-encoding didn't actually shrink it
        if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) {
            return file
        }

        return new File([blob], webpFileName(file.name), { type: 'image/webp' })
    } catch {
        // Decode failure (corrupt file, unsupported format) — upload original
        return file
    }
}
