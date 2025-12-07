import { createContext, useContext, useState, useEffect } from 'react'
import { getTheme, getThemeList } from '../themes'

const THEME_STORAGE_KEY = 'chronolog_theme'

// ===== Accent Color Palette =====
export const ACCENT_COLORS = {
    blue: { name: 'Blue', value: '#3b82f6', light: '#60a5fa' },
    indigo: { name: 'Indigo', value: '#6366f1', light: '#818cf8' },
    violet: { name: 'Violet', value: '#8b5cf6', light: '#a78bfa' },
    rose: { name: 'Rose', value: '#f43f5e', light: '#fb7185' },
    amber: { name: 'Amber', value: '#f59e0b', light: '#fbbf24' },
    emerald: { name: 'Emerald', value: '#10b981', light: '#34d399' },
    cyan: { name: 'Cyan', value: '#06b6d4', light: '#22d3ee' },
}

// ===== Theme State =====
const defaultThemeState = {
    mode: 'dark',           // 'dark' | 'light'
    accent: 'emerald',      // key from ACCENT_COLORS
    style: 'terminal',      // theme style id
}

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
    const [themeState, setThemeState] = useState(defaultThemeState)

    // Load from localStorage
    useEffect(() => {
        const saved = localStorage.getItem(THEME_STORAGE_KEY)
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                setThemeState({ ...defaultThemeState, ...parsed })
            } catch (e) {
                console.error('Failed to parse theme:', e)
            }
        }
    }, [])

    // Apply theme to document
    useEffect(() => {
        const root = document.documentElement
        const accent = ACCENT_COLORS[themeState.accent] || ACCENT_COLORS.blue

        // Set mode (triggers CSS variable switch)
        root.setAttribute('data-theme', themeState.mode)
        root.setAttribute('data-style', themeState.style)

        // Set dynamic accent color
        root.style.setProperty('--accent', accent.value)
        root.style.setProperty('--accent-light', accent.light)
        root.style.setProperty('--accent-glow', `${accent.value}26`)
        root.style.setProperty('--accent-subtle', `${accent.value}1a`)

        // Save to localStorage
        localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(themeState))
    }, [themeState])

    const setMode = (mode) => {
        setThemeState(prev => ({ ...prev, mode }))
    }

    const setAccent = (accent) => {
        setThemeState(prev => ({ ...prev, accent }))
    }

    const setStyle = (style) => {
        const newThemeConfig = getTheme(style)
        // Force light mode for lightModeOnly themes
        if (newThemeConfig.lightModeOnly) {
            setThemeState(prev => ({ ...prev, style, mode: 'light' }))
        } else {
            setThemeState(prev => ({ ...prev, style }))
        }
    }

    const toggleMode = () => {
        setThemeState(prev => ({
            ...prev,
            mode: prev.mode === 'dark' ? 'light' : 'dark'
        }))
    }

    // Get the current theme config object
    const themeConfig = getTheme(themeState.style)

    return (
        <ThemeContext.Provider value={{
            themeState,
            themeConfig,
            setMode,
            setAccent,
            setStyle,
            toggleMode,
            availableStyles: getThemeList(),
        }}>
            {children}
        </ThemeContext.Provider>
    )
}

export function useTheme() {
    const context = useContext(ThemeContext)
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider')
    }
    const { themeState, themeConfig, setMode, setAccent, setStyle, toggleMode, availableStyles } = context
    return {
        // Legacy API (backward compatible)
        theme: themeState,
        setMode,
        setAccent,
        toggleMode,
        toggleTheme: toggleMode,
        isDark: themeState.mode === 'dark',

        // New theme style API
        themeConfig,
        setStyle,
        availableStyles,
        canToggleMode: !themeConfig.lightModeOnly,

        // Shortcuts to config
        symbols: themeConfig.symbols,
        tokens: themeConfig.tokens,
        fonts: themeConfig.fonts,
    }
}

