import { useState, useCallback } from 'react'
import type { Entry, CategoryId } from '@/types'

interface Position {
    x: number
    y: number
}

interface ContextMenuState {
    isOpen: boolean
    position: Position
    entry: Entry | null
}

interface EditModalState {
    isOpen: boolean
    entry: Entry | null
}

export interface UIState {
    // Sidebars & modals
    leftSidebarOpen: boolean
    setLeftSidebarOpen: (open: boolean) => void
    settingsOpen: boolean
    setSettingsOpen: (open: boolean) => void
    searchOpen: boolean
    setSearchOpen: (open: boolean) => void
    showLanding: boolean
    setShowLanding: (show: boolean) => void

    // Context menu
    contextMenu: ContextMenuState
    handleContextMenu: (entry: Entry, position: Position) => void
    closeContextMenu: () => void

    // Edit modal
    editModal: EditModalState
    openEditModal: (entry: Entry) => void
    closeEditModal: () => void

    // Navigation
    selectedDate: Date | null
    setSelectedDate: (date: Date | null) => void
    categoryFilter: CategoryId[]
    setCategoryFilter: (filter: CategoryId[]) => void
    tagFilter: string[]
    setTagFilter: (filter: string[]) => void
    contentTypeFilter: string[]
    setContentTypeFilter: (filter: string[]) => void
    navigateToEntry: (entry: Entry) => void
}

export function useUIState(): UIState {
    // Panel states
    const [leftSidebarOpen, setLeftSidebarOpen] = useState(false)
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [searchOpen, setSearchOpen] = useState(false)
    const [showLanding, setShowLanding] = useState(true)
    const [selectedDate, setSelectedDate] = useState<Date | null>(null)
    const [categoryFilter, setCategoryFilter] = useState<CategoryId[]>([])
    const [tagFilter, setTagFilter] = useState<string[]>([])
    const [contentTypeFilter, setContentTypeFilter] = useState<string[]>([])

    // Context menu
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({
        isOpen: false,
        position: { x: 0, y: 0 },
        entry: null,
    })

    const handleContextMenu = useCallback((entry: Entry, position: Position) => {
        setContextMenu({ isOpen: true, position, entry })
    }, [])

    const closeContextMenu = useCallback(() => {
        setContextMenu(prev => ({ ...prev, isOpen: false }))
    }, [])

    // Edit modal
    const [editModal, setEditModal] = useState<EditModalState>({ isOpen: false, entry: null })

    const openEditModal = useCallback((entry: Entry) => {
        setEditModal({ isOpen: true, entry })
    }, [])

    const closeEditModal = useCallback(() => {
        setEditModal({ isOpen: false, entry: null })
    }, [])

    // Navigate to an entry
    const navigateToEntry = useCallback((targetEntry: Entry) => {
        if (!targetEntry) return
        setShowLanding(false)
        const targetDate = new Date(targetEntry.timestamp)
        targetDate.setHours(0, 0, 0, 0)
        setSelectedDate(targetDate)
        // Retry a few times: when jumping from another route (e.g. /gallery)
        // the timeline may not be mounted yet on the first attempt
        let attempts = 0
        const tryScroll = () => {
            const el = document.querySelector(`[data-entry-id="${targetEntry.id}"]`) as HTMLElement | null
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                el.style.backgroundColor = 'var(--accent-subtle)'
                setTimeout(() => { el.style.backgroundColor = '' }, 1500)
            } else if (++attempts < 5) {
                setTimeout(tryScroll, 150)
            }
        }
        setTimeout(tryScroll, 100)
    }, [])

    return {
        leftSidebarOpen, setLeftSidebarOpen,
        settingsOpen, setSettingsOpen,
        searchOpen, setSearchOpen,
        showLanding, setShowLanding,
        contextMenu, handleContextMenu, closeContextMenu,
        editModal, openEditModal, closeEditModal,
        selectedDate, setSelectedDate,
        categoryFilter, setCategoryFilter,
        tagFilter, setTagFilter,
        contentTypeFilter, setContentTypeFilter,
        navigateToEntry,
    }
}
