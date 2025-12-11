import { useCallback } from 'react'
import type { CategoryId, ContentType } from '../types'
import { CATEGORIES, BUILTIN_CONTENT_TYPES } from '../utils/constants'

export interface CategorizeResult {
    category: CategoryId | null
    contentType: string | null
    fieldValues: Record<string, unknown> | null
    raw?: string
}

interface UseAICategoriesReturn {
    categorize: (content: string, cloudSyncToken: string | null, contentTypes?: ContentType[]) => Promise<CategorizeResult>
}

// Hook for AI-powered auto-categorization and content type detection via backend API
export function useAICategories(): UseAICategoriesReturn {

    const categorize = useCallback(async (
        content: string,
        cloudSyncToken: string | null,
        contentTypes?: ContentType[]
    ): Promise<CategorizeResult> => {
        const emptyResult: CategorizeResult = { category: null, contentType: null, fieldValues: null }

        if (!content || !cloudSyncToken) {
            return emptyResult
        }

        try {
            const response = await fetch('/api/categorize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${cloudSyncToken}`,
                },
                body: JSON.stringify({
                    content,
                    categories: CATEGORIES,
                    contentTypes: contentTypes || BUILTIN_CONTENT_TYPES,
                }),
            })

            if (!response.ok) {
                const error = await response.json().catch(() => ({}))
                console.error('Categorization failed:', error.error)
                return emptyResult
            }

            const result: CategorizeResult = await response.json()
            return {
                category: result.category || null,
                contentType: result.contentType || null,
                fieldValues: result.fieldValues || null,
                raw: result.raw,
            }
        } catch (error) {
            console.error('Categorization error:', error)
            return emptyResult
        }
    }, [])

    return { categorize }
}
