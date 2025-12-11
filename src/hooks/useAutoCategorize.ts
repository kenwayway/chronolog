import { useEffect, useRef } from 'react'
import type { Entry, ContentType, SessionActions } from '../types'
import type { CategorizeResult } from './useAICategories'
import { STORAGE_KEYS, getStorage, type CloudAuthData } from '../utils/storageService'

interface UseAutoCategorizeProps {
    entries: Entry[]
    contentTypes: ContentType[]
    isLoggedIn: boolean
    categorize: (content: string, token: string, contentTypes?: ContentType[]) => Promise<CategorizeResult>
    updateEntry: SessionActions['updateEntry']
}

/**
 * Custom hook that auto-categorizes new entries using AI
 * Extracted from App.jsx to reduce complexity
 */
export function useAutoCategorize({
    entries,
    contentTypes,
    isLoggedIn,
    categorize,
    updateEntry,
}: UseAutoCategorizeProps): void {
    const lastEntryCountRef = useRef(entries.length)

    useEffect(() => {
        const currentCount = entries.length

        // Only process when entries are added and user is logged in
        if (currentCount > lastEntryCountRef.current && isLoggedIn) {
            const newEntry = entries[entries.length - 1]

            // Only suggest for notes without existing category or contentType
            if (newEntry && newEntry.content && !newEntry.category && !newEntry.contentType) {
                // Get token from storage
                const auth = getStorage<CloudAuthData>(STORAGE_KEYS.CLOUD_AUTH)
                const token = auth?.token || null

                if (token) {
                    categorize(newEntry.content, token, contentTypes).then(result => {
                        const updates: Partial<Entry> = {}

                        if (result.category) {
                            updates.category = result.category
                        }
                        if (result.contentType && result.contentType !== 'note') {
                            updates.contentType = result.contentType
                        }
                        if (result.fieldValues) {
                            updates.fieldValues = result.fieldValues
                        }

                        if (Object.keys(updates).length > 0) {
                            updateEntry(newEntry.id, updates)
                        }
                    })
                }
            }
        }

        lastEntryCountRef.current = currentCount
    }, [entries.length, contentTypes, isLoggedIn, categorize, updateEntry])
}
