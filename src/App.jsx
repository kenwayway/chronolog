import { useState, useCallback } from 'react'
import { useSession } from './hooks/useSession'
import { useAI } from './hooks/useAI'
import { useCategories } from './hooks/useCategories'
import { Timeline } from './components/Timeline'
import { InputPanel } from './components/InputPanel'
import { Sidebar } from './components/Sidebar'
import { ContextMenu } from './components/ContextMenu'
import { SettingsModal } from './components/SettingsModal'
import { EditModal } from './components/EditModal'

function App() {
    const { state, isStreaming, actions } = useSession()
    const { detectIntent, loading: aiLoading } = useAI(state.apiKey)
    const { categories, addCategory, deleteCategory, resetToDefaults } = useCategories()

    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [editModal, setEditModal] = useState({ isOpen: false, entry: null })
    const [contextMenu, setContextMenu] = useState({
        isOpen: false,
        position: { x: 0, y: 0 },
        entry: null
    })

    const handleLogIn = useCallback(async (content) => {
        actions.logIn(content)

        if (state.apiKey) {
            const result = await detectIntent(content)
            if (result.isTodo && result.confidence > 0.6) {
                actions.addTask(content, result.taskDescription)
            }
        }
    }, [actions, state.apiKey, detectIntent])

    const handleSwitch = useCallback(async (content) => {
        actions.switchSession(content)

        if (state.apiKey) {
            const result = await detectIntent(content)
            if (result.isTodo && result.confidence > 0.6) {
                actions.addTask(content, result.taskDescription)
            }
        }
    }, [actions, state.apiKey, detectIntent])

    const handleNote = useCallback(async (content) => {
        let todoData = null

        if (state.apiKey) {
            const result = await detectIntent(content)
            if (result.isTodo && result.confidence > 0.6) {
                todoData = {
                    isTodo: true,
                    taskDescription: result.taskDescription
                }
            }
        }

        actions.addNote(content, todoData)
    }, [actions, state.apiKey, detectIntent])

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

    const handleSaveEdit = useCallback((entryId, content) => {
        actions.editEntry(entryId, content)
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

    const handleSetCategory = useCallback((entryId, category) => {
        actions.setEntryCategory(entryId, category)
    }, [actions])

    const handleCompleteTask = useCallback((taskId) => {
        actions.completeTask(taskId)
    }, [actions])

    return (
        <div className="min-h-screen flex flex-col bg-[var(--bg-primary)] font-mono selection:bg-[var(--accent-subtle)] selection:text-[var(--accent)]">
            {/* Header - Timeline Style */}
            <header className="sticky top-0 flex-between px-4 bg-[var(--bg-primary)]/80 backdrop-blur-md border-b border-[var(--border-subtle)] z-200 h-12">
                {/* Left: Status + Title */}
                <div className="flex items-center gap-4">
                    {/* Breathing Light Status */}
                    <div className="relative flex items-center justify-center w-3 h-3">
                        <div className={`absolute w-full h-full rounded-full opacity-75 ${isStreaming ? 'bg-[var(--streaming)] animate-ping' : 'bg-[var(--text-dim)] scale-50'}`}></div>
                        <div className={`relative w-2 h-2 rounded-full ${isStreaming ? 'bg-[var(--streaming)]' : 'bg-[var(--text-dim)]'}`}></div>
                    </div>

                    <div className="flex items-center gap-3 text-sm text-[var(--text-muted)] font-mono">
                        <span className="text-[var(--text-dim)] opacity-50">::</span>
                        <span className="text-[var(--text-primary)] font-bold tracking-wide">chronolog</span>
                    </div>
                </div>

                {/* Right: Controls */}
                <div className="flex items-center gap-4">
                    {/* API Status */}
                    {aiLoading && (
                        <div className="flex items-center gap-1.5 text-[var(--accent)] text-[10px] font-mono animate-pulse">
                            <span className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full"></span>
                            <span>AI</span>
                        </div>
                    )}
                    {!state.apiKey && (
                        <span className="text-[10px] text-[var(--text-dim)] font-mono opacity-70">NO_API</span>
                    )}

                    <button
                        className="btn btn-ghost w-8 h-8 p-0 flex-center rounded-[4px] relative group"
                        onClick={() => setSidebarOpen(true)}
                        title="Tasks"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="8" y1="6" x2="21" y2="6"></line>
                            <line x1="8" y1="12" x2="21" y2="12"></line>
                            <line x1="8" y1="18" x2="21" y2="18"></line>
                            <line x1="3" y1="6" x2="3.01" y2="6"></line>
                            <line x1="3" y1="12" x2="3.01" y2="12"></line>
                            <line x1="3" y1="18" x2="3.01" y2="18"></line>
                        </svg>
                        {state.tasks.filter(t => !t.done).length > 0 && (
                            <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-[var(--accent)] rounded-full"></span>
                        )}
                    </button>

                    <button
                        className="btn btn-ghost w-8 h-8 p-0 flex-center rounded-[4px]"
                        onClick={() => setSettingsOpen(true)}
                        title="Config"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
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
                aiLoading={aiLoading}
                hasApiKey={!!state.apiKey}
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
                categories={categories}
                onClose={closeContextMenu}
                onEdit={handleEditEntry}
                onDelete={handleDeleteEntry}
                onCopy={handleCopyEntry}
                onSetCategory={handleSetCategory}
            />

            <EditModal
                isOpen={editModal.isOpen}
                entry={editModal.entry}
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
