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
 * Phosphor, not pigment. The one set every skin draws from: pushed toward the
 * saturation of an ANSI bright set, because this app is built after code
 * editors, where colour is signal against a near-black ground and is meant to
 * sit forward rather than blend. Journal runs on paper and takes the same set
 * anyway - one accent vocabulary across skins beat a per-skin retune.
 */
export const ACCENT_COLORS: Record<AccentColorKey, AccentColor> = {
  blue: { name: 'Blue', value: '#2b8cff', light: '#66b3ff' },
  indigo: { name: 'Indigo', value: '#5b5bff', light: '#9490ff' },
  violet: { name: 'Violet', value: '#9d3cff', light: '#c07dff' },
  rose: { name: 'Rose', value: '#ff1f4d', light: '#ff6b85' },
  amber: { name: 'Amber', value: '#ffab00', light: '#ffc233' },
  emerald: { name: 'Emerald', value: '#00c980', light: '#2fe6a0' },
  cyan: { name: 'Cyan', value: '#00c8e6', light: '#3ae0f5' },
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
   * A skin that wants the whole picker retuned may bring its own set under the
   * same keys, so a stored choice survives switching skins. Nothing declares
   * one today - every skin shares ACCENT_COLORS - but the hook is what keeps
   * that a choice rather than an assumption.
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
