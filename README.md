# Chronolog

A minimalist personal timeline and activity tracker with cloud sync support.

**Live Demo:** [chronolog.pages.dev](https://chronolog.pages.dev)

## ✨ Features (功能介绍)

### Core Features
- **Timeline View** - Track daily activities with timestamps
- **Session Tracking** - Log in/out to track work sessions with duration
- **Notes** - Add quick notes throughout the day
- **Task Management** - Mark notes as todos and track completion
- **Categories** - Organize entries with custom color-coded categories
- **Calendar Navigation** - Browse entries by date

### Cloud Sync
- **Public Reading** - Anyone can view the timeline
- **Authenticated Writing** - Only logged-in users can edit
- **Image Upload** - Upload images directly or paste from clipboard (Ctrl+V)
- **Auto Sync** - Changes automatically sync to cloud

### User Experience
- **Dark/Light Mode** - System preference detection + manual toggle
- **PWA Support** - Install as an app on mobile devices
- **Responsive Design** - Optimized for desktop and mobile
- **Multiple Themes** - Including a WW2 spy "Operation" theme
- **Context Menu** - Right-click (or long-press on mobile) for quick actions
- **Focus Mode** - Distraction-free writing experience

## 🛠 Tech Stack

### Frontend
| Technology | Usage |
|------------|-------|
| **React 19** | UI framework |
| **Vite** | Build tool & dev server |
| **Vanilla CSS** | Styling with CSS variables for theming |
| **Lucide React** | Icon library |
| **Vite PWA** | Progressive Web App support |

### Architecture
```
┌─────────────────┐     ┌──────────────────┐
│   React App     │────▶│ Cloudflare Pages │
│   (Frontend)    │     │    (Hosting)     │
└─────────────────┘     └──────────────────┘
                               │
                               ▼
                    ┌──────────────────┐
                    │ Pages Functions  │
                    │   (Serverless)   │
                    └──────────────────┘
                         │         │
              ┌──────────┘         └──────────┐
              ▼                               ▼
    ┌──────────────────┐           ┌──────────────────┐
    │  Cloudflare KV   │           │  Cloudflare R2   │
    │  (Data Storage)  │           │ (Image Storage)  │
    └──────────────────┘           └──────────────────┘
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

# Build for production
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
├── components/     # React components
│   ├── Header.jsx
│   ├── Timeline.jsx
│   ├── InputPanel.jsx
│   ├── Calendar.jsx
│   ├── Dropdown.jsx
│   └── ...
├── hooks/          # Custom React hooks
│   ├── useSession.js
│   ├── useCloudSync.js
│   └── ...
├── styles/         # CSS styles
│   ├── base.css
│   ├── components.css
│   ├── responsive.css
│   └── themes/
└── utils/          # Utility functions

functions/          # Cloudflare Pages Functions
├── api/
│   ├── auth.js     # Authentication
│   ├── data.js     # Data CRUD
│   ├── upload.js   # Image upload
│   └── image/[id].js
└── _middleware.js  # Auth & CORS
```

## 📝 License

MIT
