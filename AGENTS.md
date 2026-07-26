# Chronolog - AI Agent Context

Chronolog is a minimalist local-first time tracker and journal PWA.

## Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```

## Stack

- React 19, TypeScript, Vite, CSS Modules
- Cloudflare Pages Functions
- D1 for structured data, KV for auth, R2 for images
- OpenAI-compatible categorization API
- vite-plugin-pwa / Workbox

## Domain model

There are exactly two persisted timeline entities: `Note` and `Session`.
Session start/end markers are view models, never stored or synchronized as
independent records.

```ts
interface Note {
  id: string
  content: string
  timestamp: number
  sessionId?: string
  category?: CategoryId
  contentType?: string
  fieldValues?: Record<string, unknown>
  linkedItems?: string[] // Note or Session IDs
  tags?: string[]
}

interface Session {
  id: string
  content: string
  startAt: number
  endAt: number | null
  endContent?: string
  category?: CategoryId
  contentType?: string
  fieldValues?: Record<string, unknown>
  linkedItems?: string[] // Note or Session IDs
  tags?: string[]
  endTags?: string[]
}

interface TimelineItem {
  id: string // synthetic view ID
  entityId: string // Note or Session ID
  kind: 'note' | 'session-start' | 'session-end'
  content: string
  timestamp: number
  // projected metadata...
}
```

`src/domain/timeline.ts` is the only place that projects notes and sessions
into timeline items. Synthetic session marker IDs are:

- `session:<session-id>:start`
- `session:<session-id>:end`

Never persist or synchronize `TimelineItem`. Never recreate a boundary-record
wire format.

## Content types

The ContentType registry lives in `src/features/contentTypes/`. It owns:

- built-in definitions and schema defaults
- target constraints (`note` or `session`)
- submission normalization/validation
- timeline symbols
- specialized display renderers

Built-ins: note, bookmark, mood, workout, vault, beans, sparks, media, and
notion-task. Notion tasks can only be attached to sessions.

Categories are fixed in `src/utils/categories.ts`: hustle, craft, hardware,
barter, wander, work.

## State and persistence

`src/hooks/sessionReducer.ts` owns application state:

```ts
interface SessionState {
  status: 'IDLE' | 'STREAMING'
  activeSessionId: string | null
  notes: Note[]
  sessions: Session[]
  contentTypes: ContentType[]
  mediaItems: MediaItem[]
}
```

Domain actions are explicit:

- `LOG_IN`, `SWITCH`, `LOG_OFF`
- `NOTE`
- `DELETE_NOTE`, `UPDATE_NOTE`
- `DELETE_SESSION`, `UPDATE_SESSION`
- import/load and media-library actions

IndexedDB stores notes and sessions separately. Database version 4 performs
the one-time browser migration and clears the obsolete sync outbox before the
new coordinator reseeds canonical mutations.

## Sync

`src/features/sync/SyncCoordinator.ts` owns the protocol independently of
React. `useSyncEngine` is only a React adapter.

Mutation entity types:

- `note`
- `session`
- `contentType`
- `mediaItem`

Every mutation has a durable ID and D1 revision. Pulls merge remote entities
without overwriting IDs that remain dirty in the local outbox. Only pull
responses advance the revision cursor.

API:

```http
GET /api/data?revision=<number>&paged=1
PUT /api/data
Body: { "mutations": SyncMutation[] }
Response: { appliedMutationIds, rejectedMutations, revision, ... }
```

There is no timestamp-sync or alternate payload compatibility route.

Pull semantics (GET):

- With `paged=1` responses stay under ~800 rows; `hasMore: true` means
  request again from the returned `revision`. The client combines all pages
  and merges once — a partial full sync must never be merged.
- Full responses (`incremental: false`) carry no tombstone list: they are
  authoritative by absence, and stale dirty entities are rejected on push by
  their tombstones.
- Notion flushing and sync GC run via `waitUntil` after the response; a pull
  never waits on the Notion API.
- `sync_commits` rows older than 90 days are garbage-collected (except the
  newest, which anchors the revision counter). Tombstones are kept forever —
  they are what makes deletion win over stale upserts.

Rejection semantics (PUT):

- A bad mutation never fails the batch. The server applies the valid
  mutations and reports the bad ones in `rejectedMutations` with reason
  `invalid` or `deleted`.
- Rejected mutation IDs are included in `appliedMutationIds` so every client
  drops them from its outbox instead of retrying forever.
- Tombstones win: once an entity is deleted, no upsert may recreate it
  (enforced inside the upsert SQL, so it is race-free). On a `deleted`
  rejection the client removes its local copy. Re-importing a backup cannot
  resurrect deleted entities.
- Concurrent edits from two devices resolve last-write-wins by arrival
  order; there is no per-entity conflict detection.

## D1 schema and migration

Fresh databases use `schema.sql`, with separate `notes` and `sessions` tables.
Existing databases must apply migrations in order. Migration
`0006_note_session_domain.sql`:

1. converts note rows into `notes`
2. folds historical session boundaries into `sessions`
3. maps links to Note/Session IDs
4. rebuilds tombstones for domain entity types
5. drops the retired tables

Deploy the migration and application code together.

## Notion synchronization

Sessions with `contentType: 'notion-task'` contain a normalized
`fieldValues.notionPageId`. `_notionSync.ts` sums completed session intervals
directly and writes tracked minutes through a durable retry queue.

## Public API and MCP

```http
GET /api/public?token=<PUBLIC_API_TOKEN>&start=<date>&end=<date>&limit=<n>
Response: { notes: Note[], sessions: Session[], count: number }
```

MCP read tools:

- `search_notes`
- `search_sessions`
- `get_day`
- `get_stats`
- `list_categories_and_tags`

MCP write tools (write token only):

- `add_note`
- `start_session`
- `end_session`

MCP auth: write scope requires the token in the `Authorization: Bearer`
header; a write token sent via `?token=` query string degrades to read-only
(query strings land in access logs). Token comparisons are constant-time.

MCP search is backed by external-content FTS5 tables (`notes_fts`,
`sessions_fts`, migration `0007_fts_search.sql`) using the trigram tokenizer
so CJK substrings match. Keywords shorter than 3 characters fall back to a
LIKE scan. Tag filters are exact matches (SQL LIKE is only a prefilter).

## Main project structure

```text
src/
  App.tsx
  domain/timeline.ts
  features/contentTypes/
  features/sync/
  hooks/
  components/
  contexts/
  types/
  utils/
functions/
  api/_db.ts
  api/_revisionSync.ts
  api/_notionSync.ts
  api/data.ts
  api/public.ts
  api/mcp.ts
migrations/
schema.sql
```

## Styling

- Prefer co-located CSS Modules.
- Use design tokens from `src/styles/base.css`.
- Preserve the brutalist/terminal aesthetic: angular shapes, hard borders,
  monospaced data typography, dark-first with light-mode support.

## Deployment

```bash
npx wrangler d1 migrations apply chronolog --remote
npm run build
npx wrangler pages deploy dist --project-name chronolog
```
