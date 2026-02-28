/**
 * UI State Context — provides sidebar, modal, filter, and navigation state
 * to deeply nested components, eliminating prop drilling.
 */
import { createContext, useContext, type ReactNode } from 'react'
import { useUIState, type UIState } from '@/hooks/useUIState'

const UIStateContext = createContext<UIState | null>(null)

/**
 * Provider component — wraps useUIState and exposes it via context.
 */
export function UIStateProvider({ children }: { children: ReactNode }) {
    const uiState = useUIState()
    return (
        <UIStateContext.Provider value={uiState}>
            {children}
        </UIStateContext.Provider>
    )
}

/**
 * Access UI state from context.
 * Must be used within a component wrapped by UIStateProvider.
 */
export function useUIStateContext(): UIState {
    const ctx = useContext(UIStateContext)
    if (!ctx) throw new Error('useUIStateContext must be used within UIStateProvider')
    return ctx
}
