import { useState, useCallback, useRef, useEffect, type RefObject } from 'react'
import type { TimelineItem, SessionActions } from '@/types'
import type { InputPanelRef } from '@/components/input/InputPanel'

interface UseFollowUpLinkProps {
    items: TimelineItem[]
    updateNote: SessionActions['updateNote']
    updateSession: SessionActions['updateSession']
    inputPanelRef: RefObject<InputPanelRef | null>
}

export interface FollowUpState {
    followUpEntry: TimelineItem | null
    handleFollowUp: (entry: TimelineItem) => void
    clearFollowUp: () => void
}

export function useFollowUpLink({ items, updateNote, updateSession, inputPanelRef }: UseFollowUpLinkProps): FollowUpState {
    const [followUpEntry, setFollowUpEntry] = useState<TimelineItem | null>(null)
    const pendingLinkRef = useRef<string | null>(null)
    const previousEntityIdsRef = useRef(new Set(items.map(item => item.entityId)))

    const clearFollowUp = useCallback(() => {
        setFollowUpEntry(null)
        pendingLinkRef.current = null
    }, [])

    const updateLinks = useCallback((item: TimelineItem, linkedItems: string[]) => {
        if (item.kind === 'note') updateNote(item.entityId, { linkedItems })
        else updateSession(item.entityId, { linkedItems })
    }, [updateNote, updateSession])

    // Watch for a new domain entity and create bidirectional links.
    useEffect(() => {
        const currentEntityIds = new Set(items.map(item => item.entityId))
        const newItem = items.find(item =>
            item.kind !== 'session-end' && !previousEntityIdsRef.current.has(item.entityId),
        )
        if (newItem && pendingLinkRef.current) {
            const linkToId = pendingLinkRef.current

            if (linkToId) {
                const linkToItem = items.find(item => item.entityId === linkToId)

                if (linkToItem) {
                    const newLinks = newItem.linkedItems || []
                    if (!newLinks.includes(linkToId)) {
                        updateLinks(newItem, [...newLinks, linkToId])
                    }

                    const existingLinks = linkToItem.linkedItems || []
                    if (!existingLinks.includes(newItem.entityId)) {
                        updateLinks(linkToItem, [...existingLinks, newItem.entityId])
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
        previousEntityIdsRef.current = currentEntityIds
    }, [items, updateLinks, clearFollowUp])

    const handleFollowUp = useCallback((item: TimelineItem) => {
        setFollowUpEntry(item)
        pendingLinkRef.current = item.entityId
        setTimeout(() => {
            inputPanelRef.current?.focus()
        }, 100)
    }, [inputPanelRef])

    return { followUpEntry, handleFollowUp, clearFollowUp }
}
