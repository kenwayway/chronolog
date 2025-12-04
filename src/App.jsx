import { useState, useCallback } from 'react'
import { useSession } from './hooks/useSession'
import { useAI } from './hooks/useAI'
import { Timeline } from './components/Timeline'
import { InputPanel } from './components/InputPanel'
import { Sidebar } from './components/Sidebar'
import { ContextMenu } from './components/ContextMenu'
import { SettingsModal } from './components/SettingsModal'

function App() {
    const { state, isStreaming, actions } = useSession()
    const { detectIntent, loading: aiLoading } = useAI(state.apiKey)

    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [settingsOpen, setSettingsOpen] = useState(false)
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
        const newContent = prompt('Edit entry:', entry.content)
        if (newContent !== null && newContent !== entry.content) {
            actions.editEntry(entry.id, newContent)
        }
    }, [actions])

    const handleDeleteEntry = useCallback((entry) => {
        if (confirm('Delete this entry?')) {
            actions.deleteEntry(entry.id)
        }
    }, [actions])

    const handleCopyEntry = useCallback((entry) => {
        navigator.clipboard.writeText(entry.content || '')
    }, [])

    const handleCompleteTask = useCallback((taskId) => {
        actions.completeTask(taskId)
    }, [actions])

    return (
        <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
            {/* Header */}
            <header className="sticky top-0 flex-between px-6 py-4 glass backdrop-blur-20 border-b border-[var(--border-subtle)] z-200">
                <div className="flex items-baseline gap-4">
                    <h1 className="flex items-center gap-2 text-xl font-700 text-[var(--text-primary)] tracking-tight">
                        <span className="text-lg text-[var(--accent)]">◇</span>
                        Chronolog
                    </h1>
                    <span className="text-sm text-[var(--text-muted)] font-400">低熵容器</span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        className="relative flex-center w-10 h-10 text-lg text-[var(--text-secondary)] bg-transparent border border-[var(--border-subtle)] rounded-lg cursor-pointer transition-all duration-150 hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--border-light)]"
                        onClick={() => setSidebarOpen(true)}
                        title="Task Matrix"
                    >
                        <span>☰</span>
                        {state.tasks.filter(t => !t.done).length > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-4.5 h-4.5 px-1 text-2.5 font-700 text-white bg-[var(--accent)] rounded-full flex-center">
                                {state.tasks.filter(t => !t.done).length}
                            </span>
                        )}
                    </button>

                    <button
                        className="flex-center w-10 h-10 text-lg text-[var(--text-secondary)] bg-transparent border border-[var(--border-subtle)] rounded-lg cursor-pointer transition-all duration-150 hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--border-light)]"
                        onClick={() => setSettingsOpen(true)}
                        title="Settings"
                    >
                        <span>⚙</span>
                    </button>
                </div>
            </header>

            {/* Main content */}
            <main className="flex-1 flex flex-col max-w-800px w-full mx-auto">
                <Timeline
                    entries={state.entries}
                    status={state.status}
                    onContextMenu={handleContextMenu}
                />
            </main>

            <InputPanel
                status={state.status}
                onLogIn={handleLogIn}
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
                onClose={closeContextMenu}
                onEdit={handleEditEntry}
                onDelete={handleDeleteEntry}
                onCopy={handleCopyEntry}
            />

            <SettingsModal
                isOpen={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                apiKey={state.apiKey}
                onSaveApiKey={actions.setApiKey}
            />
        </div>
    )
}

export default App
