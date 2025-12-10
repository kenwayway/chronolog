import { useCallback } from 'react';
import { useCloudSync } from './useCloudSync';
import { CATEGORIES } from '../utils/constants';

// Hook for AI-powered auto-categorization via backend API
export function useAICategories() {

    const categorize = useCallback(async (content, cloudSyncToken) => {
        if (!content || !cloudSyncToken) {
            return null;
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
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                console.error('Categorization failed:', error.error);
                return null;
            }

            const result = await response.json();
            return result.category || null;
        } catch (error) {
            console.error('Categorization error:', error);
            return null;
        }
    }, []);

    return { categorize };
}
