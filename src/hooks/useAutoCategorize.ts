import { useEffect, useRef } from 'react'
import type { TimelineItem, ContentType, SessionActions, TimelineItemUpdate } from '@/types'
import type { CategorizeResult } from './useAICategories'
import { STORAGE_KEYS, getStorage, type CloudAuthData } from '@/utils/storageService'

interface UseAutoCategorizeProps {
    items: TimelineItem[]
    contentTypes: ContentType[]
    isLoggedIn: boolean
    categorize: (content: string, token: string, contentTypes?: ContentType[]) => Promise<CategorizeResult>
    updateNote: SessionActions['updateNote']
    updateSession: SessionActions['updateSession']
}

/**
 * Custom hook that auto-categorizes new entries using AI
 * Extracted from App.jsx to reduce complexity
 */
export function useAutoCategorize({
    items,
    contentTypes,
    isLoggedIn,
    categorize,
    updateNote,
    updateSession,
}: UseAutoCategorizeProps): void {
    const seenEntityIds = useRef(new Set(items.map(item => item.entityId)))

    useEffect(() => {
        const candidates = items.filter(item =>
            item.kind !== 'session-end' && !seenEntityIds.current.has(item.entityId),
        )
        items.forEach(item => seenEntityIds.current.add(item.entityId))

        if (isLoggedIn) {
            candidates.forEach(item => {
            if (item.content && !item.category && !item.contentType) {
                // Get token from storage
                const auth = getStorage<CloudAuthData>(STORAGE_KEYS.CLOUD_AUTH)
                const token = auth?.token || null

                if (token) {
                    categorize(item.content, token, contentTypes).then(result => {
                        const updates: TimelineItemUpdate = {}

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
                            if (item.kind === 'note') updateNote(item.entityId, updates)
                            else updateSession(item.entityId, updates)
                        }
                    })
                }
            }
            })
        }
    }, [items, contentTypes, isLoggedIn, categorize, updateNote, updateSession])
}
