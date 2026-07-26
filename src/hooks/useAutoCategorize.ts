import { useEffect, useRef } from 'react'
import type { TimelineItem, ContentType, SessionActions, TimelineItemUpdate } from '@/types'
import type { CategorizeResult } from './useAICategories'
import { prepareContentTypeSubmission } from '@/features/contentTypes'
import { STORAGE_KEYS, getStorage, type CloudAuthData } from '@/utils/storageService'

interface UseAutoCategorizeProps {
    items: TimelineItem[]
    contentTypes: ContentType[]
    isLoggedIn: boolean
    categorize: (
        content: string,
        token: string,
        contentTypes?: ContentType[],
        signal?: AbortSignal,
    ) => Promise<CategorizeResult>
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
    const latestItems = useRef(items)
    const abortRef = useRef<AbortController | null>(null)

    useEffect(() => {
        latestItems.current = items
    }, [items])

    // Abort in-flight categorization requests on unmount only; effect re-runs
    // must not cancel requests for entries that are still pending.
    useEffect(() => {
        const controller = new AbortController()
        abortRef.current = controller
        return () => controller.abort()
    }, [])

    useEffect(() => {
        const candidates = items.filter(item =>
            item.kind !== 'session-end' && !seenEntityIds.current.has(item.entityId),
        )
        items.forEach(item => seenEntityIds.current.add(item.entityId))

        if (!isLoggedIn) return
        candidates.forEach(item => {
            if (!item.content || item.category || item.contentType) return
            const auth = getStorage<CloudAuthData>(STORAGE_KEYS.CLOUD_AUTH)
            const token = auth?.token || null
            if (!token) return

            const requestedContent = item.content
            categorize(item.content, token, contentTypes, abortRef.current?.signal).then(result => {
                // Drop stale results: the entry may have been deleted, edited,
                // or manually categorized while the request was in flight.
                const current = latestItems.current.find(candidate =>
                    candidate.entityId === item.entityId && candidate.kind !== 'session-end',
                )
                if (!current || current.content !== requestedContent || current.category || current.contentType) {
                    return
                }

                const updates: TimelineItemUpdate = {}
                if (result.category) {
                    updates.category = result.category
                }
                // The model's suggestion goes through the same submission
                // validation as the UI: target constraints (e.g. notion-task
                // is session-only), normalization, and required fields.
                if (result.contentType && result.contentType !== 'note') {
                    const prepared = prepareContentTypeSubmission(
                        result.contentType,
                        result.fieldValues ?? {},
                        item.kind === 'note' ? 'note' : 'session',
                    )
                    if (prepared.ok) {
                        updates.contentType = result.contentType
                        if (Object.keys(prepared.fieldValues).length > 0) {
                            updates.fieldValues = prepared.fieldValues
                        }
                    } else {
                        console.warn(
                            `Auto-categorize dropped contentType "${result.contentType}": ${prepared.error}`,
                        )
                    }
                }

                if (Object.keys(updates).length > 0) {
                    if (item.kind === 'note') updateNote(item.entityId, updates)
                    else updateSession(item.entityId, updates)
                }
            })
        })
    }, [items, contentTypes, isLoggedIn, categorize, updateNote, updateSession])
}
