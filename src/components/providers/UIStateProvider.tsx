import type { ReactNode } from 'react'
import { UIStateContext } from '@/contexts/UIStateContext'
import { useUIState } from '@/hooks/useUIState'

export function UIStateProvider({ children }: { children: ReactNode }) {
    const uiState = useUIState()

    return (
        <UIStateContext.Provider value={uiState}>
            {children}
        </UIStateContext.Provider>
    )
}
