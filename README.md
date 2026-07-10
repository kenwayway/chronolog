# Chronolog

A local-first personal timeline, session tracker, journal, and media log. Chronolog works offline in the browser, persists locally, and can optionally synchronize encrypted-in-transit data across devices through Cloudflare.

## ✨ Features

### Core
- **Timeline View** — Track daily activities with timestamps
- **Session Tracking** — Log in/out to track work sessions with duration
- **Notes** — Add quick notes throughout the day
- **Life Categories** — Organize entries with the built-in Hustle, Craft, Hardware, Barter, Wander, and Work areas
- **Tags** — Add #hashtags to entries for easy filtering
- **Calendar & Filters** — Browse entries by date, category, tag, and content type
- **Linked Entries** — Create bidirectional connections between related entries

### Content Types
- **Note** — Default text entry
- **Bookmark** — Save links with title, type, and status; YouTube thumbnails auto-detected
- **Mood** — Track feelings, energy level (1–5), and triggers
- **Workout** — Log exercises with type (Strength/Cardio/Flexibility/Mixed) and place (Home/In Building Gym/Outside Gym)
- **Media** — Track books, movies, games, TV, anime, podcasts via Media Library
- **Custom Types** — Create your own content types with custom fields
- **Attachments** — Add images and locations to an entry; pasted images are compressed and uploaded when sync is enabled

### Cloud Sync
- **D1 Database** — Structured storage with incremental sync
- **Multi-Device Sync** — Auto-polling every 30s for cross-device changes
- **Image Upload** — Upload images or paste from clipboard (Ctrl+V)
- **Gallery** — Browse every attached image in a lazy-loaded photo wall
- **Bidirectional Sync** — Manual sync pushes AND pulls
- **Public API** — Token-authenticated read access to entries

### AI Features
- **Auto-Categorization** — AI detects category, content type, and field values from entry text
- **Content Type Detection** — Automatically identifies bookmarks, moods, workouts, etc.

### User Experience
- **Dark/Light Mode** — Persistent manual toggle with selectable accent colors
- **PWA Support** — Install as an app on mobile devices
- **Responsive Design** — Optimized for desktop and mobile
- **Multiple Themes** — Including a WW2 spy "Operation" theme
- **Context Menu** — Right-click (or long-press on mobile) for quick actions
- **Focus Mode** — Distraction-free writing experience
- **Mobile Metadata Input** — Tag/type/category available on mobile expanded panel
- **Data Export/Import** — Full JSON export including entries, categories, content types, and media items
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
| **Cloudflare D1** | SQLite database for entries, content types, media |
| **Cloudflare KV** | Auth tokens |
| **Cloudflare R2** | Image storage |

### Architecture

The client is local-first: the session reducer updates in-memory state, persistence writes a debounced snapshot to `localStorage`, and the sync engine sends only changed records when cloud sync is configured.
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
│   ├── modals/          #   Settings and entry editor
│   ├── panels/          #   Activity/filter sidebar
│   ├── providers/       #   Theme, toast, and UI state providers
│   └── timeline/        #   Timeline, entry displays, content renderer
├── contexts/            # React contexts and context value types
├── hooks/               # Session, persistence, sync, UI, and AI hooks
├── pages/               # Library and image gallery routes
├── themes/              # Theme definitions
├── types/               # Shared TypeScript models and guards
├── utils/               # Parsers, formatters, migrations, storage, sync helpers
└── App.tsx              # Route and provider composition

functions/             # Cloudflare Pages Functions (TypeScript)
├── api/
│   ├── _auth.ts       # Shared auth helpers
│   ├── _db.ts         # D1 helpers & row converters
│   ├── types.ts       # Shared type definitions
│   ├── auth.ts        # Authentication
│   ├── data.ts        # Data CRUD (incremental sync)
│   ├── categorize.ts  # AI categorization
│   ├── upload.ts      # Image upload to R2
│   ├── cleanup.ts     # Unreferenced image cleanup
│   ├── entries/       # Public read-only API
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
| `PUBLIC_API_TOKEN` | Token for the read-only public entries endpoint |

Apply [schema.sql](schema.sql) to the D1 database before first deployment.

## 📝 License

MIT
