# Chronolog

A minimalist personal timeline and activity tracker with cloud sync support.

## ✨ Features

### Core
- **Timeline View** — Track daily activities with timestamps
- **Session Tracking** — Log in/out to track work sessions with duration
- **Notes** — Add quick notes throughout the day
- **Categories** — Organize entries with custom color-coded categories
- **Tags** — Add #hashtags to entries for easy filtering
- **Calendar Navigation** — Browse entries by date

### Content Types
- **Note** — Default text entry
- **Bookmark** — Save links with title, type, and status; YouTube thumbnails auto-detected
- **Mood** — Track feelings, energy level (1–5), and triggers
- **Workout** — Log exercises with type (Strength/Cardio/Flexibility/Mixed) and place (Home/In Building Gym/Outside Gym)
- **Media** — Track books, movies, games, TV, anime, podcasts via Media Library
- **Custom Types** — Create your own content types with custom fields

### Cloud Sync
- **D1 Database** — Structured storage with incremental sync
- **Multi-Device Sync** — Auto-polling every 30s for cross-device changes
- **Image Upload** — Upload images or paste from clipboard (Ctrl+V)
- **Bidirectional Sync** — Manual sync pushes AND pulls
- **Public API** — Token-authenticated read access to entries

### AI Features
- **Auto-Categorization** — AI detects category, content type, and field values from entry text
- **Content Type Detection** — Automatically identifies bookmarks, moods, workouts, etc.

### User Experience
- **Dark/Light Mode** — System preference detection + manual toggle
- **PWA Support** — Install as an app on mobile devices
- **Responsive Design** — Optimized for desktop and mobile
- **Multiple Themes** — Including a WW2 spy "Operation" theme
- **Context Menu** — Right-click (or long-press on mobile) for quick actions
- **Focus Mode** — Distraction-free writing experience
- **Mobile Metadata Input** — Tag/type/category available on mobile expanded panel
- **Data Export/Import** — Full JSON export including entries, categories, content types, and media items

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

### Deployment
```bash
# Deploy to Cloudflare Pages
npm run build
npx wrangler pages deploy dist --project-name chronolog
```

## 📁 Project Structure

```
src/
├── components/        # React components
│   ├── input/         #   Input panel, metadata, focus mode
│   ├── timeline/      #   Timeline, content type displays
│   ├── modals/        #   Settings, edit, lightbox
│   └── common/        #   Dropdown, calendar, etc.
├── hooks/             # Custom React hooks
│   ├── useSession.ts  #   State management & reducer
│   └── useCloudSync.ts #  Cloud sync with polling
├── types/             # TypeScript type definitions
├── styles/            # CSS modules & themes
└── utils/             # Constants, formatters, storage

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

## 📝 License

MIT
