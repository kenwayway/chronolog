const NOTION_PAGE_ID_PATTERN = /^[0-9a-f]{32}$/i

function hyphenatePageId(value: string): string {
  const compact = value.replace(/-/g, '').toLowerCase()
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`
}

/**
 * Accept a Notion page URL, a compact 32-character page ID, or a UUID and
 * return the canonical lowercase UUID used by the API.
 */
export function normalizeNotionPageId(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const value = input.trim()
  if (!value) return null

  const direct = value.replace(/-/g, '')
  if (NOTION_PAGE_ID_PATTERN.test(direct)) return hyphenatePageId(direct)

  try {
    const url = new URL(value)
    if (!/(^|\.)notion\.(so|site|com)$/i.test(url.hostname)) return null

    const candidates = [
      ...url.pathname.split('/').reverse(),
      url.searchParams.get('p') || '',
    ]
    for (const candidate of candidates) {
      const matches = candidate.match(/[0-9a-f]{32}/ig)
      if (matches && matches.length > 0) {
        return hyphenatePageId(matches[matches.length - 1])
      }
    }
  } catch {
    return null
  }

  return null
}

export function notionPageUrl(pageId: string): string | null {
  const normalized = normalizeNotionPageId(pageId)
  return normalized ? `https://www.notion.so/${normalized.replace(/-/g, '')}` : null
}
