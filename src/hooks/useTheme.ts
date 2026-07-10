import { useContext } from 'react'
import type { ThemeConfig } from '@/themes'
import { ThemeContext, type ThemeMode, type ThemeState, type AccentColorKey } from '@/contexts/ThemeContext'

export interface UseThemeReturn {
    theme: ThemeState
    setMode: (mode: ThemeMode) => void
    setAccent: (accent: AccentColorKey) => void
    toggleMode: () => void
    toggleTheme: () => void
    isDark: boolean
    themeConfig: ThemeConfig
    setStyle: (style: string) => void
    availableStyles: { id: string; name: string }[]
    canToggleMode: boolean
    symbols: ThemeConfig['symbols']
    tokens: ThemeConfig['tokens']
    fonts: ThemeConfig['fonts']
}

export function useTheme(): UseThemeReturn {
    const context = useContext(ThemeContext)
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider')
    }
    const { themeState, themeConfig, setMode, setAccent, setStyle, toggleMode, availableStyles } = context
    return {
        theme: themeState,
        setMode,
        setAccent,
        toggleMode,
        toggleTheme: toggleMode,
        isDark: themeState.mode === 'dark',
        themeConfig,
        setStyle,
        availableStyles,
        canToggleMode: !themeConfig.lightModeOnly,
        symbols: themeConfig.symbols,
        tokens: themeConfig.tokens,
        fonts: themeConfig.fonts,
    }
}
