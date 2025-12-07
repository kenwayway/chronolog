// Terminal Theme Configuration
// The default theme - inspired by code editors and terminal UIs

export const terminalTheme = {
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
        sessionStart: '»',
        sessionEnd: '■',
        note: '·',
        todo: '○',
        done: '✓',
        pending: '»',
        archived: '■',
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
};

export default terminalTheme;
