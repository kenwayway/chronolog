// WW2 Spy Theme Configuration
// Inspired by 1940s classified documents and typewriter aesthetics

import type { ThemeConfig } from './index'

export const spyTheme: ThemeConfig = {
    id: 'spy',
    name: 'Operation',
    lightModeOnly: true,

    // Typography
    fonts: {
        primary: "'Special Elite', 'Courier New', monospace",
        display: "'Playfair Display', Georgia, serif",
        mono: "'Courier Prime', 'Courier New', monospace",
    },

    // Design tokens
    tokens: {
        borderRadius: '0',
        panelTitlePrefix: '//',
        inputPrefix: '█ ',
    },

    // Entry symbols
    symbols: {
        sessionStart: '▶',
        sessionEnd: '◼',
        note: '•',
        todo: '□',
        done: '☑',
        pending: '▶',
        beans: '△',
    },

    // Section decorations
    decorations: {
        enabled: true,
        paperTexture: true,
        stamps: true,
    },

    // Animation settings
    animations: {
        typewriter: true,
        transitions: true,
    },
}

export default spyTheme
