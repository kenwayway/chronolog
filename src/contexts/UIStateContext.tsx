/**
 * UI State Context — provides sidebar, modal, filter, and navigation state
 * to deeply nested components, eliminating prop drilling.
 */
import { createContext } from 'react'
import type { UIState } from '@/hooks/useUIState'

export const UIStateContext = createContext<UIState | null>(null)
