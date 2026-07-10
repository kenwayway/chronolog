import { createContext } from 'react'
import type { ThemeConfig } from '@/themes'

export type AccentColorKey = 'blue' | 'indigo' | 'violet' | 'rose' | 'amber' | 'emerald' | 'cyan'

export interface AccentColor {
    name: string
    value: string
    light: string
}

export const ACCENT_COLORS: Record<AccentColorKey, AccentColor> = {
    blue: { name: 'Blue', value: '#3b82f6', light: '#60a5fa' },
    indigo: { name: 'Indigo', value: '#6366f1', light: '#818cf8' },
    violet: { name: 'Violet', value: '#8b5cf6', light: '#a78bfa' },
    rose: { name: 'Rose', value: '#f43f5e', light: '#fb7185' },
    amber: { name: 'Amber', value: '#f59e0b', light: '#fbbf24' },
    emerald: { name: 'Emerald', value: '#10b981', light: '#34d399' },
    cyan: { name: 'Cyan', value: '#06b6d4', light: '#22d3ee' },
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
