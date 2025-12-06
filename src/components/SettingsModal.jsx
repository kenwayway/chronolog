import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'
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
        setTimeout(() => { setSaved(false); onClose() }, 1000)
    }

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) onClose()
    }

    const handleAddCategory = () => {
        if (newCatLabel.trim()) {
            onAddCategory(newCatLabel.trim(), newCatColor)
            setNewCatLabel('')
            setNewCatColor('#7aa2f7')
        }
    }

    const inputStyle = {
        height: 32,
        padding: '0 12px',
        fontSize: 12,
        backgroundColor: 'var(--bg-tertiary)',
        color: 'var(--text-primary)',
        border: 'none',
        borderRadius: 6,
        outline: 'none',
        width: '100%'
    }

    const SectionHeader = ({ icon, title, action }) => (
        <div className="flex-between mb-2">
            <div className="flex items-center gap-2" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                <span style={{ color: 'var(--accent)' }}>{icon}</span>
                <span className="uppercase tracking-widest font-medium">{title}</span>
            </div>
            {action}
        </div>
    )

    return (
        <div
            className="fixed inset-0 flex-center font-mono"
            style={{ padding: 16, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 400 }}
            onClick={handleBackdropClick}
        >
            <div style={{
                width: '100%',
                maxWidth: 380,
                maxHeight: '85vh',
                overflowY: 'auto',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-light)',
                borderRadius: 12,
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
            }}>
                {/* Header */}
                <div className="flex-between" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CONFIG</span>
                    <button
                        onClick={onClose}
                        style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', backgroundColor: 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 18 }}
                    >×</button>
                </div>

                <div style={{ padding: 16 }} className="space-y-5">
                    {/* Theme Mode */}
                    <div>
                        <SectionHeader icon="◐" title="MODE" />
                        <div className="flex-between" style={{ padding: 8, backgroundColor: 'var(--bg-primary)', borderRadius: 8 }}>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{theme.mode === 'dark' ? 'Dark' : 'Light'}</span>
                            <button
                                onClick={() => setMode(theme.mode === 'dark' ? 'light' : 'dark')}
                                style={{
                                    position: 'relative', width: 48, height: 24, borderRadius: 9999, cursor: 'pointer', border: 'none',
                                    backgroundColor: theme.mode === 'dark' ? 'var(--accent)' : 'var(--border-light)', transition: 'all 300ms ease'
                                }}
                            >
                                <span style={{
                                    position: 'absolute', top: 2, width: 20, height: 20, borderRadius: 9999, backgroundColor: 'white',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    left: theme.mode === 'dark' ? 26 : 2, transition: 'all 300ms ease'
                                }}>
                                    {theme.mode === 'dark' ? (
                                        <Moon size={10} stroke="var(--accent)" strokeWidth={2.5} />
                                    ) : (
                                        <Sun size={10} stroke="var(--text-muted)" strokeWidth={2.5} />
                                    )}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Accent Color */}
                    <div>
                        <SectionHeader icon="●" title="ACCENT" />
                        <div className="flex flex-wrap gap-1-5">
                            {Object.entries(ACCENT_COLORS).map(([colorKey, color]) => (
                                <button
                                    key={colorKey}
                                    onClick={() => setAccent(colorKey)}
                                    title={color.name}
                                    style={{
                                        width: 24, height: 24, borderRadius: 6, cursor: 'pointer', backgroundColor: color.value, border: 'none',
                                        boxShadow: theme.accent === colorKey ? '0 0 0 2px rgba(255,255,255,0.5)' : 'none',
                                        transition: 'all 150ms ease'
                                    }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Categories */}
                    <div>
                        <SectionHeader
                            icon="◇"
                            title="CATEGORIES"
                            action={<button onClick={onResetCategories} style={{ fontSize: 10, color: 'var(--text-dim)', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }}>reset</button>}
                        />
                        <div className="space-y-1 mb-2">
                            {categories?.map(cat => (
                                <div key={cat.id} className="flex items-center gap-2 group" style={{ padding: '6px 8px', backgroundColor: 'var(--bg-primary)', borderRadius: 6 }}>
                                    <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: cat.color, flexShrink: 0 }} />
                                    <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)' }}>{cat.label}</span>
                                    <button onClick={() => onDeleteCategory(cat.id)} style={{ opacity: 0.3, color: 'var(--text-dim)', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14 }}>×</button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input type="color" value={newCatColor} onChange={(e) => setNewCatColor(e.target.value)} style={{ width: 32, height: 32, padding: 0, border: 'none', borderRadius: 6, cursor: 'pointer' }} />
                            <input type="text" value={newCatLabel} onChange={(e) => setNewCatLabel(e.target.value)} placeholder="New category..." style={{ ...inputStyle, flex: 1 }} onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()} />
                            <button onClick={handleAddCategory} style={{ height: 32, padding: '0 12px', fontSize: 12, fontWeight: 500, color: 'white', backgroundColor: 'var(--accent)', border: 'none', borderRadius: 6, cursor: 'pointer' }}>+</button>
                        </div>
                    </div>

                    {/* API Key */}
                    <div>
                        <SectionHeader icon="⚿" title="API KEY" />
                        <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Gemini API key..." style={inputStyle} />
                        <p style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 6 }}>
                            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>Get from Google AI Studio →</a>
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2" style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)' }}>
                    <button onClick={onClose} style={{ height: 32, padding: '0 16px', fontSize: 12, color: 'var(--text-muted)', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }}>Cancel</button>
                    <button onClick={handleSave} style={{ height: 32, padding: '0 16px', fontSize: 12, fontWeight: 500, color: 'white', backgroundColor: saved ? '#22c55e' : 'var(--accent)', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                        {saved ? 'Saved ✓' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    )
}
