import { useCallback } from 'react'
import type { TimelineItem, SessionActions, TimelineItemUpdate, CategoryId } from '@/types'

interface UseEntryHandlersProps {
    actions: SessionActions
    isLoggedIn: boolean
}

interface EntryHandlers {
    requireLogin: () => boolean
    handleLogIn: (content: string, options?: { contentType?: string; fieldValues?: Record<string, unknown>; category?: CategoryId; tags?: string[] }) => void
    handleSwitch: (content: string, options?: { contentType?: string; fieldValues?: Record<string, unknown>; category?: CategoryId; tags?: string[] }) => void
    handleNote: (content: string, options?: { contentType?: string; fieldValues?: Record<string, unknown>; category?: CategoryId; tags?: string[] }) => void
    handleLogOff: (content: string) => void
    handleEditEntry: (item: TimelineItem, openModal: (item: TimelineItem) => void) => void
    handleSaveEdit: (item: TimelineItem, updates: TimelineItemUpdate) => void
    handleDeleteEntry: (item: TimelineItem) => void
    handleCopyEntry: (item: TimelineItem) => void
}

/**
 * Custom hook that extracts entry-related handlers from App.jsx
 * Reduces App.jsx complexity by encapsulating handler logic
 */
export function useEntryHandlers({
    actions,
    isLoggedIn,
}: UseEntryHandlersProps): EntryHandlers {

    // Check if user is logged in, show alert if not
    const requireLogin = useCallback(() => {
        if (!isLoggedIn) {
            alert('Please connect to cloud sync to edit. Go to Settings > Cloud Sync to login.')
            return false
        }
        return true
    }, [isLoggedIn])

    const handleLogIn = useCallback((content: string, options?: { contentType?: string; fieldValues?: Record<string, unknown>; category?: CategoryId; tags?: string[] }) => {
        actions.logIn(content, options)
    }, [actions])

    const handleSwitch = useCallback((content: string, options?: { contentType?: string; fieldValues?: Record<string, unknown>; category?: CategoryId; tags?: string[] }) => {
        actions.switchSession(content, options)
    }, [actions])

    const handleNote = useCallback((content: string, options?: { contentType?: string; fieldValues?: Record<string, unknown>; category?: CategoryId; tags?: string[] }) => {
        actions.addNote(content, options)
    }, [actions])

    const handleLogOff = useCallback((content: string) => {
        actions.logOff(content)
    }, [actions])

    const handleEditEntry = useCallback((item: TimelineItem, openModal: (item: TimelineItem) => void) => {
        openModal(item)
    }, [])

    const handleSaveEdit = useCallback((item: TimelineItem, updates: TimelineItemUpdate) => {
        const cleanUpdates = Object.fromEntries(
            Object.entries(updates).filter(([, v]) => v !== undefined)
        ) as TimelineItemUpdate
        if (Object.keys(cleanUpdates).length === 0) return

        if (item.kind === 'note') {
            actions.updateNote(item.entityId, cleanUpdates)
        } else if (item.kind === 'session-start') {
            const { timestamp, ...rest } = cleanUpdates
            actions.updateSession(item.entityId, {
                ...rest,
                startAt: timestamp,
            })
        } else {
            actions.updateSession(item.entityId, {
                endContent: cleanUpdates.content,
                endAt: cleanUpdates.timestamp,
                endTags: cleanUpdates.tags,
                linkedItems: cleanUpdates.linkedItems,
            })
        }
    }, [actions])

    const handleDeleteEntry = useCallback((item: TimelineItem) => {
        if (!requireLogin()) return
        const label = item.kind === 'note' ? 'note' : 'session'
        if (confirm(`Delete this ${label}?`)) {
            if (item.kind === 'note') actions.deleteNote(item.entityId)
            else actions.deleteSession(item.entityId)
        }
    }, [actions, requireLogin])

    const handleCopyEntry = useCallback((item: TimelineItem) => {
        navigator.clipboard.writeText(item.content || '')
    }, [])

    return {
        requireLogin,
        handleLogIn,
        handleSwitch,
        handleNote,
        handleLogOff,
        handleEditEntry,
        handleSaveEdit,
        handleDeleteEntry,
        handleCopyEntry,
    }
}
