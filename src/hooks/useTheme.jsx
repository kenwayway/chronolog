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

// Available text color variants
export const TEXT_VARIANTS = {
    default: {
        name: 'Tokyo Night',
        colors: {
            primary: '#c0caf5',
            secondary: '#a9b1d6',
            muted: '#787c99',
            dim: '#565f89'
        }
    },
    neutral: {
        name: 'Neutral',
        colors: {
            primary: '#e2e8f0',
            secondary: '#cbd5e1',
            muted: '#94a3b8',
            dim: '#64748b'
        }
    },
    contrast: {
        name: 'High Contrast',
        colors: {
            primary: '#ffffff',
            secondary: '#e5e7eb',
            muted: '#d1d5db',
            dim: '#9ca3af'
        }
    }
}

const defaultTheme = {
    mode: 'dark',
    accent: 'indigo',
    textColor: 'neutral'
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
        const text = TEXT_VARIANTS[theme.textColor] || TEXT_VARIANTS.neutral

        // Set mode
        root.setAttribute('data-theme', theme.mode)

        // Set accent color CSS variables
        root.style.setProperty('--accent', accent.value)
        root.style.setProperty('--accent-light', accent.light)
        root.style.setProperty('--accent-glow', `${accent.value}4d`) // 30% opacity
        root.style.setProperty('--accent-subtle', `${accent.value}1a`) // 10% opacity

        // Set text color CSS variables (only for dark mode, light mode handles its own)
        if (theme.mode === 'dark') {
            root.style.setProperty('--text-primary', text.colors.primary)
            root.style.setProperty('--text-secondary', text.colors.secondary)
            root.style.setProperty('--text-muted', text.colors.muted)
            root.style.setProperty('--text-dim', text.colors.dim)
        } else {
            // Reset to light mode defaults (handled by CSS/UnoCSS config, but we can enforce if needed)
            // For now, we let light mode use its hardcoded values in uno.config.js or we could add light mode variants too.
            // Assuming text variants are primarily for dark mode customization as requested.
            // But let's be safe and remove inline styles if switching to light mode so CSS takes over, 
            // OR we define light mode variants. 
            // Given the request "change the default text color", I'll assume it applies to the main dark theme.
            // To be safe, I'll remove the properties if mode is light so the CSS defaults apply.
            root.style.removeProperty('--text-primary')
            root.style.removeProperty('--text-secondary')
            root.style.removeProperty('--text-muted')
            root.style.removeProperty('--text-dim')
        }

        // Save to localStorage
        localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme))
    }, [theme])

    const setMode = (mode) => {
        setTheme(prev => ({ ...prev, mode }))
    }

    const setAccent = (accent) => {
        setTheme(prev => ({ ...prev, accent }))
    }

    const setTextColor = (textColor) => {
        setTheme(prev => ({ ...prev, textColor }))
    }

    const toggleMode = () => {
        setTheme(prev => ({
            ...prev,
            mode: prev.mode === 'dark' ? 'light' : 'dark'
        }))
    }

    return (
        <ThemeContext.Provider value={{ theme, setMode, setAccent, setTextColor, toggleMode }}>
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
