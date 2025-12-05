import { useState } from 'react'
import { useTheme, ACCENT_COLORS } from '../hooks/useTheme.jsx'

export function SettingsModal({
    isOpen,
    onClose,
    apiKey,
    onSaveApiKey,
    categories,
    onAddCategory,
    onDeleteCategory,
    onResetCategories
}) {
    const [key, setKey] = useState(apiKey || '')
    const [saved, setSaved] = useState(false)
    const [newCatLabel, setNewCatLabel] = useState('')
    const [newCatColor, setNewCatColor] = useState('#7aa2f7')
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

    const handleAddCategory = () => {
        if (newCatLabel.trim()) {
            onAddCategory(newCatLabel.trim(), newCatColor)
            setNewCatLabel('')
            setNewCatColor('#7aa2f7')
        }
    }

    return (
        <div
            className="fixed inset-0 flex-center p-6 bg-black/70 backdrop-blur-sm z-400 font-mono"
            onClick={handleBackdropClick}
        >
            <div className="w-full max-w-[520px] max-h-[90vh] overflow-y-auto bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-[4px] shadow-2xl">
                <div className="flex-between px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
                    <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] font-mono">
                        <span className="text-[var(--text-dim)] opacity-50">::</span>
                        <span className="uppercase tracking-wider font-bold">CONFIG</span>
                    </div>
                    <button
                        className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer bg-transparent border-none text-lg"
                        onClick={onClose}
                    >
                        ×
                    </button>
                </div>

                <div className="p-6 space-y-8">
                    {/* Theme Mode */}
                    <div>
                        <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)] mb-3 font-mono">
                            <span className="text-[var(--text-dim)] opacity-50">»</span>
                            <span className="uppercase tracking-widest font-bold">MODE</span>
                            <div className="flex-1 h-px bg-[var(--border-subtle)] opacity-50"></div>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-[4px]">
                            <div className="flex items-center gap-2">
                                {theme.mode === 'dark' ? (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-secondary)]">
                                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                                    </svg>
                                ) : (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-secondary)]">
                                        <circle cx="12" cy="12" r="5"></circle>
                                        <line x1="12" y1="1" x2="12" y2="3"></line>
                                        <line x1="12" y1="21" x2="12" y2="23"></line>
                                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                                        <line x1="1" y1="12" x2="3" y2="12"></line>
                                        <line x1="21" y1="12" x2="23" y2="12"></line>
                                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                                    </svg>
                                )}
                                <span className="text-xs text-[var(--text-secondary)]">
                                    {theme.mode === 'dark' ? 'DARK_MODE' : 'LIGHT_MODE'}
                                </span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={theme.mode === 'dark'}
                                    onChange={() => setMode(theme.mode === 'dark' ? 'light' : 'dark')}
                                    className="sr-only peer"
                                />
                                <div className="
                                    peer w-14 h-7 rounded-full 
                                    bg-[var(--border-light)] 
                                    peer-checked:bg-[var(--accent)]
                                    ring-0 outline-none
                                    duration-300
                                    after:duration-300
                                    after:content-['☀']
                                    after:absolute after:top-1 after:left-1
                                    after:w-5 after:h-5
                                    after:bg-white after:rounded-full
                                    after:flex after:justify-center after:items-center
                                    after:text-[10px]
                                    after:shadow-md
                                    peer-checked:after:translate-x-7
                                    peer-checked:after:content-['☾']
                                    peer-hover:after:scale-95
                                "></div>
                            </label>
                        </div>
                    </div>

                    {/* Accent Color */}
                    <div>
                        <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)] mb-3 font-mono">
                            <span className="text-[var(--text-dim)] opacity-50">·</span>
                            <span className="uppercase tracking-widest font-bold">ACCENT</span>
                            <div className="flex-1 h-px bg-[var(--border-subtle)] opacity-50"></div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(ACCENT_COLORS).map(([colorKey, color]) => (
                                <button
                                    key={colorKey}
                                    className={`w-8 h-8 rounded-[2px] border cursor-pointer transition-all duration-150 flex-center hover:scale-110 ${theme.accent === colorKey ? 'border-[var(--text-primary)] shadow-[0_0_0_2px_var(--bg-secondary),0_0_0_3px_var(--text-primary)]' : 'border-transparent'}`}
                                    style={{ backgroundColor: color.value }}
                                    onClick={() => setAccent(colorKey)}
                                    title={color.name}
                                >
                                    {theme.accent === colorKey && <span className="text-[var(--bg-primary)] text-xs font-bold">✓</span>}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Categories */}
                    <div>
                        <div className="flex-between mb-3">
                            <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)] font-mono">
                                <span className="text-[var(--text-dim)] opacity-50">·</span>
                                <span className="uppercase tracking-widest font-bold">CATEGORIES</span>
                                <div className="flex-1 h-px bg-[var(--border-subtle)] opacity-50"></div>
                            </div>
                            <button
                                className="text-[10px] text-[var(--text-dim)] hover:text-[var(--text-secondary)] cursor-pointer bg-transparent border-none uppercase"
                                onClick={onResetCategories}
                            >
                                [RESET]
                            </button>
                        </div>

                        {/* Existing categories */}
                        <div className="space-y-2 mb-4">
                            {categories?.map(cat => (
                                <div
                                    key={cat.id}
                                    className="flex items-center gap-3 p-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-[2px]"
                                >
                                    <span
                                        className="w-4 h-4 rounded-[2px] flex-shrink-0"
                                        style={{ backgroundColor: cat.color }}
                                    ></span>
                                    <span className="flex-1 text-xs text-[var(--text-primary)]">{cat.label}</span>
                                    <button
                                        className="text-xs text-[var(--text-dim)] hover:text-[var(--error)] cursor-pointer bg-transparent border-none"
                                        onClick={() => onDeleteCategory(cat.id)}
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Add new category */}
                        <div className="flex gap-2">
                            <input
                                type="color"
                                value={newCatColor}
                                onChange={(e) => setNewCatColor(e.target.value)}
                                className="w-10 h-8 p-0 border border-[var(--border-light)] rounded-[2px] cursor-pointer bg-transparent"
                            />
                            <input
                                type="text"
                                value={newCatLabel}
                                onChange={(e) => setNewCatLabel(e.target.value)}
                                placeholder="New category..."
                                className="flex-1 bg-[var(--bg-primary)] text-[var(--text-primary)] font-mono text-xs px-3 py-2 border border-[var(--border-light)] rounded-[2px] focus:outline-none focus:border-[var(--accent)] placeholder:text-[var(--text-dim)]"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                            />
                            <button
                                className="btn btn-secondary text-[var(--accent)] border-[var(--accent)] hover:bg-[var(--accent-subtle)]"
                                onClick={handleAddCategory}
                            >
                                ADD
                            </button>
                        </div>
                    </div>

                    {/* API Key */}
                    <div>
                        <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)] mb-3 font-mono">
                            <span className="text-[var(--text-dim)] opacity-50">·</span>
                            <span className="uppercase tracking-widest font-bold">API_KEY</span>
                            <div className="flex-1 h-px bg-[var(--border-subtle)] opacity-50"></div>
                        </div>
                        <p className="text-[10px] text-[var(--text-dim)] mb-3 leading-relaxed">
                            REQUIRED FOR AI INTENT DETECTION. OBTAIN KEY FROM{' '}
                            <a
                                href="https://aistudio.google.com/apikey"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[var(--accent)] hover:underline"
                            >
                                GOOGLE AI STUDIO
                            </a>
                        </p>
                        <input
                            type="password"
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            placeholder="ENTER_API_KEY..."
                            className="w-full bg-[var(--bg-primary)] text-[var(--text-primary)] font-mono text-xs p-3 border border-[var(--border-light)] rounded-[2px] focus:outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--text-dim)]"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 px-6 py-4 border-t border-[var(--border-light)] bg-[var(--bg-secondary)]">
                    <button
                        className="btn btn-ghost uppercase tracking-wide"
                        onClick={onClose}
                    >
                        CANCEL
                    </button>
                    <button
                        className={`btn uppercase tracking-wide ${saved ? 'btn-primary bg-[var(--streaming)] hover:bg-[var(--streaming)]' : 'btn-primary'}`}
                        onClick={handleSave}
                    >
                        {saved ? 'SAVED' : 'SAVE_CONFIG'}
                    </button>
                </div>
            </div>
        </div>
    )
}
