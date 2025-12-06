import { useState, useCallback } from 'react'
import { useSession } from './hooks/useSession'
import { useCategories } from './hooks/useCategories'
import { Timeline } from './components/Timeline'
import { InputPanel } from './components/InputPanel'
import { Sidebar } from './components/Sidebar'
import { ContextMenu } from './components/ContextMenu'
import { SettingsModal } from './components/SettingsModal'
import { EditModal } from './components/EditModal'

function App() {
    const { state, isStreaming, actions } = useSession()
    const { categories, addCategory, deleteCategory, resetToDefaults } = useCategories()

    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [editModal, setEditModal] = useState({ isOpen: false, entry: null })
    const [contextMenu, setContextMenu] = useState({
        isOpen: false,
        position: { x: 0, y: 0 },
        entry: null
    })

    const handleLogIn = useCallback((content) => {
        actions.logIn(content)
    }, [actions])

    const handleSwitch = useCallback((content) => {
        actions.switchSession(content)
    }, [actions])

    const handleNote = useCallback((content) => {
        actions.addNote(content)
    }, [actions])

    const handleLogOff = useCallback((content) => {
        actions.logOff(content)
    }, [actions])

    const handleContextMenu = useCallback((entry, position) => {
        setContextMenu({ isOpen: true, position, entry })
    }, [])

    const closeContextMenu = useCallback(() => {
        setContextMenu(prev => ({ ...prev, isOpen: false }))
    }, [])

    const handleEditEntry = useCallback((entry) => {
        setEditModal({ isOpen: true, entry })
    }, [])

    const handleSaveEdit = useCallback((entryId, updates) => {
        const cleanUpdates = Object.fromEntries(
            Object.entries(updates).filter(([, v]) => v !== undefined)
        )
        if (Object.keys(cleanUpdates).length > 0) {
            actions.updateEntry(entryId, cleanUpdates)
        }
    }, [actions])

    const closeEditModal = useCallback(() => {
        setEditModal({ isOpen: false, entry: null })
    }, [])

    const handleDeleteEntry = useCallback((entry) => {
        if (confirm('Delete this entry?')) {
            actions.deleteEntry(entry.id)
        }
    }, [actions])

    const handleCopyEntry = useCallback((entry) => {
        navigator.clipboard.writeText(entry.content || '')
    }, [])

    const handleToggleTodo = useCallback((entryId) => {
        actions.toggleTodo(entryId)
    }, [actions])

    const handleCompleteTask = useCallback((taskId) => {
        actions.completeTask(taskId)
    }, [actions])

    return (
        <div className="min-h-screen flex flex-col font-mono" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
            {/* Header */}
            <header className="sticky top-0 flex-between px-4 h-12 z-200 border-b" style={{ backgroundColor: 'rgba(15,15,20,0.8)', backdropFilter: 'blur(12px)', borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center gap-4">
                    {/* Status indicator */}
                    <div className="relative flex-center" style={{ width: 12, height: 12 }}>
                        <div
                            className={`absolute w-full h-full rounded-full opacity-75 ${isStreaming ? 'animate-ping' : ''}`}
                            style={{ backgroundColor: isStreaming ? 'var(--streaming)' : 'var(--text-dim)', transform: isStreaming ? 'none' : 'scale(0.5)' }}
                        />
                        <div
                            className="relative rounded-full"
                            style={{ width: 8, height: 8, backgroundColor: isStreaming ? 'var(--streaming)' : 'var(--text-dim)' }}
                        />
                    </div>

                    <div className="flex items-center gap-3 text-sm text-muted">
                        <span className="text-dim opacity-50">::</span>
                        <span className="text-primary font-bold tracking-wide">chronolog</span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        className="btn btn-ghost relative rounded"
                        style={{ width: 32, height: 32, padding: 0 }}
                        onClick={() => setSidebarOpen(true)}
                        title="Tasks"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="8" y1="6" x2="21" y2="6" />
                            <line x1="8" y1="12" x2="21" y2="12" />
                            <line x1="8" y1="18" x2="21" y2="18" />
                            <line x1="3" y1="6" x2="3.01" y2="6" />
                            <line x1="3" y1="12" x2="3.01" y2="12" />
                            <line x1="3" y1="18" x2="3.01" y2="18" />
                        </svg>
                        {state.tasks.filter(t => !t.done).length > 0 && (
                            <span className="absolute rounded-full" style={{ top: 2, right: 2, width: 8, height: 8, backgroundColor: 'var(--accent)' }} />
                        )}
                    </button>

                    <button
                        className="btn btn-ghost rounded"
                        style={{ width: 32, height: 32, padding: 0 }}
                        onClick={() => setSettingsOpen(true)}
                        title="Config"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                            <circle cx="12" cy="12" r="3" />
                        </svg>
                    </button>
                </div>
            </header>

            {/* Main content */}
            <main className="flex-1 flex flex-col max-w-4xl w-full mx-auto relative">
                <Timeline
                    entries={state.entries}
                    status={state.status}
                    categories={categories}
                    onContextMenu={handleContextMenu}
                />
            </main>

            <InputPanel
                status={state.status}
                onLogIn={handleLogIn}
                onSwitch={handleSwitch}
                onNote={handleNote}
                onLogOff={handleLogOff}
            />

            <Sidebar
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                tasks={state.tasks}
                onCompleteTask={handleCompleteTask}
            />

            <ContextMenu
                isOpen={contextMenu.isOpen}
                position={contextMenu.position}
                entry={contextMenu.entry}
                onClose={closeContextMenu}
                onEdit={handleEditEntry}
                onDelete={handleDeleteEntry}
                onCopy={handleCopyEntry}
                onToggleTodo={handleToggleTodo}
            />

            <EditModal
                isOpen={editModal.isOpen}
                entry={editModal.entry}
                categories={categories}
                onSave={handleSaveEdit}
                onClose={closeEditModal}
            />

            <SettingsModal
                isOpen={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                apiKey={state.apiKey}
                onSaveApiKey={actions.setApiKey}
                categories={categories}
                onAddCategory={addCategory}
                onDeleteCategory={deleteCategory}
                onResetCategories={resetToDefaults}
            />
        </div>
    )
}

export default App
