import { useContext } from 'react'
import { UIStateContext } from '@/contexts/UIStateContext'
import type { UIState } from './useUIState'

/** Access UI state from context. */
export function useUIStateContext(): UIState {
    const ctx = useContext(UIStateContext)
    if (!ctx) throw new Error('useUIStateContext must be used within UIStateProvider')
    return ctx
}
