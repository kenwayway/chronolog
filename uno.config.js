import { defineConfig, presetUno, presetAttributify, presetIcons } from 'unocss'

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons({
      scale: 1.2,
      cdn: 'https://esm.sh/'
    }),
  ],

  theme: {
    colors: {
      // Will be overridden by CSS variables for theme switching
      accent: 'var(--accent)',
      'accent-light': 'var(--accent-light)',
      streaming: 'var(--streaming)',
      todo: 'var(--todo)',
      done: 'var(--done)',
      error: 'var(--error)',
    },
    fontFamily: {
      sans: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace", // Force monospace everywhere
      mono: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
    }
  },

  shortcuts: {
    // Layout
    'flex-center': 'flex items-center justify-center',
    'flex-between': 'flex items-center justify-between',

    // Container
    'panel': 'bg-[var(--bg-secondary)] border border-[var(--border-light)]',

    // Buttons (Flat, sharp, CLI-style)
    'btn': 'inline-flex items-center justify-center gap-2 px-3 py-1.5 font-mono text-xs font-600 border border-transparent rounded-[4px] cursor-pointer transition-all duration-150 active:translate-y-px select-none',
    'btn-primary': 'btn text-[var(--bg-primary)] bg-[var(--accent)] hover:bg-[var(--accent-light)]',
    'btn-secondary': 'btn text-[var(--text-primary)] bg-[var(--bg-tertiary)] border-[var(--border-light)] hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]',
    'btn-ghost': 'btn bg-transparent hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
    'btn-danger': 'btn text-white bg-[var(--error)] hover:opacity-90',
    'btn-icon': 'w-8 h-8 p-0 text-lg',

    // Inputs
    'input-base': 'w-full bg-[var(--bg-primary)] text-[var(--text-primary)] font-mono text-sm border border-[var(--border-light)] rounded-[4px] focus:outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--text-dim)]',

    // Text
    'text-primary': 'text-[var(--text-primary)]',
    'text-secondary': 'text-[var(--text-secondary)]',
    'text-muted': 'text-[var(--text-muted)]',
    'text-dim': 'text-[var(--text-dim)]',

    // Badges
    'badge': 'inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-[2px]',
    'badge-accent': 'badge text-[var(--accent)] bg-[var(--accent-subtle)] border border-[var(--accent)]',
    'badge-todo': 'badge text-[var(--todo)] bg-[var(--todo-glow)] border border-[var(--todo)]',
    'badge-done': 'badge text-[var(--done)] bg-[var(--accent-subtle)] border border-[var(--done)]',
  },

  preflights: [
    {
      getCSS: () => `
        /* Theme Variables - Dark (Default) */
        :root,
        [data-theme="dark"] {
          --bg-primary: #0f0f14; /* Slightly lighter than #0d0d12 for less harsh contrast */
          --bg-secondary: #1a1a24;
          --bg-tertiary: #242432;
          --bg-glass: rgba(15, 15, 20, 0.95);
          
          --accent: #7aa2f7;
          --accent-light: #89ddff;
          --accent-glow: rgba(122, 162, 247, 0.15);
          --accent-subtle: rgba(122, 162, 247, 0.1);
          
          --text-primary: #c0caf5;
          --text-secondary: #a9b1d6; /* Brightened from #9aa5ce */
          --text-muted: #787c99; /* Brightened from #565f89 */
          --text-dim: #565f89; /* Brightened from #414868 */
          
          --streaming: #9ece6a;
          --streaming-glow: rgba(158, 206, 106, 0.2);
          --todo: #e0af68;
          --todo-glow: rgba(224, 175, 104, 0.15);
          --done: #bb9af7;
          --error: #f7768e;
          
          --border-subtle: #1f2335;
          --border-light: #292e42;
          
          --icon-bg: var(--bg-secondary);
        }
        
        /* Theme Variables - Light (High Contrast Code) */
        [data-theme="light"] {
          --bg-primary: #ffffff;
          --bg-secondary: #f4f5f9;
          --bg-tertiary: #e9ebf2;
          --bg-glass: rgba(255, 255, 255, 0.95);
          
          --accent: #2e5cba;
          --accent-light: #4b7be5;
          --accent-glow: rgba(46, 92, 186, 0.1);
          --accent-subtle: rgba(46, 92, 186, 0.05);
          
          --text-primary: #2c3e50;
          --text-secondary: #475569;
          --text-muted: #64748b;
          --text-dim: #94a3b8;
          
          --streaming: #10b981;
          --streaming-glow: rgba(16, 185, 129, 0.15);
          --todo: #d97706;
          --todo-glow: rgba(217, 119, 6, 0.1);
          --error: #ef4444;
          
          --border-subtle: #e2e8f0;
          --border-light: #cbd5e1;
          
          --icon-bg: var(--bg-secondary);
        }
        
        /* Base styles */
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        html {
          font-size: 15px; /* Increased from 14px for better readability */
          -webkit-font-smoothing: antialiased;
        }
        
        body {
          font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
          background-color: var(--bg-primary);
          color: var(--text-primary);
          line-height: 1.6; /* Increased from 1.5 */
          min-height: 100vh;
          overflow-x: hidden;
        }
        
        /* Custom Scrollbar */
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        
        ::-webkit-scrollbar-thumb {
          background: var(--border-light);
          border-radius: 3px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: var(--text-muted);
        }
        
        ::selection {
          background: var(--accent-subtle);
          color: var(--accent);
        }
        
        :focus-visible {
          outline: 1px solid var(--accent);
          outline-offset: -1px;
        }
      `
    }
  ]
})
