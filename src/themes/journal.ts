// Journal Theme Configuration
// A soft, card-based layout: generous surfaces, system type, and colour used
// once per card rather than everywhere.

import type { ThemeConfig } from './index'

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

    decorations: {
        enabled: false,
    },

    animations: {
        typewriter: false,
        transitions: true,
    },
}

export default journalTheme
