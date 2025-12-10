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

        // Helper: shift hue of hex color
        const shiftHue = (hex, degrees) => {
            // Parse hex to RGB
            const r = parseInt(hex.slice(1, 3), 16) / 255
            const g = parseInt(hex.slice(3, 5), 16) / 255
            const b = parseInt(hex.slice(5, 7), 16) / 255

            // RGB to HSL
            const max = Math.max(r, g, b), min = Math.min(r, g, b)
            let h, s, l = (max + min) / 2

            if (max === min) {
                h = s = 0
            } else {
                const d = max - min
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
                switch (max) {
                    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
                    case g: h = ((b - r) / d + 2) / 6; break
                    case b: h = ((r - g) / d + 4) / 6; break
                }
            }

            // Shift hue
            h = (h + degrees / 360 + 1) % 1

            // HSL to RGB
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1
                if (t > 1) t -= 1
                if (t < 1 / 6) return p + (q - p) * 6 * t
                if (t < 1 / 2) return q
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
                return p
            }

            let r2, g2, b2
            if (s === 0) {
                r2 = g2 = b2 = l
            } else {
                const q = l < 0.5 ? l * (1 + s) : l + s - l * s
                const p = 2 * l - q
                r2 = hue2rgb(p, q, h + 1 / 3)
                g2 = hue2rgb(p, q, h)
                b2 = hue2rgb(p, q, h - 1 / 3)
            }

            return `#${Math.round(r2 * 255).toString(16).padStart(2, '0')}${Math.round(g2 * 255).toString(16).padStart(2, '0')}${Math.round(b2 * 255).toString(16).padStart(2, '0')}`
        }

        // Set mode (triggers CSS variable switch)
        root.setAttribute('data-theme', themeState.mode)
        root.setAttribute('data-style', themeState.style)

        // Set dynamic accent color
        root.style.setProperty('--accent', accent.value)
        root.style.setProperty('--accent-light', accent.light)
        root.style.setProperty('--accent-glow', `${accent.value}26`)
        root.style.setProperty('--accent-subtle', `${accent.value}1a`)

        // Set heading colors (slight hue shifts from accent-light)
        root.style.setProperty('--heading-h1', accent.light)
        root.style.setProperty('--heading-h2', shiftHue(accent.light, 15))
        root.style.setProperty('--heading-h3', shiftHue(accent.light, -15))

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

