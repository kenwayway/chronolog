import { useState } from 'react'
import { useTheme, ACCENT_COLORS } from '../hooks/useTheme.jsx'

export function SettingsModal({ isOpen, onClose, apiKey, onSaveApiKey }) {
    const [key, setKey] = useState(apiKey || '')
    const [saved, setSaved] = useState(false)
    const { theme, setMode, setAccent } = useTheme()

    if (!isOpen) return null

    const handleSave = () => {
        onSaveApiKey(key)
        setSaved(true)
        setTimeout(() => {
            setSaved(false)
            onClose()
        }, 1000)
    }

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose()
        }
    }

    return (
        <div
            className="fixed inset-0 flex-center p-6 bg-black/60 backdrop-blur-4 z-400 animate-fade-in"
            onClick={handleBackdropClick}
        >
            <div className="w-full max-w-120 max-h-90vh overflow-y-auto bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-xl shadow-lg animate-slide-in">
                <div className="flex-between px-6 py-6 border-b border-[var(--border-subtle)]">
                    <h2 className="text-lg font-600 text-[var(--text-primary)]">Settings</h2>
                    <button
                        className="flex-center w-8 h-8 text-xl text-[var(--text-muted)] bg-transparent border-none rounded-lg cursor-pointer transition-all duration-150 hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                        onClick={onClose}
                    >
                        ×
                    </button>
                </div>

                <div className="p-6">
                    {/* Theme Mode */}
                    <div className="mb-8">
                        <label className="block text-sm font-600 text-[var(--text-primary)] mb-2">Theme</label>
                        <div className="flex gap-2">
                            <button
                                className={`flex-1 flex-center gap-2 p-4 font-sans text-sm font-500 border-2 rounded-lg cursor-pointer transition-all duration-150 ${theme.mode === 'light' ? 'text-[var(--accent)] bg-[var(--accent-subtle)] border-[var(--accent)]' : 'text-[var(--text-secondary)] bg-[var(--bg-tertiary)] border-[var(--border-light)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)]'}`}
                                onClick={() => setMode('light')}
                            >
                                <span className="text-lg">☀</span>
                                Light
                            </button>
                            <button
                                className={`flex-1 flex-center gap-2 p-4 font-sans text-sm font-500 border-2 rounded-lg cursor-pointer transition-all duration-150 ${theme.mode === 'dark' ? 'text-[var(--accent)] bg-[var(--accent-subtle)] border-[var(--accent)]' : 'text-[var(--text-secondary)] bg-[var(--bg-tertiary)] border-[var(--border-light)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)]'}`}
                                onClick={() => setMode('dark')}
                            >
                                <span className="text-lg">☾</span>
                                Dark
                            </button>
                        </div>
                    </div>

                    {/* Accent Color */}
                    <div className="mb-8">
                        <label className="block text-sm font-600 text-[var(--text-primary)] mb-2">Accent Color</label>
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(ACCENT_COLORS).map(([colorKey, color]) => (
                                <button
                                    key={colorKey}
                                    className={`w-10 h-10 rounded-lg border-2 cursor-pointer transition-all duration-150 flex-center hover:scale-110 ${theme.accent === colorKey ? 'border-[var(--text-primary)] shadow-[0_0_0_2px_var(--bg-secondary),0_0_0_4px_currentColor]' : 'border-transparent'}`}
                                    style={{ backgroundColor: color.value, color: color.value }}
                                    onClick={() => setAccent(colorKey)}
                                    title={color.name}
                                >
                                    {theme.accent === colorKey && <span className="text-white text-sm font-bold drop-shadow-sm">✓</span>}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* API Key */}
                    <div className="mb-8">
                        <label className="block text-sm font-600 text-[var(--text-primary)] mb-1">Gemini API Key</label>
                        <p className="text-sm text-[var(--text-muted)] mb-4 leading-relaxed">
                            Required for AI-powered TODO detection. Get your key from{' '}
                            <a
                                href="https://aistudio.google.com/apikey"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[var(--accent)] no-underline hover:underline"
                            >
                                Google AI Studio
                            </a>
                        </p>
                        <input
                            type="password"
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            placeholder="Enter your API key..."
                            className="input-field font-mono"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-2 px-6 py-6 border-t border-[var(--border-subtle)]">
                    <button
                        className="px-6 py-2 font-sans text-sm font-600 text-[var(--text-secondary)] bg-[var(--bg-tertiary)] border-none rounded-lg cursor-pointer transition-all duration-150 hover:bg-[var(--bg-glass-light)]"
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button
                        className={`px-6 py-2 font-sans text-sm font-600 text-white border-none rounded-lg cursor-pointer transition-all duration-150 ${saved ? 'bg-[var(--streaming)]' : 'bg-[var(--accent)] hover:bg-[var(--accent-light)]'}`}
                        onClick={handleSave}
                    >
                        {saved ? '✓ Saved' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    )
}
