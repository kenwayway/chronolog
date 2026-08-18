import { createContext } from 'react'
import type { ThemeConfig } from '@/themes'

export type AccentColorKey = 'blue' | 'indigo' | 'violet' | 'rose' | 'amber' | 'emerald' | 'cyan'

export interface AccentColor {
    name: string
    /** Fills, borders and focus rings. Has to read on near-black and on paper. */
    value: string
    /** One step lifted, for text and hover on a dark ground. The paper-side
     *  counterpart is derived by deepening `value` - see ThemeProvider. */
    light: string
}

/**
 * Pigments rather than a framework's defaults: the greys in this app are warm
 * (#ddd7d2 on #0f0f14, #eeece7 in light), and a stock blue-500 sits outside
 * that world. Each of these is desaturated enough to belong next to paper,
 * and named for the thing it actually is.
 */
export const ACCENT_COLORS: Record<AccentColorKey, AccentColor> = {
    blue: { name: 'Ink', value: '#3f6d8f', light: '#79a8c6' },
    indigo: { name: 'Woad', value: '#55568f', light: '#9092c8' },
    violet: { name: 'Mulberry', value: '#7a5680', light: '#b28cb7' },
    rose: { name: 'Madder', value: '#a84a54', light: '#d98c92' },
    amber: { name: 'Brass', value: '#a67c00', light: '#d6ab48' },
    emerald: { name: 'Verdigris', value: '#3f8a72', light: '#77bda4' },
    cyan: { name: 'Celadon', value: '#3f8894', light: '#78b9c3' },
}

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
