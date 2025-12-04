import { createContext, useContext, useState, useEffect } from 'react'

const THEME_STORAGE_KEY = 'chronolog_theme'

// Available accent colors
export const ACCENT_COLORS = {
    indigo: { name: 'Indigo', value: '#6366f1', light: '#818cf8' },
    violet: { name: 'Violet', value: '#8b5cf6', light: '#a78bfa' },
    blue: { name: 'Blue', value: '#3b82f6', light: '#60a5fa' },
    cyan: { name: 'Cyan', value: '#06b6d4', light: '#22d3ee' },
    emerald: { name: 'Emerald', value: '#10b981', light: '#34d399' },
    amber: { name: 'Amber', value: '#f59e0b', light: '#fbbf24' },
    rose: { name: 'Rose', value: '#f43f5e', light: '#fb7185' },
}

const defaultTheme = {
    mode: 'dark',
    accent: 'indigo'
}

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(defaultTheme)

    // Load theme from localStorage
    useEffect(() => {
        const saved = localStorage.getItem(THEME_STORAGE_KEY)
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                setTheme({ ...defaultTheme, ...parsed })
            } catch (e) {
                console.error('Failed to parse theme:', e)
            }
        }
    }, [])

    // Apply theme to document
    useEffect(() => {
        const root = document.documentElement
        const accent = ACCENT_COLORS[theme.accent] || ACCENT_COLORS.indigo

        // Set mode
        root.setAttribute('data-theme', theme.mode)

        // Set accent color CSS variables
        root.style.setProperty('--accent', accent.value)
        root.style.setProperty('--accent-light', accent.light)
        root.style.setProperty('--accent-glow', `${accent.value}4d`) // 30% opacity
        root.style.setProperty('--accent-subtle', `${accent.value}1a`) // 10% opacity

        // Save to localStorage
        localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme))
    }, [theme])

    const setMode = (mode) => {
        setTheme(prev => ({ ...prev, mode }))
    }

    const setAccent = (accent) => {
        setTheme(prev => ({ ...prev, accent }))
    }

    const toggleMode = () => {
        setTheme(prev => ({
            ...prev,
            mode: prev.mode === 'dark' ? 'light' : 'dark'
        }))
    }

    return (
        <ThemeContext.Provider value={{ theme, setMode, setAccent, toggleMode }}>
            {children}
        </ThemeContext.Provider>
    )
}

export function useTheme() {
    const context = useContext(ThemeContext)
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider')
    }
    return context
}
