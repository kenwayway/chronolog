# Chronolog - AI Agent Context

## Quick Start
Chronolog is a minimalist time-tracking and journaling PWA. Entry point is `src/App.jsx`, which orchestrates all hooks and components.

```bash
npm run dev      # Start development server
npm run build    # Build for production
```

---

## Tech Stack
| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, Vite, Vanilla CSS |
| **Backend** | Cloudflare Pages Functions |
| **Data Storage** | Cloudflare KV |
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
  contentType?: string          // 'note' | 'task' | 'expense' | custom
  fieldValues?: Record<string, unknown>  // Dynamic field values
}
```

### ContentType System
ContentTypes define schemas for structured entries. Built-in types:

| ID | Name | Icon | Fields |
|----|------|------|--------|
| `note` | Note | 📝 | (none) |
| `task` | Task | ☐ | `done: boolean` |
| `expense` | Expense | 💰 | `amount, currency, category, subcategory` |

```typescript
interface ContentType {
  id: string
  name: string
  icon: string
  fields: FieldDefinition[]
  builtIn?: boolean
}

interface FieldDefinition {
  id: string
  name: string
  type: 'text' | 'number' | 'dropdown' | 'boolean' | 'date' | 'rating'
  options?: string[]    // For dropdown
  required?: boolean
  default?: unknown
}
```

**Expense fieldValues example:**
```json
{
  "amount": 35,
  "currency": "CNY",
  "category": "Food",
  "subcategory": "Cafe"
}
```

### Category (Fixed Constants)
Categories are **not user-editable**. Defined in `constants.ts`:

| ID | Label | Color | Covers |
|----|-------|-------|--------|
| `hustle` | Hustle | #7aa2f7 (blue) | Work, 赚钱 |
| `craft` | Craft | #bb9af7 (purple) | Coding, drawing, 创作 |
| `hardware` | Hardware | #4dcc59 (green) | Sleep, eat, workout |
| `kernel` | Kernel | #89ddff (cyan) | Learning, philosophy, 整理笔记 |
| `barter` | Barter | #c8e068 (yellow-green) | Friends, social |
| `wonder` | Wonder | #f7768e (pink) | 旅游, 电影, 放松, 探索 |
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
│                         App.jsx                              │
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
                  ┌──────────┐   ┌──────────┐
                  │ EditModal│   │ContextMenu│
                  └──────────┘   └──────────┘
```

### Data Flow
1. **User Input** → `InputPanel` calls `actions.logIn()`, `actions.addNote()`, etc.
2. **State Update** → `useSession` reducer updates state
3. **Local Persist** → State auto-saved to localStorage
4. **Cloud Sync** → `useCloudSync` debounces and PUTs to `/api/data`
5. **AI Detection** → New entries trigger `/api/categorize` for auto-detection of category + contentType + fieldValues

---

## Project Structure

```
├── src/
│   ├── App.jsx                 # Main app component, orchestrates everything
│   ├── main.jsx                # React entry point
│   ├── components/
│   │   ├── common/             # Dropdown, ContextMenu
│   │   ├── input/              # InputPanel, FocusMode, AttachmentPreview
│   │   ├── layout/             # Header
│   │   ├── modals/             # EditModal, SettingsModal
│   │   ├── panels/             # TasksPanel, ActivityPanel
│   │   └── timeline/           # Timeline, TimelineEntry
│   ├── hooks/
│   │   ├── useSession.ts       # Core state: entries, contentTypes, reducer
│   │   ├── useCloudSync.ts     # Auth, sync, image upload
│   │   ├── useTheme.tsx        # Theme, accent colors
│   │   ├── useAICategories.ts  # Auto-categorization + contentType detection
│   │   └── useGoogleTasks.ts   # Google Tasks integration
│   ├── styles/                 # CSS files
│   ├── themes/                 # Theme files
│   ├── types/
│   │   └── index.ts            # TypeScript interfaces
│   └── utils/
│       ├── constants.ts        # ENTRY_TYPES, ACTIONS, BUILTIN_CONTENT_TYPES
│       └── formatters.ts       # Date/time formatting, generateId()
├── functions/                  # Cloudflare Pages Functions
│   ├── api/
│   │   ├── auth.js             # POST /api/auth
│   │   ├── data.js             # GET/PUT /api/data
│   │   ├── upload.js           # POST /api/upload
│   │   ├── cleanup.js          # POST /api/cleanup
│   │   ├── categorize.js       # POST /api/categorize (AI detection)
│   │   └── image/[id].js       # GET /api/image/:id
└── public/                     # PWA manifest, icons
```

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
| `UPDATE_ENTRY` | Update content, timestamp, category, contentType, fieldValues |
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

**Token Storage**: `auth_token:{token}` = `"valid"` (30-day TTL per device)

### Data CRUD
```http
# Public read - no auth required
GET /api/data

Response 200: {
  "entries": Entry[],
  "contentTypes": ContentType[],
  "lastModified": number | null
}

# Authenticated write
PUT /api/data
Authorization: Bearer <token>
Content-Type: application/json
Body: { "entries": Entry[], "contentTypes": ContentType[] }

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
- Input: "午饭花了35块" → `{category: "beans", contentType: "expense", fieldValues: {amount: 35, currency: "CNY", category: "Food"}}`
- Input: "买牛奶" → `{contentType: "task", fieldValues: {done: false}}`

### Image Upload
```http
POST /api/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data
Body: file (image/jpeg, image/png, image/gif, image/webp, max 10MB)

Response 200: { "success": true, "url": "/api/image/filename.ext" }
```

### Serve Image
```http
GET /api/image/:id

Response 200: Image binary with appropriate Content-Type
Response 404: { "error": "Image not found" }
```

---

## Component Relationships

| Component | Key Features |
|-----------|--------------|
| `TimelineEntry.jsx` | Displays entry with contentType badge (💰$35 · Food › Cafe) |
| `EditModal.jsx` | Edit content, timestamp, category, contentType, fieldValues |
| `InputPanel.jsx` | Text input, image paste, action buttons |
| `TasksPanel.jsx` | Google Tasks integration |
| `ContextMenu.jsx` | Right-click: Mark as Task, Edit, Copy, Delete |

---

## Environment Variables (Cloudflare Dashboard)

| Variable | Description |
|----------|-------------|
| `AUTH_PASSWORD` | Password for cloud sync authentication |
| `CHRONOLOG_KV` | KV namespace binding for data storage |
| `CHRONOLOG_R2` | R2 bucket binding for image storage |
| `AI_API_KEY` | OpenAI API key for backend categorization |
| `AI_BASE_URL` | (Optional) Custom AI API base URL |
| `AI_MODEL` | (Optional) AI model name, default: gpt-4o-mini |

---

## Styling Conventions

1. **CSS Variables** - Use `base.css` tokens: `var(--accent)`, `var(--bg-primary)`, `var(--text-primary)`
2. **Component Classes** - Define in `components.css`, prefix with component name
3. **Responsive** - Mobile styles in `responsive.css`, breakpoint at 768px
4. **Themes** - Theme files in `src/themes/` directory

---

## Common Tasks

### Add New ContentType
1. Add to `BUILTIN_CONTENT_TYPES` in `src/utils/constants.ts`
2. Update AI prompt in `functions/api/categorize.js`
3. Add display logic in `TimelineEntry.jsx`
4. Add field editing in `EditModal.jsx`

### Add New Category
Categories are defined in `constants.ts`. To add:
1. Add to `CategoryId` type in `types/index.ts`
2. Add to `CATEGORIES` array in `constants.ts`

### Add New API Endpoint
1. Create `functions/api/[endpoint].js`
2. Export `onRequestGet`, `onRequestPost`, etc.
3. Use Bearer token auth pattern from `categorize.js`

---

## Deployment

```bash
npm run build
npx wrangler pages deploy dist --project-name chronolog
```

Live at: [chronolog.pages.dev](https://chronolog.pages.dev)
