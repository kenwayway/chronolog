import { useEffect, useState, type ReactNode } from 'react'
import { getAccentSet, getTheme, getThemeList } from '@/themes'
import { STORAGE_KEYS, getStorage, setStorage } from '@/utils/storageService'
import { defaultThemeState, ThemeContext, type AccentColorKey, type ThemeMode, type ThemeState } from '@/contexts/ThemeContext'

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [themeState, setThemeState] = useState<ThemeState>(() => ({
        ...defaultThemeState,
        ...getStorage<ThemeState>(STORAGE_KEYS.THEME),
    }))

    const themeConfig = getTheme(themeState.style)

    useEffect(() => {
        const root = document.documentElement
        // A skin that owns its accent outranks the picker (see ThemeConfig.accent);
        // otherwise the picked key resolves against whichever set the skin offers.
        const accentSet = getAccentSet(themeConfig)
        const accent = themeConfig.accent || accentSet[themeState.accent] || accentSet.blue

        const shiftHue = (hex: string, degrees: number): string => {
            const r = parseInt(hex.slice(1, 3), 16) / 255
            const g = parseInt(hex.slice(3, 5), 16) / 255
            const b = parseInt(hex.slice(5, 7), 16) / 255
            const max = Math.max(r, g, b), min = Math.min(r, g, b)
            let h = 0, s = 0
            const l = (max + min) / 2

            if (max !== min) {
                const d = max - min
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
                switch (max) {
                    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
                    case g: h = ((b - r) / d + 2) / 6; break
                    case b: h = ((r - g) / d + 4) / 6; break
                }
            }

            h = (h + degrees / 360 + 1) % 1
            const hue2rgb = (p: number, q: number, t: number): number => {
                if (t < 0) t += 1
                if (t > 1) t -= 1
                if (t < 1 / 6) return p + (q - p) * 6 * t
                if (t < 1 / 2) return q
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
                return p
            }

            let r2: number, g2: number, b2: number
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

        // The accent's second step has to move in opposite directions per mode:
        // lifted to carry on near-black, deepened to carry on paper. Sending the
        // lifted value to both was leaving light mode with washed-out headings.
        const deepen = (hex: string, amount: number): string => {
            const ch = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
            return '#' + ch
                .map(v => Math.round(v * (1 - amount)).toString(16).padStart(2, '0'))
                .join('')
        }
        const accentStep = themeState.mode === 'dark' ? accent.light : deepen(accent.value, 0.28)

        root.setAttribute('data-theme', themeState.mode)
        root.setAttribute('data-style', themeState.style)
        root.style.setProperty('--accent', accent.value)
        root.style.setProperty('--accent-step', accentStep)
        root.style.setProperty('--accent-glow', `${accent.value}26`)
        root.style.setProperty('--accent-subtle', `${accent.value}1a`)
        root.style.setProperty('--heading-h1', accentStep)
        root.style.setProperty('--heading-h2', shiftHue(accentStep, 15))
        root.style.setProperty('--heading-h3', shiftHue(accentStep, -15))
        setStorage(STORAGE_KEYS.THEME, themeState)
    }, [themeState, themeConfig])

    const setMode = (mode: ThemeMode) => setThemeState(prev => ({ ...prev, mode }))
    const setAccent = (accent: AccentColorKey) => setThemeState(prev => ({ ...prev, accent }))
    const setStyle = (style: string) => {
        const newThemeConfig = getTheme(style)
        setThemeState(prev => newThemeConfig.lightModeOnly ? { ...prev, style, mode: 'light' } : { ...prev, style })
    }
    const toggleMode = () => setThemeState(prev => ({ ...prev, mode: prev.mode === 'dark' ? 'light' : 'dark' }))
    return (
        <ThemeContext.Provider value={{ themeState, themeConfig, setMode, setAccent, setStyle, toggleMode, availableStyles: getThemeList() }}>
            {children}
        </ThemeContext.Provider>
    )
}
