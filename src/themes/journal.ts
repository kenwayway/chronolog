// Journal Theme Configuration
// A soft, card-based layout: generous surfaces, system type, and colour used
// once per card rather than everywhere.

import type { AccentColor, AccentColorKey, ThemeConfig } from './index'

/**
 * Pigments, not phosphor. This skin's ground is paper - #f2f0ee over warm
 * greys - and Terminal's saturated set reads as borrowed on it. Same seven
 * slots, desaturated to sit beside the stock, and named for what they are.
 */
const journalAccents: Record<AccentColorKey, AccentColor> = {
    blue: { name: 'Ink', value: '#3f6d8f', light: '#79a8c6' },
    indigo: { name: 'Woad', value: '#55568f', light: '#9092c8' },
    violet: { name: 'Mulberry', value: '#7a5680', light: '#b28cb7' },
    rose: { name: 'Madder', value: '#a84a54', light: '#d98c92' },
    amber: { name: 'Brass', value: '#a67c00', light: '#d6ab48' },
    emerald: { name: 'Verdigris', value: '#3f8a72', light: '#77bda4' },
    cyan: { name: 'Celadon', value: '#3f8894', light: '#78b9c3' },
}

export const journalTheme: ThemeConfig = {
    id: 'journal',
    name: 'Journal',
    layout: 'cards',

    // Typography — the system UI stack is the point here, not a shortcut: it is
    // what the look is made of, and it ships with the device rather than over
    // the network, which an offline-first PWA cares about.
    fonts: {
        primary: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', system-ui, 'Segoe UI', sans-serif",
        display: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', system-ui, sans-serif",
        mono: "ui-monospace, 'SF Mono', 'JetBrains Mono', 'Menlo', monospace",
    },

    tokens: {
        borderRadius: '18px',
        // This layout puts nothing in front of a title or an input. The
        // absence is the style.
        panelTitlePrefix: '',
        inputPrefix: '',
    },

    // Cards carry meaning in the spine and the type, so the glyphs stay
    // quiet — they sit beside the time, never inside the colour.
    symbols: {
        sessionStart: '▸',
        sessionEnd: '▪',
        note: '·',
        beans: '◦',
        sparks: '✳',
    },

    accents: journalAccents,

    decorations: {
        enabled: false,
    },

    animations: {
        typewriter: false,
        transitions: true,
    },
}

export default journalTheme
