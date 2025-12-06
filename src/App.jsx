import { useState, useCallback } from 'react'
import { useSession } from './hooks/useSession'
import { useCategories } from './hooks/useCategories'
import { Header } from './components/Header'
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
            <Header
                isStreaming={isStreaming}
                pendingTaskCount={state.tasks.filter(t => !t.done).length}
                onOpenSidebar={() => setSidebarOpen(true)}
                onOpenSettings={() => setSettingsOpen(true)}
            />

            {/* Main content */}
            < main className="flex-1 flex flex-col max-w-4xl w-full mx-auto relative" >
                <Timeline
                    entries={state.entries}
                    status={state.status}
                    categories={categories}
                    onContextMenu={handleContextMenu}
                />
            </main >

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
        </div >
    )
}

export default App
