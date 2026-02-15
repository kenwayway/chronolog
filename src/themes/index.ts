// Theme Registry
// Central place to register and access all themes

import { terminalTheme } from './terminal'
import { spyTheme } from './spy'

// Theme configuration type
export interface ThemeConfig {
  id: string
  name: string
  lightModeOnly?: boolean
  fonts: {
    primary: string
    display: string
    mono: string
  }
  tokens: {
    borderRadius: string
    panelTitlePrefix: string
    inputPrefix: string
  }
  symbols: {
    sessionStart: string
    sessionEnd: string
    note: string
    todo: string
    done: string
    pending: string
    beans: string
    sparks: string
  }
  decorations?: {
    enabled: boolean
    paperTexture?: boolean
    stamps?: boolean
  }
  animations?: {
    typewriter: boolean
    transitions: boolean
  }
}

// All available themes
export const themes: Record<string, ThemeConfig> = {
  terminal: terminalTheme,
  spy: spyTheme,
}

// Get theme by ID, fallback to terminal
export function getTheme(id: string): ThemeConfig {
  return themes[id] || themes.terminal
}

// Get list of available themes for UI
export function getThemeList(): { id: string; name: string }[] {
  return Object.values(themes).map(t => ({
    id: t.id,
    name: t.name,
  }))
}

export default themes
