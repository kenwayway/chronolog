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

    // Shared input style
    const inputStyle = "h-8 text-xs px-3 rounded-md border-none bg-[var(--bg-tertiary)] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 transition-all"

    // Section header
    const SectionHeader = ({ icon, title, action }) => (
        <div className="flex-between mb-2">
            <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                <span className="text-[var(--accent)]">{icon}</span>
                <span className="uppercase tracking-widest font-medium">{title}</span>
            </div>
            {action}
        </div>
    )

    return (
        <div
            className="fixed inset-0 flex-center p-4 bg-black/60 backdrop-blur-sm z-400 font-mono"
            onClick={handleBackdropClick}
        >
            <div className="w-full max-w-sm max-h-[85vh] overflow-y-auto bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-xl shadow-2xl">
                {/* Header */}
                <div className="flex-between px-4 py-3 border-b border-[var(--border-subtle)]">
                    <span className="text-xs uppercase tracking-wider font-bold text-[var(--text-secondary)]">CONFIG</span>
                    <button
                        className="w-6 h-6 rounded-md flex-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] cursor-pointer bg-transparent border-none transition-colors"
                        onClick={onClose}
                    >×</button>
                </div>

                <div className="p-4 space-y-5">
                    {/* Theme Mode */}
                    <div>
                        <SectionHeader icon="◐" title="MODE" />
                        <div className="flex items-center justify-between p-2 bg-[var(--bg-primary)] rounded-lg">
                            <span className="text-xs text-[var(--text-secondary)]">
                                {theme.mode === 'dark' ? 'Dark' : 'Light'}
                            </span>
                            <button
                                onClick={() => setMode(theme.mode === 'dark' ? 'light' : 'dark')}
                                className={`relative w-12 h-6 rounded-full cursor-pointer border-none transition-colors duration-300 ${theme.mode === 'dark' ? 'bg-[var(--accent)]' : 'bg-[var(--border-light)]'}`}
                            >
                                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow flex-center transition-all duration-300 ${theme.mode === 'dark' ? 'left-6' : 'left-0.5'}`}>
                                    {theme.mode === 'dark' ? (
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
                                    ) : (
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5"><circle cx="12" cy="12" r="4" /></svg>
                                    )}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Accent Color */}
                    <div>
                        <SectionHeader icon="●" title="ACCENT" />
                        <div className="flex flex-wrap gap-1.5">
                            {Object.entries(ACCENT_COLORS).map(([colorKey, color]) => (
                                <button
                                    key={colorKey}
                                    className={`w-6 h-6 rounded-md cursor-pointer transition-all duration-150 hover:scale-110 ${theme.accent === colorKey ? 'ring-2 ring-white/50 ring-offset-1 ring-offset-[var(--bg-secondary)]' : ''}`}
                                    style={{ backgroundColor: color.value, border: 'none' }}
                                    onClick={() => setAccent(colorKey)}
                                    title={color.name}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Categories */}
                    <div>
                        <SectionHeader
                            icon="◇"
                            title="CATEGORIES"
                            action={
                                <button className="text-[10px] text-[var(--text-dim)] hover:text-[var(--accent)] cursor-pointer bg-transparent border-none transition-colors" onClick={onResetCategories}>
                                    reset
                                </button>
                            }
                        />
                        <div className="space-y-1 mb-2">
                            {categories?.map(cat => (
                                <div key={cat.id} className="flex items-center gap-2 py-1.5 px-2 bg-[var(--bg-primary)] rounded-md group">
                                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: cat.color }} />
                                    <span className="flex-1 text-xs text-[var(--text-primary)]">{cat.label}</span>
                                    <button className="opacity-0 group-hover:opacity-100 text-[var(--text-dim)] hover:text-[var(--error)] cursor-pointer bg-transparent border-none text-sm transition-opacity" onClick={() => onDeleteCategory(cat.id)}>×</button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="color"
                                value={newCatColor}
                                onChange={(e) => setNewCatColor(e.target.value)}
                                className="w-8 h-8 p-0 rounded-md cursor-pointer bg-transparent border-none"
                            />
                            <input
                                type="text"
                                value={newCatLabel}
                                onChange={(e) => setNewCatLabel(e.target.value)}
                                placeholder="New category..."
                                className={`${inputStyle} flex-1`}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                            />
                            <button
                                className="h-8 px-3 rounded-md cursor-pointer border-none bg-[var(--accent)] text-white text-xs font-medium hover:opacity-90 transition-opacity"
                                onClick={handleAddCategory}
                            >+</button>
                        </div>
                    </div>

                    {/* API Key */}
                    <div>
                        <SectionHeader icon="⚿" title="API KEY" />
                        <input
                            type="password"
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            placeholder="Gemini API key..."
                            className={`${inputStyle} w-full`}
                        />
                        <p className="text-[10px] text-[var(--text-dim)] mt-1.5">
                            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">Get from Google AI Studio →</a>
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-4 py-3 border-t border-[var(--border-subtle)]">
                    <button
                        className="h-8 px-4 rounded-md text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] cursor-pointer bg-transparent border-none transition-colors"
                        onClick={onClose}
                    >Cancel</button>
                    <button
                        className={`h-8 px-4 rounded-md text-xs font-medium cursor-pointer border-none transition-all ${saved ? 'bg-green-500 text-white' : 'bg-[var(--accent)] text-white hover:opacity-90'}`}
                        onClick={handleSave}
                    >
                        {saved ? 'Saved ✓' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    )
}
