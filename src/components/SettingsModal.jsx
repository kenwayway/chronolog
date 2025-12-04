import { useState } from 'react'
import { useTheme, ACCENT_COLORS } from '../hooks/useTheme.jsx'

export function SettingsModal({
    isOpen,
    onClose,
    apiKey,
    onSaveApiKey,
    categories,
    onAddCategory,
    onUpdateCategory,
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
            className="fixed inset-0 flex-center p-6 bg-black/70 backdrop-blur-sm z-400 animate-fade-in font-mono"
            onClick={handleBackdropClick}
        >
            <div className="w-full max-w-[520px] max-h-[90vh] overflow-y-auto bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-[4px] shadow-2xl animate-slide-in">
                <div className="flex-between px-6 py-4 border-b border-[var(--border-light)] bg-[var(--bg-secondary)]">
                    <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">[SYSTEM_CONFIG]</h2>
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
                        <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                            INTERFACE_MODE
                        </label>
                        <div className="flex gap-3">
                            <button
                                className={`flex-1 flex-center gap-2 p-3 text-xs font-bold border rounded-[2px] cursor-pointer transition-all duration-150 ${theme.mode === 'light' ? 'text-[var(--bg-primary)] bg-[var(--text-primary)] border-[var(--text-primary)]' : 'text-[var(--text-secondary)] bg-transparent border-[var(--border-light)] hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                                onClick={() => setMode('light')}
                            >
                                <span>LIGHT_MODE</span>
                            </button>
                            <button
                                className={`flex-1 flex-center gap-2 p-3 text-xs font-bold border rounded-[2px] cursor-pointer transition-all duration-150 ${theme.mode === 'dark' ? 'text-[var(--bg-primary)] bg-[var(--text-primary)] border-[var(--text-primary)]' : 'text-[var(--text-secondary)] bg-transparent border-[var(--border-light)] hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                                onClick={() => setMode('dark')}
                            >
                                <span>DARK_MODE</span>
                            </button>
                        </div>
                    </div>

                    {/* Accent Color */}
                    <div>
                        <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                            ACCENT_COLOR
                        </label>
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
                            <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                                CATEGORIES
                            </label>
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
                                className="px-3 py-2 text-xs font-bold text-[var(--accent)] bg-transparent border border-[var(--accent)] rounded-[2px] cursor-pointer hover:bg-[var(--accent-subtle)] uppercase"
                                onClick={handleAddCategory}
                            >
                                ADD
                            </button>
                        </div>
                    </div>

                    {/* API Key */}
                    <div>
                        <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                            GEMINI_API_KEY
                        </label>
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
                        className="px-4 py-2 text-xs font-bold text-[var(--text-secondary)] bg-transparent border border-transparent rounded-[2px] cursor-pointer hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] uppercase tracking-wide"
                        onClick={onClose}
                    >
                        CANCEL
                    </button>
                    <button
                        className={`px-4 py-2 text-xs font-bold text-[var(--bg-primary)] border border-transparent rounded-[2px] cursor-pointer uppercase tracking-wide transition-all ${saved ? 'bg-[var(--streaming)]' : 'bg-[var(--accent)] hover:bg-[var(--accent-light)]'}`}
                        onClick={handleSave}
                    >
                        {saved ? 'SAVED' : 'SAVE_CONFIG'}
                    </button>
                </div>
            </div>
        </div>
    )
}
