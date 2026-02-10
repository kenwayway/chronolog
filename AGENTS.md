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
| **Backend** | Cloudflare Pages Functions |
| **Data Storage** | Cloudflare D1 (SQLite) |
| **Auth/Config** | Cloudflare KV (auth tokens, AI config) |
| **Image Storage** | Cloudflare R2 |
| **AI** | OpenAI-compatible API |

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
  contentType?: string          // 'note' | 'task' | 'bookmark' | 'mood' | 'workout' | custom
  fieldValues?: Record<string, unknown>  // Dynamic field values
  linkedEntries?: string[]      // Bidirectional linked entry IDs
  tags?: string[]               // Free-form tags (without # prefix)
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

```typescript
interface ContentType {
  id: string
  name: string
  fields: FieldDefinition[]
  builtIn?: boolean
  order?: number
}

interface FieldDefinition {
  id: string
  name: string
  type: 'text' | 'number' | 'dropdown' | 'boolean'
  options?: string[]    // For dropdown
  required?: boolean
  default?: unknown
}
```

### Category (Fixed Constants)
Categories are **not user-editable**. Defined in `constants.ts`:

| ID | Label | Color | Covers |
|----|-------|-------|--------|
| `hustle` | Hustle | #7aa2f7 (blue) | Work, 赚钱 |
| `craft` | Craft | #bb9af7 (purple) | Coding, drawing, 创作 |
| `hardware` | Hardware | #4dcc59 (green) | Sleep, eat, workout |
| `sparks` | Sparks | #89ddff (cyan) | Learning, philosophy, 整理笔记 |
| `barter` | Barter | #c8e068 (yellow-green) | Friends, social |
| `wander` | Wander | #f7768e (pink) | 旅游, 电影, 放松, 探索 |
| `beans` | Beans | #ff9e64 (orange) | Small knowledge tidbits △ |

### Application State
```typescript
interface SessionState {
  status: 'IDLE' | 'STREAMING'  // Session status
  sessionStart: number | null   // Active session start time
  entries: Entry[]              // All timeline entries
  contentTypes: ContentType[]   // User's content types (includes built-in)
  apiKey: string | null         // OpenAI API key
  aiBaseUrl: string             // AI endpoint base URL
  aiModel: string               // AI model name
}
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         App.tsx                              │
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────────────┐   │
│  │ useSession  │ │useCloudSync  │ │  useAICategories    │   │
│  │ (state mgmt)│ │  (sync)      │ │  (auto-detect)      │   │
│  └─────────────┘ └──────────────┘ └─────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
              │                │                │
    ┌─────────┴─────────┬──────┴──────┬─────────┴──────────┐
    ▼                   ▼             ▼                    ▼
┌────────┐        ┌──────────┐   ┌──────────┐       ┌───────────┐
│ Header │        │ Timeline │   │InputPanel│       │TasksPanel │
└────────┘        └──────────┘   └──────────┘       └───────────┘
                        │              │
                        ▼              ▼
                  ┌──────────┐   ┌──────────────────┐
                  │ EditModal│   │EntryMetadataInput│
                  └──────────┘   └──────────────────┘
```

### Data Flow
1. **User Input** → `InputPanel` calls `actions.logIn()`, `actions.addNote()`, etc.
2. **State Update** → `useSession` reducer updates state
3. **Local Persist** → State auto-saved to localStorage
4. **Cloud Sync** → `useCloudSync` diffs changes and PUTs only modified entries to `/api/data` (D1 incremental upsert)
5. **AI Detection** → New entries trigger `/api/categorize` for auto-detection of category + contentType + fieldValues

---

## Project Structure

```
├── src/
│   ├── App.tsx                 # Main app component, orchestrates everything
│   ├── main.tsx                # React entry point
│   ├── components/
│   │   ├── Header.tsx          # App header with session controls
│   │   ├── Header.module.css   # CSS Module for Header
│   │   ├── common/             # Dropdown, ContextMenu
│   │   ├── input/
│   │   │   ├── InputPanel.tsx          # Main input area
│   │   │   ├── InputPanel.module.css   # CSS Module
│   │   │   ├── EntryMetadataInput.tsx  # SHARED: Category, Type, Tags, Fields, Links
│   │   │   ├── DynamicFieldForm.tsx    # Dynamic fields based on ContentType
│   │   │   └── InputActions.tsx        # Action buttons (Note, Log In, etc)
│   │   ├── modals/
│   │   │   ├── EditModal.tsx           # Edit entry modal (uses EntryMetadataInput)
│   │   │   ├── EditModal.module.css    # CSS Module
│   │   │   └── SettingsModal.tsx       # Settings
│   │   ├── panels/             # TasksPanel, ActivityPanel
│   │   └── timeline/
│   │       ├── Timeline.tsx            # Entry list
│   │       ├── TimelineEntry.tsx       # Single entry display
│   │       ├── TimelineEntry.module.css# CSS Module
│   │       └── ContentTypeDisplays.tsx # Bookmark, Mood, Workout displays
│   ├── hooks/
│   │   ├── useSession.ts       # Core state: entries, contentTypes, reducer
│   │   ├── useCloudSync.ts     # Auth, sync, image upload
│   │   ├── useTheme.tsx        # Theme, accent colors
│   │   ├── useAICategories.ts  # Auto-categorization + contentType detection
│   │   ├── useEntryHandlers.ts # Entry action handlers
│   │   └── useGoogleTasks.ts   # Google Tasks integration
│   ├── styles/
│   │   ├── base.css            # CSS variables, design tokens
│   │   ├── components.css      # Global component styles (legacy)
│   │   └── responsive.css      # Mobile breakpoints
│   ├── themes/                 # Theme files (tokyo-night, etc)
│   ├── types/
│   │   ├── index.ts            # TypeScript interfaces
│   │   └── css-modules.d.ts    # CSS Modules type declarations
│   └── utils/
│       ├── constants.ts        # ENTRY_TYPES, ACTIONS, BUILTIN_CONTENT_TYPES
│       └── formatters.ts       # Date/time formatting, generateId()
├── functions/                  # Cloudflare Pages Functions
│   └── api/
│       ├── _auth.js            # Shared auth helpers
│       ├── _db.js              # Shared D1 database helpers
│       ├── auth.js             # POST /api/auth
│       ├── data.js             # GET/PUT /api/data (D1 incremental sync)
│       ├── upload.js           # POST /api/upload
│       ├── categorize.js       # POST /api/categorize (AI detection)
│       ├── cleanup.js          # POST /api/cleanup (R2 image cleanup)
│       ├── migrate.js          # POST /api/migrate (one-time KV→D1)
│       ├── entries/public.js   # GET /api/entries/public
│       └── image/[id].js       # GET /api/image/:id
└── public/                     # PWA manifest, icons
```

---

## Styling Conventions

### CSS Modules (Preferred)
Components use co-located CSS Modules for scoped styling:

```tsx
// Component.tsx
import styles from './Component.module.css';

<div className={styles.container}>
  <span className={styles.title}>...</span>
</div>
```

```css
/* Component.module.css */
.container { ... }
.title { ... }
```

**Migrated Components:**
- `Header.module.css`
- `InputPanel.module.css`
- `EditModal.module.css`
- `TimelineEntry.module.css`

### CSS Variables
Use design tokens from `base.css`:
- Colors: `var(--accent)`, `var(--bg-primary)`, `var(--text-primary)`
- Radius: `var(--radius-none)` (0), `var(--radius-sm)` (2px), `var(--radius-md)` (4px)
- Fonts: `var(--font-mono)`, `var(--font-sans)`

### Brutalist Design
- Angular shapes (`border-radius: 0` or `var(--radius-none)`)
- Hard borders (`1px solid var(--border-light)`)
- Mono-spaced typography for data

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
/>
```

Features:
- Category dropdown
- Content Type dropdown (auto-resets fieldValues)
- Tags input with inline display
- DynamicFieldForm (based on ContentType schema)
- Linked Entries search and management

---

## State Management

### Session Reducer Actions (useSession.ts)

| Action | Description |
|--------|-------------|
| `LOG_IN` | Start new session, creates SESSION_START entry |
| `SWITCH` | End current session + start new one atomically |
| `NOTE` | Add a note entry (with optional contentType + fieldValues) |
| `LOG_OFF` | End session, creates SESSION_END with duration |
| `DELETE_ENTRY` | Remove entry |
| `EDIT_ENTRY` | Update entry content only |
| `UPDATE_ENTRY` | Update content, timestamp, category, contentType, fieldValues, linkedEntries, tags, **type** |
| `SET_ENTRY_CATEGORY` | Set category on an entry |
| `SET_AI_CONFIG` | Update AI settings (apiKey, baseUrl, model) |
| `LOAD_STATE` | Initialize from localStorage |
| `IMPORT_DATA` | Replace entries/contentTypes from cloud data |
| `ADD_CONTENT_TYPE` | Create new content type |
| `UPDATE_CONTENT_TYPE` | Edit content type fields/options |
| `DELETE_CONTENT_TYPE` | Remove non-built-in content type |

### Session Status
- `IDLE` - No active session
- `STREAMING` - Active session (green breathing indicator in UI)

---

## API Reference

### Authentication (Multi-Device)
Each device gets its own token. Tokens are stored independently in KV.

```http
POST /api/auth
Content-Type: application/json
Body: { "password": "string" }

Response 200: { "success": true, "token": "uuid-timestamp", "expiresAt": number }
Response 401: { "error": "Invalid password" }
```

### Data Sync (D1)
```http
# Full fetch - no auth required
GET /api/data

# Incremental fetch - only changes since timestamp
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
- Input: "买牛奶" → `{contentType: "task", fieldValues: {done: false}}`
- Input: "Feeling tired after work" → `{contentType: "mood", fieldValues: {feeling: "Tired", trigger: "Work"}}`

### Image Upload
```http
POST /api/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data
Body: file (image/jpeg, image/png, image/gif, image/webp, max 10MB)

Response 200: { "success": true, "url": "/api/image/filename.ext" }
```

---

## Common Tasks

### Add New ContentType
1. Add to `BUILTIN_CONTENT_TYPES` in `src/utils/constants.ts`
2. Add default fieldValues in `EntryMetadataInput.tsx` content type change handler
3. Create display component in `ContentTypeDisplays.tsx`
4. Import and render in `TimelineEntry.tsx`
5. Update AI prompt in `functions/api/categorize.js`

### Add New Category
Categories are defined in `constants.ts`. To add:
1. Add to `CategoryId` type in `types/index.ts`
2. Add to `CATEGORIES` array in `constants.ts`

### Create CSS Module for Component
1. Create `Component.module.css` in same directory
2. Import: `import styles from './Component.module.css'`
3. Use: `className={styles.container}`
4. Conditionals: `className={\`${styles.base} ${isActive ? styles.active : ''}\`}`

---

## Environment Variables (Cloudflare Dashboard)

| Variable | Description |
|----------|-------------|
| `AUTH_PASSWORD` | Password for cloud sync authentication |
| `CHRONOLOG_DB` | D1 database binding for data storage |
| `CHRONOLOG_KV` | KV namespace binding for auth tokens + config |
| `CHRONOLOG_R2` | R2 bucket binding for image storage |
| `AI_API_KEY` | OpenAI API key for backend categorization |
| `AI_BASE_URL` | (Optional) Custom AI API base URL |
| `AI_MODEL` | (Optional) AI model name, default: gpt-4o-mini |

---

## Deployment

```bash
npm run build
npx wrangler pages deploy dist --project-name chronolog
```

Live at: [chronolog.pages.dev](https://chronolog.pages.dev)
