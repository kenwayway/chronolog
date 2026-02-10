// Shared type definitions for Cloudflare Pages Functions

/** Cloudflare environment bindings */
export interface Env {
    // D1 Database
    CHRONOLOG_DB: D1Database;

    // KV Namespace (auth tokens + AI config)
    CHRONOLOG_KV: KVNamespace;

    // R2 Bucket (image storage)
    CHRONOLOG_R2: R2Bucket;

    // Environment variables
    AUTH_PASSWORD: string;
    OPENCLAW_WEBHOOK_SECRET?: string;
    PUBLIC_API_TOKEN?: string;
    AI_API_KEY?: string;
    AI_COMMENT_API_KEY?: string;
    AI_BASE_URL?: string;
    AI_MODEL?: string;
}

/** Shorthand for Cloudflare Pages function context */
export type CFContext<Params extends string = string> = EventContext<Env, Params, unknown>;

/** Auth verification result */
export interface AuthResult {
    valid: boolean;
    error?: string;
}

// --- D1 Row types (snake_case, matches schema.sql) ---

export interface EntryRow {
    id: string;
    type: string;
    content: string;
    timestamp: number;
    session_id: string | null;
    duration: number | null;
    category: string | null;
    content_type: string;
    field_values: string | null;
    linked_entries: string | null;
    tags: string | null;
    ai_comment: string | null;
    created_at: number;
    updated_at: number;
}

export interface ContentTypeRow {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
    fields: string | null;
    built_in: number;
    sort_order: number;
}

export interface MediaItemRow {
    id: string;
    title: string;
    media_type: string;
    notion_url: string | null;
    created_at: number;
}

// --- Frontend object types (camelCase) ---

export interface Entry {
    id: string;
    type: string;
    content: string;
    timestamp: number;
    sessionId?: string;
    duration?: number;
    category?: string;
    contentType?: string;
    fieldValues?: Record<string, unknown>;
    linkedEntries?: string[];
    tags?: string[];
    aiComment?: string;
    createdAt?: number;
    updatedAt?: number;
}

export interface ContentType {
    id: string;
    name: string;
    icon?: string;
    color?: string;
    fields: ContentTypeField[];
    builtIn?: boolean;
    order: number;
}

export interface ContentTypeField {
    id: string;
    name: string;
    type: string;
    options?: string[];
    required?: boolean;
}

export interface MediaItem {
    id: string;
    title: string;
    mediaType: string;
    notionUrl?: string;
    createdAt: number;
}
