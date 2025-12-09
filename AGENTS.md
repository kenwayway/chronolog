# Chronolog - AI Agent Context

## Project Overview
Chronolog is a minimalist time-tracking and journaling PWA built with React + Vite, deployed on Cloudflare Pages.

## Tech Stack
- **Frontend**: React 18, Vite, vanilla CSS
- **Backend**: Cloudflare Pages Functions (serverless)
- **Storage**: Cloudflare KV (data), Cloudflare R2 (images)
- **AI**: OpenAI-compatible API for auto-categorization

## Project Structure
```
├── src/
│   ├── components/        # React components
│   │   ├── Header.jsx     # Top bar with logo, date nav, theme toggle
│   │   ├── Timeline.jsx   # Main entry list display
│   │   ├── InputPanel.jsx # Text input with actions
│   │   ├── SettingsModal.jsx # Config modal with tabs
│   │   ├── EditModal.jsx  # Entry editing modal
│   │   ├── TasksPanel.jsx # Right sidebar for tasks
│   │   └── ActivityPanel.jsx # Left sidebar for stats
│   ├── hooks/
│   │   ├── useSession.js  # Core state management (entries, tasks)
│   │   ├── useCloudSync.js # Cloudflare sync logic
│   │   ├── useCategories.js # Category management
│   │   ├── useTheme.jsx   # Theme/dark mode
│   │   └── useAI.js       # AI auto-categorization
│   ├── styles/
│   │   ├── base.css       # CSS variables, fonts
│   │   ├── components.css # Component styles
│   │   └── responsive.css # Mobile breakpoints
│   └── utils/
│       ├── constants.js   # ENTRY_TYPES, ACTIONS, STORAGE_KEYS
│       └── formatters.js  # Date/time formatting
├── functions/             # Cloudflare Pages Functions
│   ├── api/
│   │   ├── data.js        # GET/PUT /api/data (KV storage)
│   │   ├── upload.js      # POST /api/upload (R2 image upload)
│   │   ├── cleanup.js     # POST /api/cleanup (delete unused images)
│   │   └── auth.js        # POST /api/auth (password auth)
│   ├── api/image/
│   │   └── [id].js        # GET /api/image/:id (serve images from R2)
│   └── _middleware.js     # Auth middleware
└── public/                # Static assets, manifest.json
```

## Key Concepts

### Entry Types (constants.js)
- `SESSION_START` - User logs in/starts tracking
- `SESSION_END` - User logs off (has duration)
- `NOTE` - Quick note (can be TODO)
- `TASK_DONE` - Completed task marker

### Session Status
- `IDLE` - Not tracking
- `STREAMING` - Actively tracking (green breathing indicator)

### State Management (useSession.js)
- State stored in localStorage + synced to Cloudflare KV
- Reducer-based with actions: `LOG_IN`, `NOTE`, `LOG_OFF`, `SWITCH`, etc.
- `IMPORT_DATA` detects active sessions from entry history

### Cloud Sync (useCloudSync.js)
- Auth via password → JWT token stored in memory
- `GET /api/data` is public (no auth needed)
- `PUT /api/data`, `POST /api/upload`, `POST /api/cleanup` require auth
- Images stored in R2 with format: `🖼️ /api/image/{filename}`

### AI Auto-Categorization (useAI.js)
- OpenAI-compatible API (configurable base URL + model)
- Suggests category when new entry is added
- Only applies if confidence > 0.5

## Common Tasks

### Run Development
```bash
npm run dev
```

### Deploy to Cloudflare
```bash
npm run build && npx wrangler pages deploy dist --project-name chronolog
```

### Add New Category
Categories are managed in `useCategories.js`, stored in localStorage.
Default categories: Work, Craft, Maintenance, Explore, Learning

### Add New Entry Type
1. Add to `ENTRY_TYPES` in `constants.js`
2. Handle in `sessionReducer` in `useSession.js`
3. Update `Timeline.jsx` rendering

### Modify API Endpoints
Edit files in `functions/api/`. Cloudflare auto-deploys.

## Environment Variables (Cloudflare Dashboard)
- `AUTH_PASSWORD` - Password for cloud sync auth
- `CHRONOLOG_KV` - KV namespace binding
- `CHRONOLOG_R2` - R2 bucket binding

## Styling Conventions
- Use CSS variables from `base.css` (e.g., `var(--accent)`, `var(--bg-primary)`)
- Component classes in `components.css`
- Mobile styles in `responsive.css`
- Avoid inline styles, prefer CSS classes

## Important Notes
- PWA with offline support via manifest.json
- Multiple theme styles (Default, Operation/spy theme)
- Image paste upload supported in InputPanel
- Public read, authenticated write pattern
