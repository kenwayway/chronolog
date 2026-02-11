# Chronolog - AI Agent Context

## Quick Start
Chronolog is a minimalist time-tracking and journaling PWA. Entry point is `src/App.tsx`, which orchestrates all hooks and components.

```bash
npm run dev      # Start development server
npm run build    # Build for production
```

---

## Tech Stack
| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, TypeScript, Vite, CSS Modules + Vanilla CSS |
| **Backend** | Cloudflare Pages Functions (TypeScript) |
| **Data Storage** | Cloudflare D1 (SQLite) |
| **Auth/Config** | Cloudflare KV (auth tokens, AI config) |
| **Image Storage** | Cloudflare R2 |
| **AI** | OpenAI-compatible API (categorization + AI comments) |
| **PWA** | vite-plugin-pwa, Workbox service worker |

---

## Data Models

### Entry Object
```typescript
interface Entry {
  id: string                    // UUID, generated via generateId()
  type: 'SESSION_START' | 'NOTE' | 'SESSION_END'
  content: string               // User input text
  timestamp: number             // Unix timestamp (ms)

  // Optional fields:
  sessionId?: string            // SESSION_START only
  duration?: number             // SESSION_END only (ms since session start)
  category?: CategoryId         // Life area category
  contentType?: string          // 'note' | 'task' | 'bookmark' | 'mood' | 'workout' | 'beans' | 'sparks' | 'media' | custom
  fieldValues?: Record<string, unknown>  // Dynamic field values
  linkedEntries?: string[]      // Bidirectional linked entry IDs
  tags?: string[]               // Free-form tags (without # prefix)
  aiComment?: string            // AI-generated comment (collapsible bubble)
}
```

### MediaItem
```typescript
type MediaType = 'Book' | 'Movie' | 'Game' | 'TV' | 'Anime' | 'Podcast'

interface MediaItem {
  id: string              // UUID
  title: string           // e.g. "Return to Silent Hill"
  mediaType: MediaType
  notionUrl?: string      // Optional Notion page URL
  createdAt: number       // Timestamp when added
}
```

### ContentType System
ContentTypes define schemas for structured entries. Built-in types:

| ID | Name | Fields |
|----|------|--------|
| `note` | Note | (none) |
| `task` | Task | `done: boolean` |
| `bookmark` | Bookmark | `url, title, type (Article/Video/Tool/Paper), status (Inbox/Reading/Archived)` |
| `mood` | Mood | `feeling (Happy/Excited/Calm/Tired/Anxious/Sad/Angry), energy (1-5), trigger` |
| `workout` | Workout | `workoutType (Strength/Flexibility/Mixed), duration, exercises` |
| `beans` | Beans | (none) — small knowledge tidbits |
| `sparks` | Sparks | (none) — learning, philosophy, ideas |
| `media` | Media | `mediaId: media-select` — links to MediaItem library |

```typescript
interface ContentType {
  id: string
  name: string
  icon?: string         // Display icon (emoji or character)
  color?: string
  fields: FieldDefinition[]
  builtIn?: boolean     // System types can't be deleted
  order?: number        // Display order
}

interface FieldDefinition {
  id: string
  name: string
  type: 'text' | 'number' | 'dropdown' | 'boolean' | 'media-select'
  options?: string[]    // For dropdown
  required?: boolean
  default?: unknown
}
```

### Category (Fixed Constants)
Categories are **not user-editable**. Defined in `constants.ts`:

| ID | Label | Color | Covers |
|----|-------|-------|--------|
| `hustle` | Hustle | #7aa2f7 (blue) | Life admin: visa, taxes, rent, bills, errands |
| `craft` | Craft | #bb9af7 (purple) | Coding, drawing, creating, building projects |
| `hardware` | Hardware | #4dcc59 (green) | Sleep, eating, workout, physical/mental health |
| `barter` | Barter | #c8e068 (yellow-green) | Friends, social activities, relationships |
| `wander` | Wander | #f7768e (pink) | Travel, movies, relaxation, exploration |
| `work` | Work | #f59e0b (amber) | Job tasks, meetings, work projects |

### Application State
```typescript
interface SessionState {
  status: 'IDLE' | 'STREAMING'  // Session status
  sessionStart: number | null   // Active session start time
  entries: Entry[]              // All timeline entries
  contentTypes: ContentType[]   // User's content types (includes built-in)
  mediaItems: MediaItem[]       // User's media library
  apiKey: string | null         // OpenAI API key
  aiBaseUrl: string             // AI endpoint base URL
  aiModel: string               // AI model name
  aiPersona?: string            // Customizable AI persona/system prompt
}
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      ErrorBoundary                               │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    ThemeProvider                            │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │                     App.tsx                           │  │  │
│  │  │                                                      │  │  │
│  │  │  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐  │  │  │
│  │  │  │ useSession  │ │useCloudSync  │ │useAICategories│  │  │  │
│  │  │  │(reducer+    │ │(auth, sync,  │ │(server-side  │  │  │  │
│  │  │  │ debounced   │ │ ref-equality │ │ categorize)  │  │  │  │
│  │  │  │ persist)    │ │ diffing)     │ │              │  │  │  │
│  │  │  └─────────────┘ └──────────────┘ └──────────────┘  │  │  │
│  │  │  ┌──────────────┐ ┌──────────────┐ ┌─────────────┐  │  │  │
│  │  │  │useEntryHandl.│ │useAutoCateg. │ │useGoogleTask│  │  │  │
│  │  │  └──────────────┘ └──────────────┘ └─────────────┘  │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                │              │              │              │
    ┌───────────┘    ┌─────────┘    ┌─────────┘    ┌────────┘
    ▼                ▼              ▼              ▼
┌────────┐    ┌──────────┐   ┌──────────┐   ┌───────────┐
│ Header │    │ Timeline │   │InputPanel│   │TasksPanel │
│        │    │(memoized)│   │(+Focus)  │   │           │
└────────┘    └──────────┘   └──────────┘   └───────────┘
                   │              │
    ┌──────────────┤              │
    ▼              ▼              ▼
┌──────────┐ ┌──────────┐ ┌──────────────────┐
│ EditModal│ │ContextMnu│ │EntryMetadataInput│
└──────────┘ └──────────┘ └──────────────────┘
```

Additional panels: `ActivityPanel` (left sidebar — calendar heatmap, category filters), `LandingPage` (initial onboarding).

### Data Flow
1. **User Input** → `InputPanel` calls `actions.logIn()`, `actions.addNote()`, etc.
2. **State Update** → `useSession` reducer updates state (immutable updates)
3. **Local Persist** → State debounced (500ms) to localStorage, flushed on `beforeunload`
4. **Cloud Sync** → `useCloudSync` uses reference-equality diffing to detect changes, PUTs only modified entries to `/api/data` (D1 incremental upsert)
5. **Polling** → Every 30s, fetches remote changes from other devices (incremental via `?since=`)
6. **AI Detection** → `useAutoCategorize` triggers `/api/categorize` for new entries → auto-detects category + contentType + fieldValues
7. **Webhook** → Backend notifies OpenClaw on new entries for AI comment generation
8. **AI Comments** → OpenClaw writes back via `POST /api/entries/:id/comment` → synced to client on next poll

---

## Project Structure

```
├── src/
│   ├── App.tsx                 # Main app component, orchestrates everything
│   ├── main.tsx                # React entry point (ErrorBoundary → ThemeProvider → App)
│   ├── components/
│   │   ├── ErrorBoundary.tsx   # Catches uncaught errors, prevents white-screen crash
│   │   ├── Header.tsx          # App header with date nav, session controls, sync status
│   │   ├── LandingPage.tsx     # Initial onboarding page
│   │   ├── common/
│   │   │   ├── Calendar.tsx          # Heatmap calendar
│   │   │   ├── ContextMenu.tsx       # Right-click context menu
│   │   │   ├── Dropdown.tsx          # Reusable dropdown
│   │   │   ├── ImageLightbox.tsx     # Fullscreen image viewer
│   │   │   └── LinkSelector.tsx      # Entry link search/select
│   │   ├── input/
│   │   │   ├── InputPanel.tsx          # Main input area (bottom bar)
│   │   │   ├── FocusMode.tsx           # Fullscreen writing mode overlay
│   │   │   ├── EntryMetadataInput.tsx  # SHARED: Category, Type, Tags, Fields, Links
│   │   │   ├── DynamicFieldForm.tsx    # Dynamic fields based on ContentType schema
│   │   │   ├── InputActions.tsx        # Action buttons (Note, Log In, Switch, Log Off)
│   │   │   ├── AttachmentPreview.tsx   # Image/location attachment preview
│   │   │   ├── ContentTypeSelector.tsx # Content type picker
│   │   │   └── MediaSelector.tsx       # Media library picker for media-select fields
│   │   ├── modals/
│   │   │   ├── EditModal.tsx           # Edit entry modal (uses EntryMetadataInput)
│   │   │   ├── SettingsModal.tsx       # Settings (tabs: Appearance, Sync, etc.)
│   │   │   └── settings/
│   │   │       ├── AppearanceTab.tsx   # Theme, accent color settings
│   │   │       └── SyncTab.tsx         # Cloud sync, Google Tasks config
│   │   ├── panels/
│   │   │   ├── TasksPanel.tsx          # Right sidebar: tasks + Google Tasks
│   │   │   └── ActivityPanel.tsx       # Left sidebar: calendar heatmap, category filter
│   │   └── timeline/
│   │       ├── Timeline.tsx            # Entry list (memoized sorting + session durations)
│   │       ├── TimelineEntry.tsx       # Single entry display
│   │       ├── ContentTypeDisplays.tsx # Bookmark, Mood, Workout rendered displays
│   │       └── LinkedEntryPreview.tsx  # Inline preview of linked entries
│   ├── hooks/
│   │   ├── useSession.ts       # Core state: entries, contentTypes, mediaItems, reducer + debounced localStorage
│   │   ├── useCloudSync.ts     # Auth, sync (ref-equality diffing), polling, image upload
│   │   ├── useTheme.tsx        # ThemeProvider context, theme + accent colors
│   │   ├── useAI.ts            # Client-side AI category suggestion (OpenAI-compatible)
│   │   ├── useAICategories.ts  # Server-side AI categorization (calls /api/categorize)
│   │   ├── useAutoCategorize.ts # Auto-triggers categorization for new entries
│   │   ├── useEntryHandlers.ts # Entry action handlers (extracted from App)
│   │   ├── useCategories.ts    # Category list provider
│   │   └── useGoogleTasks.ts   # Google Tasks OAuth + CRUD
│   ├── styles/
│   │   ├── base.css            # CSS variables, reset, design tokens
│   │   ├── index.css           # Import aggregator
│   │   ├── layout.css          # Layout utilities
│   │   ├── components.css      # Global component styles
│   │   ├── responsive.css      # Mobile breakpoints
│   │   └── spy.css             # Spy theme styles
│   ├── themes/
│   │   ├── index.ts            # Theme registry
│   │   ├── terminal.ts         # Terminal theme
│   │   └── spy.ts              # Spy theme
│   ├── types/
│   │   ├── index.ts            # All TypeScript interfaces + type exports
│   │   ├── cloudSync.ts        # Cloud sync specific types
│   │   ├── guards.ts           # Type guard functions
│   │   └── css-modules.d.ts    # CSS Modules type declarations
│   └── utils/
│       ├── constants.ts        # ENTRY_TYPES, ACTIONS, CATEGORIES, BUILTIN_CONTENT_TYPES
│       ├── formatters.ts       # Date/time formatting, generateId()
│       ├── contentParser.ts    # Markdown/content parsing for display
│       ├── tagParser.ts        # Extract #tags from content text
│       └── storageService.ts   # Typed localStorage wrapper (all keys centralized)
├── functions/                  # Cloudflare Pages Functions (TypeScript)
│   ├── _middleware.ts          # Global CORS + auth middleware
│   └── api/
│       ├── types.ts            # Env bindings, D1 row types, shared interfaces
│       ├── _auth.ts            # Shared auth helpers (verifyAuth, corsHeaders)
│       ├── _db.ts              # D1 helpers (row↔object mapping, upsert, batch)
│       ├── auth.ts             # POST /api/auth (password → multi-device token)
│       ├── data.ts             # GET/PUT /api/data (D1 incremental sync + OpenClaw webhook)
│       ├── categorize.ts       # POST /api/categorize (AI category + contentType detection)
│       ├── ai-config.ts        # GET/PUT /api/ai-config (AI comment configuration)
│       ├── upload.ts           # POST /api/upload (image → R2)
│       ├── cleanup.ts          # POST /api/cleanup (R2 unreferenced image cleanup)
│       ├── entries/
│       │   ├── public.ts       # GET /api/entries/public?token= (read-only external API)
│       │   └── [id]/
│       │       └── comment.ts  # POST /api/entries/:id/comment (OpenClaw webhook writes AI comments)
│       └── image/
│           └── [id].ts         # GET /api/image/:id (R2 image serving)
├── wrangler.toml               # Cloudflare bindings (D1, KV, R2)
├── vite.config.js              # Vite + PWA config
└── public/                     # PWA manifest, icons
```

---

## Styling Conventions

### CSS Modules (Preferred)
Components use co-located CSS Modules for scoped styling:

```tsx
import styles from './Component.module.css';
<div className={styles.container}>
  <span className={styles.title}>...</span>
</div>
```

**Migrated Components:** Header, InputPanel, EditModal, TimelineEntry, Calendar, ContextMenu, Dropdown, SettingsModal, TasksPanel

### CSS Variables
Use design tokens from `base.css`:
- Colors: `var(--accent)`, `var(--bg-primary)`, `var(--text-primary)`, `var(--error)`, `var(--success)`
- Radius: `var(--radius-none)` (0), `var(--radius-sm)` (2px), `var(--radius-md)` (4px), `var(--radius-lg)` (8px)
- Fonts: `var(--font-mono)`, `var(--font-primary)`, `var(--font-display)`

### Design Language
- Brutalist/terminal aesthetic
- Angular shapes, hard borders (`1px solid var(--border-light)`)
- Monospaced typography for data
- Dark mode default, light mode supported via `[data-theme="light"]`

---

## Shared Components

### EntryMetadataInput
Shared component for editing entry metadata. Used by:
- `EditModal` - Full editing with linked entries
- `InputPanel` (Focus Mode) - Quick metadata selection

```tsx
<EntryMetadataInput
  category={category}
  setCategory={setCategory}
  contentType={contentType}
  setContentType={setContentType}
  fieldValues={fieldValues}
  setFieldValues={setFieldValues}
  tags={tags}
  setTags={setTags}
  linkedEntries={linkedEntries}        // Optional
  setLinkedEntries={setLinkedEntries}  // Optional
  allEntries={allEntries}              // For link search
  isExpanded={showMetadata}
  showLinkedEntries={true}             // Enable linked entries section
  mediaItems={mediaItems}              // For media-select fields
  onAddMediaItem={onAddMediaItem}      // Add new media item
/>
```

---

## State Management

### Session Reducer Actions (useSession.ts)

| Action | Description |
|--------|-------------|
| `LOG_IN` | Start new session, creates SESSION_START entry |
| `SWITCH` | End current session + start new one atomically |
| `NOTE` | Add a note entry (with optional contentType + fieldValues + category + tags) |
| `LOG_OFF` | End session, creates SESSION_END with duration |
| `DELETE_ENTRY` | Remove entry |
| `EDIT_ENTRY` | Update entry content only |
| `UPDATE_ENTRY` | Update content, timestamp, category, contentType, fieldValues, linkedEntries, tags, type, aiComment |
| `SET_ENTRY_CATEGORY` | Set category on an entry |
| `SET_API_KEY` | Update client-side AI API key |
| `SET_AI_CONFIG` | Update AI settings (apiKey, baseUrl, model) |
| `LOAD_STATE` | Initialize from localStorage |
| `IMPORT_DATA` | Replace entries/contentTypes/mediaItems from cloud data |
| `ADD_CONTENT_TYPE` | Create new content type |
| `UPDATE_CONTENT_TYPE` | Edit content type fields/options |
| `DELETE_CONTENT_TYPE` | Remove non-built-in content type |
| `ADD_MEDIA_ITEM` | Add media item to library |
| `UPDATE_MEDIA_ITEM` | Edit media item |
| `DELETE_MEDIA_ITEM` | Remove media item |

### Session Status
- `IDLE` - No active session
- `STREAMING` - Active session (green breathing indicator in UI)

### Performance Notes
- **Sync diffing** uses reference equality (`prev !== entry`) instead of JSON.stringify — relies on reducer's immutable update pattern where modified objects get new references
- **localStorage writes** are debounced (500ms) with `beforeunload` flush to avoid serializing full state on every keystroke
- **Timeline** memoizes sorted entries and session duration/line-state calculations via `useMemo`

---

## API Reference

### Authentication (Multi-Device)
Each device gets its own token stored in KV with 30-day TTL.

```http
POST /api/auth
Content-Type: application/json
Body: { "password": "string" }

Response 200: { "success": true, "token": "uuid-timestamp", "expiresAt": number }
Response 401: { "error": "Invalid password" }
```

### Data Sync (D1)
```http
# Full fetch — no auth required (public read)
GET /api/data

# Incremental fetch — only changes since timestamp
GET /api/data?since=<timestamp>

Response 200: {
  "entries": Entry[],
  "contentTypes": ContentType[],
  "mediaItems": MediaItem[],
  "lastModified": number | null,
  "deletedIds": string[],       // Only in incremental mode
  "incremental": boolean
}

# Authenticated incremental write (upsert + delete)
PUT /api/data
Authorization: Bearer <token>
Content-Type: application/json
Body: {
  "entries": Entry[],                    // Changed entries to upsert
  "deletedIds": string[],               // Entry IDs to delete
  "contentTypes": ContentType[],         // Changed content types
  "deletedContentTypeIds": string[],     // Content type IDs to delete
  "mediaItems": MediaItem[],             // Changed media items
  "deletedMediaItemIds": string[]        // Media item IDs to delete
}

Response 200: { "success": true, "lastModified": number }
```

Note: PUT triggers OpenClaw webhook for new entries (sends entry content to external AI for comment generation).

### AI Categorization + ContentType Detection
```http
POST /api/categorize
Authorization: Bearer <token>
Content-Type: application/json
Body: { "content": "string", "categories": Category[], "contentTypes": ContentType[] }

Response 200: {
  "category": "string|null",
  "contentType": "string",
  "fieldValues": object|null,
  "raw": "string"
}
```

**AI Detection Examples:**
- Input: "买牛奶" → `{contentType: "task", fieldValues: {done: false}, category: "hustle"}`
- Input: "Feeling tired after work" → `{contentType: "mood", fieldValues: {feeling: "Tired", trigger: "Work"}, category: "hardware"}`
- Input: "https://example.com/article" → `{contentType: "bookmark", fieldValues: {url: "...", status: "Inbox"}}`

### AI Comment Config
```http
# Get current AI comment configuration
GET /api/ai-config
Authorization: Bearer <token>

Response 200: { "hasApiKey": boolean, "baseUrl": "string", "model": "string", "persona": "string" }

# Update AI comment configuration (non-sensitive fields only)
PUT /api/ai-config
Authorization: Bearer <token>
Body: { "baseUrl?": "string", "model?": "string", "persona?": "string" }
```

### External Comment Write (OpenClaw Webhook)
```http
POST /api/entries/:id/comment
Authorization: Bearer <OPENCLAW_WEBHOOK_SECRET>
Content-Type: application/json
Body: { "comment": "string" }

Response 200: { "success": true, "entryId": "string", "comment": "string", "lastModified": number }
```

### Public Read API
```http
GET /api/entries/public?token=<PUBLIC_API_TOKEN>&start=<date>&end=<date>&limit=<n>
Response 200: { "entries": Entry[], "contentTypes": ContentType[], "mediaItems": MediaItem[], "count": number }
```

### Image Upload
```http
POST /api/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data
Body: file (image/jpeg, image/png, image/gif, image/webp, max 10MB)

Response 200: { "success": true, "url": "/api/image/filename.ext" }
```

### Image Cleanup
```http
POST /api/cleanup
Authorization: Bearer <token>

Response 200: { "deleted": string[], "kept": string[] }
```

---

## Common Tasks

### Add New ContentType
1. Add to `BUILTIN_CONTENT_TYPES` in `src/utils/constants.ts`
2. Add typed field values interface in `src/types/index.ts`
3. Add default fieldValues handling in `EntryMetadataInput.tsx`
4. Create display component in `ContentTypeDisplays.tsx`
5. Import and render in `TimelineEntry.tsx`
6. Update AI prompt in `functions/api/categorize.ts`

### Add New Category
Categories are defined in `constants.ts`. To add:
1. Add to `CategoryId` type union in `types/index.ts`
2. Add to `CATEGORIES` array in `constants.ts` (with `description` for AI)

### Create CSS Module for Component
1. Create `Component.module.css` in same directory
2. Import: `import styles from './Component.module.css'`
3. Use: `className={styles.container}`
4. Conditionals: `` className={`${styles.base} ${isActive ? styles.active : ''}`} ``

---

## Environment Variables (Cloudflare Dashboard)

| Variable | Description |
|----------|-------------|
| `AUTH_PASSWORD` | Password for cloud sync authentication |
| `CHRONOLOG_DB` | D1 database binding |
| `CHRONOLOG_KV` | KV namespace binding (auth tokens + AI config) |
| `CHRONOLOG_R2` | R2 bucket binding (image storage) |
| `AI_API_KEY` | OpenAI API key for categorization |
| `AI_COMMENT_API_KEY` | Separate API key for AI comment generation |
| `AI_BASE_URL` | (Optional) Custom AI API base URL |
| `AI_MODEL` | (Optional) AI model name, default: gpt-4o-mini |
| `OPENCLAW_WEBHOOK_SECRET` | Secret for OpenClaw webhook authentication |
| `PUBLIC_API_TOKEN` | Token for public read-only API access |

---

## Deployment

```bash
npm run build
npx wrangler pages deploy dist --project-name chronolog
```
