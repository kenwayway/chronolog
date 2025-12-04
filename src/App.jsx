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
    const { categories, addCategory, updateCategory, deleteCategory, resetToDefaults } = useCategories()

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
            {/* Header - Minimal CLI style */}
            <header className="sticky top-0 flex-between px-4 py-2 bg-[var(--bg-primary)] border-b border-[var(--border-subtle)] z-200">
                <div className="flex items-center gap-3">
                    <span className="text-[var(--accent)] font-bold">~/chronolog</span>
                    <span className="text-[var(--text-muted)] text-xs">v1.0.0</span>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer bg-transparent border-none flex items-center gap-1 transition-colors"
                        onClick={() => setSidebarOpen(true)}
                        title="Task Matrix"
                    >
                        <span>[tasks]</span>
                        {state.tasks.filter(t => !t.done).length > 0 && (
                            <span className="text-[var(--accent)] font-bold">
                                {state.tasks.filter(t => !t.done).length}
                            </span>
                        )}
                    </button>

                    <button
                        className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer bg-transparent border-none transition-colors"
                        onClick={() => setSettingsOpen(true)}
                        title="Settings"
                    >
                        [config]
                    </button>
                </div>
            </header>

            {/* Main content */}
            <main className="flex-1 flex flex-col max-w-4xl w-full mx-auto relative">
                {/* Vertical line decoration */}
                <div className="absolute left-6 top-0 bottom-0 w-px bg-[var(--border-subtle)] z-0 hidden md:block"></div>

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
                onUpdateCategory={updateCategory}
                onDeleteCategory={deleteCategory}
                onResetCategories={resetToDefaults}
            />
        </div>
    )
}

export default App
