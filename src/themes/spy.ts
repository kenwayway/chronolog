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

    // Aged brass, and not up for negotiation - the parchment ground was built
    // around it.
    accent: {
        value: '#8b6914',
        light: '#a67c00',
    },

    // Entry symbols
    symbols: {
        sessionStart: '▶',
        sessionEnd: '◼',
        note: '•',
        beans: '△',
        sparks: '✦',
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
