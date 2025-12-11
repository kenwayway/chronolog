import { useCallback } from 'react'
import type { Entry, SessionActions, UpdateEntryPayload } from '../types'

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
    handleNote: (content: string) => void
    handleLogOff: (content: string) => void
    handleEditEntry: (entry: Entry, openModal: (entry: Entry) => void) => void
    handleSaveEdit: (entryId: string, updates: UpdateEntryPayload) => void
    handleDeleteEntry: (entry: Entry) => void
    handleCopyEntry: (entry: Entry) => void
    handleMarkAsTask: (entry: Entry) => Promise<void>
    handleCompleteTask: (entryId: string) => void
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
        if (!requireLogin()) return
        actions.logIn(content)
    }, [actions, requireLogin])

    const handleSwitch = useCallback((content: string) => {
        if (!requireLogin()) return
        actions.switchSession(content)
    }, [actions, requireLogin])

    const handleNote = useCallback((content: string) => {
        if (!requireLogin()) return
        actions.addNote(content)
    }, [actions, requireLogin])

    const handleLogOff = useCallback((content: string) => {
        if (!requireLogin()) return
        actions.logOff(content)
    }, [actions, requireLogin])

    const handleEditEntry = useCallback((entry: Entry, openModal: (entry: Entry) => void) => {
        if (!requireLogin()) return
        openModal(entry)
    }, [requireLogin])

    const handleSaveEdit = useCallback((entryId: string, updates: UpdateEntryPayload) => {
        if (!requireLogin()) return
        const cleanUpdates = Object.fromEntries(
            Object.entries(updates).filter(([, v]) => v !== undefined)
        ) as UpdateEntryPayload
        if (Object.keys(cleanUpdates).length > 0) {
            actions.updateEntry(entryId, cleanUpdates)
        }
    }, [actions, requireLogin])

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

    const handleCompleteTask = useCallback((entryId: string) => {
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
