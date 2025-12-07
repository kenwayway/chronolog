// Theme Registry
// Central place to register and access all themes

import { terminalTheme } from './terminal';
import { spyTheme } from './spy';

// All available themes
export const themes = {
    terminal: terminalTheme,
    spy: spyTheme,
};

// Get theme by ID, fallback to terminal
export function getTheme(id) {
    return themes[id] || themes.terminal;
}

// Get list of available themes for UI
export function getThemeList() {
    return Object.values(themes).map(t => ({
        id: t.id,
        name: t.name,
    }));
}

export default themes;
