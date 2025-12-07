// WW2 Spy Theme Configuration
// Inspired by 1940s classified documents and typewriter aesthetics

export const spyTheme = {
    id: 'spy',
    name: 'Operation',
    lightModeOnly: true,  // This theme only supports light mode

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
        archived: '◼',
    },

    // Section decorations
    decorations: {
        enabled: true,
        paperTexture: true,
        stamps: ['TOP SECRET', 'CLASSIFIED', 'CONFIDENTIAL'],
        coffeeStains: true,
    },

    // Animation settings
    animations: {
        typewriter: true,
        transitions: true,
    },
};

export default spyTheme;
