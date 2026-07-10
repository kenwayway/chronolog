import { useState, useCallback, useRef, useEffect, type RefObject } from 'react'
import type { Entry, SessionActions } from '@/types'
import type { InputPanelRef } from '@/components/input/InputPanel'

interface UseFollowUpLinkProps {
    entries: Entry[]
    updateEntry: SessionActions['updateEntry']
    inputPanelRef: RefObject<InputPanelRef | null>
}

export interface FollowUpState {
    followUpEntry: Entry | null
    handleFollowUp: (entry: Entry) => void
    clearFollowUp: () => void
}

export function useFollowUpLink({ entries, updateEntry, inputPanelRef }: UseFollowUpLinkProps): FollowUpState {
    const [followUpEntry, setFollowUpEntry] = useState<Entry | null>(null)
    const pendingLinkRef = useRef<string | null>(null)
    const prevEntriesLengthRef = useRef(entries.length)

    const clearFollowUp = useCallback(() => {
        setFollowUpEntry(null)
        pendingLinkRef.current = null
    }, [])

    // Watch for new entries and create bidirectional links
    useEffect(() => {
        if (entries.length > prevEntriesLengthRef.current && pendingLinkRef.current) {
            const newEntry = entries[entries.length - 1]
            const linkToId = pendingLinkRef.current

            if (newEntry && linkToId) {
                const linkToEntry = entries.find(e => e.id === linkToId)

                if (linkToEntry) {
                    const newLinks = newEntry.linkedEntries || []
                    if (!newLinks.includes(linkToId)) {
                        updateEntry(newEntry.id, { linkedEntries: [...newLinks, linkToId] })
                    }

                    const existingLinks = linkToEntry.linkedEntries || []
                    if (!existingLinks.includes(newEntry.id)) {
                        updateEntry(linkToId, { linkedEntries: [...existingLinks, newEntry.id] })
                    }
                }
            }

            const completedLinkToId = linkToId
            window.setTimeout(() => {
                if (pendingLinkRef.current === completedLinkToId) {
                    clearFollowUp()
                }
            }, 0)
        }
        prevEntriesLengthRef.current = entries.length
    }, [entries, updateEntry, clearFollowUp])

    const handleFollowUp = useCallback((entry: Entry) => {
        setFollowUpEntry(entry)
        pendingLinkRef.current = entry.id
        setTimeout(() => {
            inputPanelRef.current?.focus()
        }, 100)
    }, [inputPanelRef])

    return { followUpEntry, handleFollowUp, clearFollowUp }
}
