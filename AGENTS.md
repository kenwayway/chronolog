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
  type: 'SESSION_START' | 'NOTE' | 'SESSION_END' | 'TASK_DONE'
  content: string               // User input text
  timestamp: number             // Unix timestamp (ms)
  
  // Optional fields by type:
  sessionId?: string            // SESSION_START only
  duration?: number             // SESSION_END only (ms since session start)
  isTodo?: boolean              // NOTE only
  taskId?: string               // NOTE with isTodo=true
  category?: string             // Category ID (e.g., 'work', 'craft')
  originalTaskId?: string       // TASK_DONE only
  originalCreatedAt?: number    // TASK_DONE only
}
```

### Task Object
```typescript
interface Task {
  id: string                    // UUID
  content: string               // Task description
  createdAt: number             // Timestamp when created
  entryId: string               // Reference to the NOTE entry
  done: boolean                 // Completion status
  completedAt?: number          // Timestamp when marked done
}
```

### Category (Fixed Constants)
Categories are **not user-editable**. Defined in `constants.js`:

| ID | Label | Color | Covers |
|----|-------|-------|--------|
| `hustle` | Hustle | #7aa2f7 (blue) | Work, 赚钱 |
| `craft` | Craft | #bb9af7 (purple) | Coding, drawing, 创作 |
| `hardware` | Hardware | #9ece6a (green) | Sleep, eat, workout |
| `kernel` | Kernel | #89ddff (cyan) | Learning, philosophy, 整理笔记 |
| `barter` | Barter | #e0af68 (orange) | Friends, social |
| `wonder` | Wonder | #f7768e (pink) | 旅游, 电影, 放松, 探索 |

### Application State
```typescript
interface State {
  status: 'IDLE' | 'STREAMING'  // Session status
  sessionStart: number | null   // Active session start time
  entries: Entry[]              // All timeline entries
  tasks: Task[]                 // Active and completed tasks
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
│  │ useSession  │ │useCloudSync  │ │   useCategories     │   │
│  │ (state mgmt)│ │  (sync)      │ │   (categories)      │   │
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
                  │ EditModal│   │ ContextMenu│
                  └──────────┘   └──────────┘
```

### Data Flow
1. **User Input** → `InputPanel` calls `actions.logIn()`, `actions.addNote()`, etc.
2. **State Update** → `useSession` reducer updates state
3. **Local Persist** → State auto-saved to localStorage
4. **Cloud Sync** → `useCloudSync` debounces and PUTs to `/api/data`

---

## Project Structure

```
├── src/
│   ├── App.jsx                 # Main app component, orchestrates everything
│   ├── main.jsx                # React entry point
│   ├── components/
│   │   ├── Header.jsx          # Top bar: logo, date nav, theme toggle
│   │   ├── Timeline.jsx        # Entry list with grouping by date
│   │   ├── InputPanel.jsx      # Text input, image paste, action buttons
│   │   ├── Calendar.jsx        # Date picker popover
│   │   ├── Dropdown.jsx        # Generic dropdown component
│   │   ├── ContextMenu.jsx     # Right-click menu for entries
│   │   ├── SettingsModal.jsx   # Configuration modal (AI, cloud, theme)
│   │   ├── EditModal.jsx       # Entry editing modal
│   │   ├── TasksPanel.jsx      # Right sidebar for pending tasks
│   │   └── ActivityPanel.jsx   # Left sidebar for stats
│   ├── hooks/
│   │   ├── useSession.js       # Core state: entries, tasks, reducer
│   │   ├── useCloudSync.js     # Auth, sync, image upload
│   │   ├── useCategories.js    # Category CRUD
│   │   ├── useTheme.jsx        # Theme and dark mode
│   │   └── useAI.js            # Auto-categorization via AI
│   ├── styles/
│   │   ├── base.css            # CSS variables, typography
│   │   ├── components.css      # Component-specific styles
│   │   └── responsive.css      # Mobile breakpoints (<768px)
│   ├── themes/                 # Theme files (default, operation, etc.)
│   └── utils/
│       ├── constants.js        # ENTRY_TYPES, ACTIONS, STORAGE_KEYS
│       └── formatters.js       # Date/time formatting, generateId()
├── functions/                  # Cloudflare Pages Functions
│   ├── _middleware.js          # Auth verification for protected routes
│   ├── api/
│   │   ├── auth.js             # POST /api/auth
│   │   ├── data.js             # GET/PUT /api/data
│   │   ├── upload.js           # POST /api/upload
│   │   ├── cleanup.js          # POST /api/cleanup
│   │   └── image/[id].js       # GET /api/image/:id
└── public/                     # PWA manifest, icons
```

---

## State Management

### Session Reducer Actions (useSession.js)

| Action | Description |
|--------|-------------|
| `LOG_IN` | Start new session, creates SESSION_START entry |
| `SWITCH` | End current session + start new one atomically |
| `NOTE` | Add a note entry (optionally as TODO) |
| `LOG_OFF` | End session, creates SESSION_END with duration |
| `ADD_TASK` | Create NOTE with isTodo=true + Task object |
| `COMPLETE_TASK` | Mark task done, create TASK_DONE entry |
| `DELETE_ENTRY` | Remove entry (and linked task if applicable) |
| `EDIT_ENTRY` | Update entry content only |
| `UPDATE_ENTRY` | Update content, timestamp, or category |
| `TOGGLE_TODO` | Convert NOTE ↔ TODO |
| `SET_ENTRY_CATEGORY` | Set category on an entry |
| `SET_AI_CONFIG` | Update AI settings (apiKey, baseUrl, model) |
| `LOAD_STATE` | Initialize from localStorage |
| `IMPORT_DATA` | Replace entries/tasks from cloud data |

### Session Status
- `IDLE` - No active session
- `STREAMING` - Active session (green breathing indicator in UI)

---

## API Reference

### Authentication
```http
POST /api/auth
Content-Type: application/json
Body: { "password": "string" }

Response 200: { "success": true, "token": "uuid-timestamp", "expiresAt": number }
Response 401: { "error": "Invalid password" }
```

### Data CRUD
```http
# Public read - no auth required
GET /api/data

Response 200: {
  "entries": Entry[],
  "tasks": Task[],
  "categories": Category[] | null,
  "lastModified": number | null
}

# Authenticated write
PUT /api/data
Authorization: Bearer <token>
Content-Type: application/json
Body: { "entries": Entry[], "tasks": Task[], "categories": Category[] }

Response 200: { "success": true, "lastModified": number }
```

### Image Upload
```http
POST /api/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data
Body: file (image/jpeg, image/png, image/gif, image/webp, max 10MB)

Response 200: { "success": true, "url": "/api/image/filename.ext", "filename": "string" }
Response 400: { "error": "Invalid file type" | "File too large (max 10MB)" }
```

### Serve Image
```http
GET /api/image/:id

Response 200: Image binary with appropriate Content-Type
Response 404: { "error": "Image not found" }
```

### Cleanup Unused Images
```http
POST /api/cleanup
Authorization: Bearer <token>

Response 200: { "deleted": string[], "kept": string[] }
```

---

## Component Relationships

| Component | Uses Hooks | Key Props/Dependencies |
|-----------|------------|------------------------|
| `App.jsx` | useSession, useCloudSync, useCategories, useTheme | Passes state/actions to children |
| `Header.jsx` | - | selectedDate, theme, onNavigate |
| `Timeline.jsx` | - | entries, categories, onEdit, onDelete |
| `InputPanel.jsx` | - | isStreaming, categories, onSubmit, uploadImage |
| `TasksPanel.jsx` | - | tasks, onComplete, onDelete |
| `ActivityPanel.jsx` | - | entries, categories |
| `SettingsModal.jsx` | - | cloudSync, aiConfig, categories |
| `EditModal.jsx` | - | entry, categories, onSave |

---

## Environment Variables (Cloudflare Dashboard)

| Variable | Description |
|----------|-------------|
| `AUTH_PASSWORD` | Password for cloud sync authentication |
| `CHRONOLOG_KV` | KV namespace binding for data storage |
| `CHRONOLOG_R2` | R2 bucket binding for image storage |

---

## Styling Conventions

1. **CSS Variables** - Use `base.css` tokens: `var(--accent)`, `var(--bg-primary)`, `var(--text-primary)`
2. **Component Classes** - Define in `components.css`, prefix with component name
3. **Responsive** - Mobile styles in `responsive.css`, breakpoint at 768px
4. **No Inline Styles** - Always use CSS classes
5. **Themes** - Theme files in `src/themes/` directory

---

## Common Tasks

### Add New Entry Type
1. Add to `ENTRY_TYPES` in `src/utils/constants.js`
2. Add reducer case in `useSession.js`
3. Handle rendering in `Timeline.jsx`

### Add New Category
Categories are managed via `useCategories.js` hook and stored in localStorage with key `chronolog_categories`. Defaults defined in `constants.js`.

### Add New API Endpoint
1. Create `functions/api/[endpoint].js`
2. Export `onRequestGet`, `onRequestPost`, etc.
3. Check `_middleware.js` for auth patterns

### Modify Cloud Sync Behavior
Edit `useCloudSync.js`. Key constants:
- `SYNC_DEBOUNCE_MS = 2000` - Debounce delay for auto-sync

---

## Common Pitfalls

1. **Session Detection on Import** - `IMPORT_DATA` scans entries to detect active session state. Ensure SESSION_START/SESSION_END pairs are consistent.

2. **Task-Entry Linking** - Tasks always have an `entryId`. Deleting an entry also deletes its linked task.

3. **Image References** - Images in entry content use format `🖼️ /api/image/{filename}`. The cleanup endpoint parses content to find referenced images.

4. **Auth Token Storage** - Token stored in memory (`tokenRef`), not in state. Token metadata (including `expiresAt`) persisted to localStorage.

5. **Timestamp Ordering** - SWITCH action uses `now + 1` for new session start to guarantee ordering after session end.

---

## Deployment

```bash
npm run build
npx wrangler pages deploy dist --project-name chronolog
```

Live at: [chronolog.pages.dev](https://chronolog.pages.dev)
