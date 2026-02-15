// Terminal Theme Configuration
// The default theme - inspired by code editors and terminal UIs

import type { ThemeConfig } from './index'

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

    // Entry symbols
    symbols: {
        sessionStart: '▶',
        sessionEnd: '■',
        note: '·',
        todo: '○',
        done: '✓',
        pending: '»',
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
