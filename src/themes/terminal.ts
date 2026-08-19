// Terminal Theme Configuration
// The default theme - inspired by code editors and terminal UIs

import type { AccentColor, AccentColorKey, ThemeConfig } from './index'

/**
 * Phosphor, not pigment. This skin's ground is near-black and its type is
 * monospace: the stock Tailwind ramp reads muddy against it, the way a dim
 * terminal reads broken. Same seven slots, pushed toward the saturation of an
 * ANSI bright set, and still dark enough to hold their own on paper when the
 * skin is in light mode.
 */
const terminalAccents: Record<AccentColorKey, AccentColor> = {
    blue: { name: 'Blue', value: '#2b8cff', light: '#66b3ff' },
    indigo: { name: 'Indigo', value: '#5b5bff', light: '#9490ff' },
    violet: { name: 'Violet', value: '#9d3cff', light: '#c07dff' },
    rose: { name: 'Rose', value: '#ff1f4d', light: '#ff6b85' },
    amber: { name: 'Amber', value: '#ffab00', light: '#ffc233' },
    emerald: { name: 'Emerald', value: '#00c980', light: '#2fe6a0' },
    cyan: { name: 'Cyan', value: '#00c8e6', light: '#3ae0f5' },
}

export const terminalTheme: ThemeConfig = {
    id: 'terminal',
    name: 'Terminal',

    // Typography
    fonts: {
        primary: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        display: "'JetBrains Mono', 'Fira Code', monospace",
        mono: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
    },

    // Design tokens
    tokens: {
        borderRadius: '4px',
        panelTitlePrefix: '::',
        inputPrefix: '> ',
    },

    accents: terminalAccents,

    // Entry symbols
    symbols: {
        sessionStart: '▶',
        sessionEnd: '■',
        note: '·',
        beans: '△',
        sparks: '✦',
    },

    // Section decorations
    decorations: {
        enabled: false,
        paperTexture: false,
        stamps: false,
    },

    // Animation settings
    animations: {
        typewriter: false,
        transitions: true,
    },
}

export default terminalTheme
