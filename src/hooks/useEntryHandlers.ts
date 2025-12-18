import { useCallback } from 'react'
import type { Entry, SessionActions, UpdateEntryPayload, CategoryId } from '../types'

interface UseEntryHandlersProps {
    actions: SessionActions
    isLoggedIn: boolean
    googleTasks: {
        isLoggedIn: boolean
        createTask: (title: string, entryId: string) => Promise<unknown>
    }
}

interface EntryHandlers {
    requireLogin: () => boolean
    handleLogIn: (content: string) => void
    handleSwitch: (content: string) => void
    handleNote: (content: string, options?: { contentType?: string; fieldValues?: Record<string, unknown>; category?: CategoryId; tags?: string[] }) => void
    handleLogOff: (content: string) => void
    handleEditEntry: (entry: Entry, openModal: (entry: Entry) => void) => void
    handleSaveEdit: (entryId: string, updates: UpdateEntryPayload) => void
    handleDeleteEntry: (entry: Entry) => void
    handleCopyEntry: (entry: Entry) => void
    handleMarkAsTask: (entry: Entry) => Promise<void>
    handleCompleteTask: (entryId: string | null, title: string) => void
}

/**
 * Custom hook that extracts entry-related handlers from App.jsx
 * Reduces App.jsx complexity by encapsulating handler logic
 */
export function useEntryHandlers({
    actions,
    isLoggedIn,
    googleTasks,
}: UseEntryHandlersProps): EntryHandlers {

    // Check if user is logged in, show alert if not
    const requireLogin = useCallback(() => {
        if (!isLoggedIn) {
            alert('Please connect to cloud sync to edit. Go to Settings > Cloud Sync to login.')
            return false
        }
        return true
    }, [isLoggedIn])

    const handleLogIn = useCallback((content: string) => {
        actions.logIn(content)
    }, [actions])

    const handleSwitch = useCallback((content: string) => {
        actions.switchSession(content)
    }, [actions])

    const handleNote = useCallback((content: string, options?: { contentType?: string; fieldValues?: Record<string, unknown>; category?: CategoryId; tags?: string[] }) => {
        actions.addNote(content, options)
    }, [actions])

    const handleLogOff = useCallback((content: string) => {
        actions.logOff(content)
    }, [actions])

    const handleEditEntry = useCallback((entry: Entry, openModal: (entry: Entry) => void) => {
        openModal(entry)
    }, [])

    const handleSaveEdit = useCallback((entryId: string, updates: UpdateEntryPayload) => {
        const cleanUpdates = Object.fromEntries(
            Object.entries(updates).filter(([, v]) => v !== undefined)
        ) as UpdateEntryPayload
        if (Object.keys(cleanUpdates).length > 0) {
            actions.updateEntry(entryId, cleanUpdates)
        }
    }, [actions])

    const handleDeleteEntry = useCallback((entry: Entry) => {
        if (!requireLogin()) return
        if (confirm('Delete this entry?')) {
            actions.deleteEntry(entry.id)
        }
    }, [actions, requireLogin])

    const handleCopyEntry = useCallback((entry: Entry) => {
        navigator.clipboard.writeText(entry.content || '')
    }, [])

    const handleMarkAsTask = useCallback(async (entry: Entry) => {
        if (!requireLogin()) return

        // Mark entry as task by setting contentType to 'task'
        actions.updateEntry(entry.id, {
            contentType: 'task',
            fieldValues: { done: false }
        })

        // Create Google Task if logged in
        if (googleTasks.isLoggedIn) {
            try {
                await googleTasks.createTask(entry.content, entry.id)
            } catch (err) {
                console.error('Failed to create Google Task:', err)
            }
        }
    }, [actions, requireLogin, googleTasks])

    const handleCompleteTask = useCallback((entryId: string | null, _title: string) => {
        if (entryId) {
            actions.updateEntry(entryId, { fieldValues: { done: true } })
        }
    }, [actions])

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
        handleMarkAsTask,
        handleCompleteTask,
    }
}
