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

export type AccentColorKey = 'blue' | 'indigo' | 'violet' | 'rose' | 'amber' | 'emerald' | 'cyan'

export interface AccentColor {
  name: string
  /** Fills, borders and focus rings. */
  value: string
  /** One step lifted, for text and hover on a dark ground. The paper-side
   *  counterpart is derived by deepening `value` - see ThemeProvider. */
  light: string
}

/**
 * The default set, and Terminal's: bright and saturated on purpose. This skin
 * is built after code editors, where colour is signal against a near-black
 * ground and is meant to sit forward, not blend.
 */
export const ACCENT_COLORS: Record<AccentColorKey, AccentColor> = {
  blue: { name: 'Blue', value: '#3b82f6', light: '#60a5fa' },
  indigo: { name: 'Indigo', value: '#6366f1', light: '#818cf8' },
  violet: { name: 'Violet', value: '#8b5cf6', light: '#a78bfa' },
  rose: { name: 'Rose', value: '#f43f5e', light: '#fb7185' },
  amber: { name: 'Amber', value: '#f59e0b', light: '#fbbf24' },
  emerald: { name: 'Emerald', value: '#10b981', light: '#34d399' },
  cyan: { name: 'Cyan', value: '#06b6d4', light: '#22d3ee' },
}

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
  /**
   * A skin whose whole palette depends on one particular accent declares it
   * here and the global accent picker steps aside. Declaring it in CSS is not
   * enough: the picker writes to the root element's inline style, which beats
   * any `[data-style="..."]` rule.
   */
  accent?: {
    value: string
    light: string
  }
  /**
   * A skin that wants the whole picker retuned brings its own set under the
   * same keys, so a stored choice survives switching skins. Terminal's brights
   * and Journal's pigments are the same seven slots, tuned to their ground.
   */
  accents?: Record<AccentColorKey, AccentColor>
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

/** The accent set on offer under the given skin. */
export function getAccentSet(theme: ThemeConfig): Record<AccentColorKey, AccentColor> {
  return theme.accents ?? ACCENT_COLORS
}
