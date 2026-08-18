import { createContext } from 'react'
import type { AccentColorKey, ThemeConfig } from '@/themes'

// The palette lives with the themes now - a skin can replace the whole set.
export { ACCENT_COLORS } from '@/themes'
export type { AccentColor, AccentColorKey } from '@/themes'

export type ThemeMode = 'dark' | 'light'

export interface ThemeState {
    mode: ThemeMode
    accent: AccentColorKey
    style: string
}

export const defaultThemeState: ThemeState = {
    mode: 'dark',
    accent: 'emerald',
    style: 'terminal',
}

export interface ThemeContextValue {
    themeState: ThemeState
    themeConfig: ThemeConfig
    setMode: (mode: ThemeMode) => void
    setAccent: (accent: AccentColorKey) => void
    setStyle: (style: string) => void
    toggleMode: () => void
    availableStyles: { id: string; name: string }[]
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
