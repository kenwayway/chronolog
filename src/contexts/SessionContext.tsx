import { createContext, useContext } from 'react'
import type { SessionState, SessionActions, Category } from '../types'

export interface SessionContextValue {
    state: SessionState
    actions: SessionActions
    categories: Category[]
    isStreaming: boolean
}

export const SessionContext = createContext<SessionContextValue | null>(null)

/**
 * Access session state, actions, and categories from context.
 * Must be used within a component wrapped by SessionContext.Provider.
 */
export function useSessionContext(): SessionContextValue {
    const ctx = useContext(SessionContext)
    if (!ctx) throw new Error('useSessionContext must be used within SessionContext.Provider')
    return ctx
}
