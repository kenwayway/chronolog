// Theme Registry
// Central place to register and access all themes

import { terminalTheme } from './terminal'
import { spyTheme } from './spy'
import { journalTheme } from './journal'

/**
 * Which shape a theme draws entries in.
 *
 * Tokens can restyle a layout but cannot replace one: a stream of rows on a
 * rule and a stack of cards are different markup, so a theme names the layout
 * it wants and the skin for it does the drawing.
 */
export type ThemeLayout = 'timeline' | 'cards'

// Theme configuration type
export interface ThemeConfig {
  id: string
  name: string
  lightModeOnly?: boolean
  /** Defaults to the original timeline layout when a theme doesn't say. */
  layout?: ThemeLayout
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
  journal: journalTheme,
}

/** The layout a theme draws in, defaulting to the original timeline. */
export function getThemeLayout(theme: ThemeConfig): ThemeLayout {
  return theme.layout ?? 'timeline'
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
