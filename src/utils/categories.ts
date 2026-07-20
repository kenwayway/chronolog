/**
 * Fixed life-area categories (not user-editable) — the single source of truth,
 * shared by the frontend and Cloudflare Pages Functions (functions/api/mcp.ts
 * imports this file directly). Keep it free of '@/' alias imports and runtime
 * dependencies so both tsconfig projects and the Pages bundler can consume it.
 */

const CATEGORY_DEFS = [
    { id: 'hustle', label: 'Hustle', color: '#7aa2f7', description: 'Life admin: visa, taxes, rent, bills, errands, paperwork' },
    { id: 'craft', label: 'Craft', color: '#bb9af7', description: 'Coding, drawing, creating, building projects' },
    { id: 'hardware', label: 'Hardware', color: '#4dcc59', description: 'Sleep, eating, workout, physical health, mental health' },
    { id: 'barter', label: 'Barter', color: '#c8e068', description: 'Friends, social activities, relationships' },
    { id: 'wander', label: 'Wander', color: '#f7768e', description: 'Travel, movies, relaxation, exploration' },
    { id: 'work', label: 'Work', color: '#f59e0b', description: 'Job tasks, meetings, work projects, office stuff' },
] as const

/** Category IDs — derived from the definitions above, add a category once */
export type CategoryId = typeof CATEGORY_DEFS[number]['id']

/** Category definition */
export interface Category {
    id: CategoryId
    label: string
    color: string
    description: string  // Description for AI categorization
}

export const CATEGORIES: Category[] = [...CATEGORY_DEFS]

/** Loosely-typed id list for validating untrusted input */
export const CATEGORY_IDS: string[] = CATEGORIES.map(c => c.id)
