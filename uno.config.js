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
    },

    shortcuts: {
        // Layout
        'flex-center': 'flex items-center justify-center',
        'flex-between': 'flex items-center justify-between',

        // Glass effect
        'glass': 'bg-[var(--bg-glass)] backdrop-blur-12 border border-[var(--border-subtle)]',
        'glass-light': 'bg-[var(--bg-glass-light)] backdrop-blur-8',

        // Buttons
        'btn': 'inline-flex items-center gap-1 px-4 py-2 font-sans text-sm font-600 border-none rounded-lg cursor-pointer transition-all duration-150',
        'btn-primary': 'btn text-white bg-[var(--accent)] shadow-[0_2px_8px_var(--accent-glow)] hover:bg-[var(--accent-light)] hover:shadow-[0_4px_12px_var(--accent-glow)] hover:-translate-y-0.5',
        'btn-secondary': 'btn text-[var(--text-primary)] bg-[var(--bg-tertiary)] border border-[var(--border-light)] hover:bg-[var(--bg-secondary)] hover:border-[var(--accent)]',
        'btn-danger': 'btn text-white bg-[var(--error)] hover:bg-red-600 hover:-translate-y-0.5',

        // Inputs
        'input-field': 'w-full px-4 py-3 font-sans text-base text-[var(--text-primary)] bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-lg transition-all duration-150 focus:outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-glow)]',

        // Text
        'text-primary': 'text-[var(--text-primary)]',
        'text-secondary': 'text-[var(--text-secondary)]',
        'text-muted': 'text-[var(--text-muted)]',
        'text-dim': 'text-[var(--text-dim)]',

        // Backgrounds
        'bg-primary': 'bg-[var(--bg-primary)]',
        'bg-secondary': 'bg-[var(--bg-secondary)]',
        'bg-tertiary': 'bg-[var(--bg-tertiary)]',

        // Badges
        'badge': 'inline-flex items-center px-2 py-0.5 text-xs font-600 rounded',
        'badge-accent': 'badge text-[var(--accent)] bg-[var(--accent-subtle)] border border-[var(--accent)]',
        'badge-todo': 'badge text-[var(--todo)] bg-[var(--todo-glow)]',
        'badge-done': 'badge text-[var(--done)] bg-[var(--accent-subtle)]',

        // Animations
        'animate-pulse': 'animate-[pulse_2s_ease-in-out_infinite]',
        'animate-slide-in': 'animate-[slideIn_200ms_ease-out]',
        'animate-fade-in': 'animate-[fadeIn_200ms_ease-out]',
        'animate-glow': 'animate-[glow_2s_ease-in-out_infinite]',
    },

    rules: [
        // Custom backdrop blur values
        ['backdrop-blur-12', { 'backdrop-filter': 'blur(12px)', '-webkit-backdrop-filter': 'blur(12px)' }],
        ['backdrop-blur-8', { 'backdrop-filter': 'blur(8px)', '-webkit-backdrop-filter': 'blur(8px)' }],
        ['backdrop-blur-20', { 'backdrop-filter': 'blur(20px)', '-webkit-backdrop-filter': 'blur(20px)' }],

        // Font families
        ['font-sans', { 'font-family': "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }],
        ['font-mono', { 'font-family': "'JetBrains Mono', 'Fira Code', 'Consolas', monospace" }],
    ],

    preflights: [
        {
            getCSS: () => `
        /* Theme Variables - Dark (Default) */
        :root,
        [data-theme="dark"] {
          --bg-primary: #0a0a0f;
          --bg-secondary: #12121a;
          --bg-tertiary: #1a1a24;
          --bg-glass: rgba(18, 18, 26, 0.8);
          --bg-glass-light: rgba(26, 26, 36, 0.6);
          
          --accent: #6366f1;
          --accent-light: #818cf8;
          --accent-glow: rgba(99, 102, 241, 0.3);
          --accent-subtle: rgba(99, 102, 241, 0.1);
          
          --text-primary: #e4e4e7;
          --text-secondary: #a1a1aa;
          --text-muted: #52525b;
          --text-dim: #3f3f46;
          
          --streaming: #22c55e;
          --streaming-glow: rgba(34, 197, 94, 0.3);
          --todo: #f59e0b;
          --todo-glow: rgba(245, 158, 11, 0.2);
          --done: var(--accent);
          --error: #ef4444;
          
          --border-subtle: rgba(255, 255, 255, 0.06);
          --border-light: rgba(255, 255, 255, 0.1);
          
          --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
          --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
          --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5);
          
          --icon-bg: var(--bg-primary);
        }
        
        /* Theme Variables - Light */
        [data-theme="light"] {
          --bg-primary: #fafafa;
          --bg-secondary: #ffffff;
          --bg-tertiary: #f4f4f5;
          --bg-glass: rgba(255, 255, 255, 0.8);
          --bg-glass-light: rgba(250, 250, 250, 0.6);
          
          --text-primary: #18181b;
          --text-secondary: #52525b;
          --text-muted: #a1a1aa;
          --text-dim: #d4d4d8;
          
          --streaming: #16a34a;
          --streaming-glow: rgba(22, 163, 74, 0.2);
          --todo: #d97706;
          --todo-glow: rgba(217, 119, 6, 0.15);
          --error: #dc2626;
          
          --border-subtle: rgba(0, 0, 0, 0.06);
          --border-light: rgba(0, 0, 0, 0.1);
          
          --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
          --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.08);
          --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
          
          --icon-bg: var(--bg-primary);
        }
        
        /* Animations */
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 5px var(--streaming-glow); }
          50% { box-shadow: 0 0 20px var(--streaming-glow), 0 0 30px var(--streaming-glow); }
        }
        
        /* Base styles */
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        html {
          font-size: 16px;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background-color: var(--bg-primary);
          color: var(--text-primary);
          line-height: 1.6;
          min-height: 100vh;
          overflow-x: hidden;
          transition: background-color 200ms ease, color 200ms ease;
        }
        
        #root {
          min-height: 100vh;
        }
        
        /* Scrollbar */
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        
        ::-webkit-scrollbar-thumb {
          background: var(--text-dim);
          border-radius: 9999px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: var(--text-muted);
        }
        
        ::selection {
          background: var(--accent);
          color: white;
        }
        
        :focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
      `
        }
    ]
})
