# Chronolog

A local-first personal timeline, session tracker, journal, and media log. Chronolog works offline in the browser, persists locally, and can optionally synchronize encrypted-in-transit data across devices through Cloudflare.

## ✨ Features

### Core
- **Timeline View** — Track daily activities with timestamps
- **Session Tracking** — Log in/out to track work sessions with duration
- **Notes** — Add quick notes throughout the day
- **Life Categories** — Organize notes and sessions with the built-in Hustle, Craft, Hardware, Barter, Wander, and Work areas
- **Tags** — Add #hashtags for easy filtering
- **Calendar & Filters** — Browse notes and sessions by date, category, tag, and content type
- **Linked Items** — Create bidirectional connections between notes and sessions

### Content Types
- **Note** — Default text record
- **Bookmark** — Save links with title, type, and status; YouTube thumbnails auto-detected
- **Mood** — Track feelings, energy level (1–5), and triggers
- **Workout** — Log exercises with type (Strength/Cardio/Flexibility/Mixed) and place (Home/In Building Gym/Outside Gym)
- **Media** — Track books, movies, games, TV, anime, podcasts via Media Library
- **Notion Task** — Link timed sessions to a Notion task and sync recomputed tracked minutes back to its database row
- **Custom Types** — Create your own content types with custom fields
- **Attachments** — Add images and locations; pasted images are compressed and uploaded when sync is enabled

### Cloud Sync
- **D1 Database** — Structured storage with incremental sync
- **Multi-Device Sync** — Auto-polling every 30s for cross-device changes
- **Image Upload** — Upload images or paste from clipboard (Ctrl+V)
- **Gallery** — Browse every attached image in a lazy-loaded photo wall
- **Bidirectional Sync** — Manual sync pushes AND pulls
- **Public API** — Token-authenticated read access to first-class notes and sessions

### AI Features
- **Auto-Categorization** — AI detects category, content type, and field values from captured text
- **Content Type Detection** — Automatically identifies bookmarks, moods, workouts, etc.

### User Experience
- **Dark/Light Mode** — Persistent manual toggle with selectable accent colors
- **PWA Support** — Install as an app on mobile devices
- **Responsive Design** — Optimized for desktop and mobile
- **Multiple Themes** — Including a WW2 spy "Operation" theme
- **Context Menu** — Right-click (or long-press on mobile) for quick actions
- **Focus Mode** — Distraction-free writing experience
- **Mobile Metadata Input** — Tag/type/category available on mobile expanded panel
- **Data Export/Import** — Full JSON export including notes, sessions, categories, content types, and media items
- **Quality Checks** — Type checking, ESLint, unit tests, and production builds run in CI

## 🛠 Tech Stack

### Frontend
| Technology | Usage |
|------------|-------|
| **React 19** | UI framework |
| **TypeScript** | Type safety |
| **Vite** | Build tool & dev server |
| **CSS Modules** | Component-scoped styling with CSS variables |
| **Lucide React** | Icon library |
| **Vite PWA** | Progressive Web App support |

### Backend
| Technology | Usage |
|------------|-------|
| **Cloudflare Pages Functions** | Serverless API (TypeScript) |
| **Cloudflare D1** | SQLite database for notes, sessions, content types, and media |
| **Cloudflare KV** | Auth tokens |
| **Cloudflare R2** | Image storage |

### Architecture

The client is local-first: notes and sessions are the only persisted timeline entities. A view-only `TimelineItem` projection renders session start/end markers. IndexedDB persistence is debounced, and `SyncCoordinator` sends durable revision mutations for changed notes, sessions, content types, and media items.
```
┌─────────────────┐     ┌──────────────────┐
│   React App     │────▶│ Cloudflare Pages │
│   (TypeScript)  │     │    (Hosting)     │
└─────────────────┘     └──────────────────┘
                               │
                               ▼
                    ┌──────────────────┐
                    │ Pages Functions  │
                    │  (TypeScript)    │
                    └──────────────────┘
                      │     │       │
            ┌─────────┘     │       └─────────┐
            ▼               ▼                 ▼
  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │ Cloudflare   │  │ Cloudflare   │  │ Cloudflare   │
  │ D1 (SQLite)  │  │ KV (Auth)    │  │ R2 (Images)  │
  └──────────────┘  └──────────────┘  └──────────────┘
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or pnpm

### Development
```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests / lint / typecheck
npm test
npm run lint
npm run typecheck

# Build for production (runs tsc first)
npm run build
```

### Quality checks

```bash
npm run lint       # ESLint (zero warnings expected)
npm run typecheck  # Type-check frontend and Cloudflare Functions
npm test           # Vitest unit tests
npm run build      # Type-check and create a production PWA build
```

GitHub Actions runs all four checks for pull requests and pushes to `main`.

### Deployment
```bash
# Existing databases: apply pending D1 migrations first
npx wrangler d1 migrations apply chronolog --remote

# Deploy to Cloudflare Pages
npm run build
npx wrangler pages deploy dist --project-name chronolog
```

## 📁 Project Structure

```
src/
├── components/          # UI components
│   ├── common/          #   Calendar, dropdowns, links, toasts
│   ├── input/           #   Quick capture, metadata, focus mode
│   ├── library/         #   Media library and item forms
│   ├── modals/          #   Settings and timeline item editor
│   ├── panels/          #   Activity/filter sidebar
│   ├── providers/       #   Theme, toast, and UI state providers
│   └── timeline/        #   Timeline item views and content renderer
├── domain/              # Note/Session → TimelineItem projection
├── features/            # Content type registry and SyncCoordinator
├── contexts/            # React contexts and context value types
├── hooks/               # Session, persistence, sync, UI, and AI hooks
├── pages/               # Library and image gallery routes
├── themes/              # Theme definitions
├── types/               # Shared TypeScript domain models
├── utils/               # Parsers, formatters, storage, and sync helpers
└── App.tsx              # Route and provider composition

functions/             # Cloudflare Pages Functions (TypeScript)
├── api/
│   ├── _auth.ts       # Shared auth helpers
│   ├── _db.ts         # D1 helpers & row converters
│   ├── _revisionSync.ts # Atomic revision commits and tombstones
│   ├── types.ts       # Shared type definitions
│   ├── auth.ts        # Authentication
│   ├── data.ts        # Data CRUD (incremental sync)
│   ├── categorize.ts  # AI categorization
│   ├── upload.ts      # Image upload to R2
│   ├── cleanup.ts     # Unreferenced image cleanup
│   ├── public.ts      # Public read-only notes/sessions API
│   └── image/[id].ts  # Image serving from R2
└── _middleware.ts     # Auth & CORS middleware
```

## 🔐 Configuration

Cloud sync is optional. Configure these bindings and variables in the Cloudflare dashboard before deploying:

| Name | Purpose |
|------|---------|
| `AUTH_PASSWORD` | Password accepted by the sync login endpoint |
| `CHRONOLOG_DB` | D1 database binding |
| `CHRONOLOG_KV` | KV namespace for device auth tokens |
| `CHRONOLOG_R2` | R2 bucket for image uploads |
| `AI_API_KEY` | API key used by server-side categorization |
| `AI_BASE_URL` | Optional OpenAI-compatible API base URL |
| `AI_MODEL` | Optional categorization model name |
| `PUBLIC_API_TOKEN` | Token for `GET /api/public` and read-only MCP access |
| `MCP_WRITE_TOKEN` | MCP token granting read access plus `add_note`, `start_session`, and `end_session` |
| `NOTION_API_TOKEN` | Notion internal integration secret used only by Pages Functions |
| `NOTION_TRACKED_MINUTES_PROPERTY` | Optional Notion number property name or ID; defaults to `Tracked Minutes` |

Apply [schema.sql](schema.sql) before a fresh deployment. Existing databases
must apply the ordered SQL files in `migrations/` before deploying new code.
Migration `0006_note_session_domain.sql` is intentionally breaking: it folds
historical session boundary rows into `sessions`, moves notes into `notes`, and
drops the old boundary table. Deploy the migrated database and new application
code together.

For Notion task syncing, add a number property named `Tracked Minutes` (or set
`NOTION_TRACKED_MINUTES_PROPERTY` to its name/property ID), then share the task
database with the internal integration represented by `NOTION_API_TOKEN`.

## 📝 License

MIT
