import { useCallback } from 'react'
import { getApiBase } from './useCloudAuth'

export interface CleanupResult {
    deleted: string[]
    kept: string[]
}

/**
 * Handles image upload to R2 and unreferenced image cleanup.
 * Extracted from useCloudSync for separation of concerns.
 */
export function useImageUpload(tokenRef: React.MutableRefObject<string | null>) {

    // Upload image to R2
    const uploadImage = useCallback(async (file: File): Promise<string> => {
        if (!tokenRef.current) {
            throw new Error('Not logged in')
        }

        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch(`${getApiBase()}/api/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${tokenRef.current}`,
            },
            body: formData,
        })

        if (!response.ok) {
            const error = await response.json() as { error?: string }
            throw new Error(error.error || 'Upload failed')
        }

        const result = await response.json() as { url: string }
        return result.url
    }, [tokenRef])

    // Cleanup unreferenced images from R2
    const cleanupImages = useCallback(async (): Promise<CleanupResult> => {
        if (!tokenRef.current) {
            throw new Error('Not logged in')
        }

        const response = await fetch(`${getApiBase()}/api/cleanup`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${tokenRef.current}`,
            },
        })

        if (!response.ok) {
            const error = await response.json() as { error?: string }
            throw new Error(error.error || 'Cleanup failed')
        }

        return await response.json() as CleanupResult
    }, [tokenRef])

    return { uploadImage, cleanupImages }
}
