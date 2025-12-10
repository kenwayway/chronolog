import { useCallback } from 'react'
import type { CategoryId } from '../types'
import { CATEGORIES } from '../utils/constants'

interface CategorizeResult {
    category: CategoryId | null
    raw?: string
}

interface UseAICategoriesReturn {
    categorize: (content: string, cloudSyncToken: string | null) => Promise<CategoryId | null>
}

// Hook for AI-powered auto-categorization via backend API
export function useAICategories(): UseAICategoriesReturn {

    const categorize = useCallback(async (content: string, cloudSyncToken: string | null): Promise<CategoryId | null> => {
        if (!content || !cloudSyncToken) {
            return null
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
                }),
            })

            if (!response.ok) {
                const error = await response.json().catch(() => ({}))
                console.error('Categorization failed:', error.error)
                return null
            }

            const result: CategorizeResult = await response.json()
            return result.category || null
        } catch (error) {
            console.error('Categorization error:', error)
            return null
        }
    }, [])

    return { categorize }
}
