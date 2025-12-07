import { useState, useCallback } from "react";
import { useSession } from "./hooks/useSession";
import { useCategories } from "./hooks/useCategories";
import { useTheme } from "./hooks/useTheme";
import { Header } from "./components/Header";
import { Timeline } from "./components/Timeline";
import { InputPanel } from "./components/InputPanel";
import { TasksPanel } from "./components/TasksPanel";
import { ContextMenu } from "./components/ContextMenu";
import { SettingsModal } from "./components/SettingsModal";
import { EditModal } from "./components/EditModal";
import { ActivityPanel } from "./components/ActivityPanel";

function App() {
    const { state, isStreaming, actions } = useSession();
    const { categories, addCategory, deleteCategory, resetToDefaults } =
        useCategories();
    const { isDark, toggleTheme } = useTheme();

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState(null); // null = today
    const [editModal, setEditModal] = useState({ isOpen: false, entry: null });
    const [categoryFilter, setCategoryFilter] = useState([]); // empty = show all
    const [contextMenu, setContextMenu] = useState({
        isOpen: false,
        position: { x: 0, y: 0 },
        entry: null,
    });

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
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                isDark={isDark}
                onToggleTheme={toggleTheme}
                onOpenSidebar={() => setSidebarOpen(true)}
                onOpenLeftSidebar={() => setLeftSidebarOpen(true)}
                onOpenSettings={() => setSettingsOpen(true)}
            />

            {/* Main content */}
            <main className="flex-1 flex flex-col max-w-4xl w-full mx-auto relative">
                <Timeline
                    entries={(() => {
                        // When category filter is active, show ALL matching entries (ignore date)
                        if (categoryFilter.length > 0) {
                            return state.entries
                                .filter(entry => categoryFilter.includes(entry.category))
                                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                        }
                        // Otherwise, filter by date
                        const today = new Date()
                        today.setHours(0, 0, 0, 0)
                        const targetDate = selectedDate || today
                        return state.entries.filter(entry => {
                            const entryDate = new Date(entry.timestamp)
                            return entryDate.toDateString() === targetDate.toDateString()
                        })
                    })()}
                    status={state.status}
                    categories={categories}
                    onContextMenu={handleContextMenu}
                    categoryFilter={categoryFilter}
                />
            </main>

            <InputPanel
                status={state.status}
                onLogIn={handleLogIn}
                onSwitch={handleSwitch}
                onNote={handleNote}
                onLogOff={handleLogOff}
            />

            <TasksPanel
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                tasks={state.tasks}
                onCompleteTask={handleCompleteTask}
            />

            <ActivityPanel
                isOpen={leftSidebarOpen}
                onClose={() => setLeftSidebarOpen(false)}
                entries={state.entries}
                categories={categories}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                categoryFilter={categoryFilter}
                onCategoryFilterChange={setCategoryFilter}
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
                entries={state.entries}
                tasks={state.tasks}
                onImportData={actions.importData}
            />
        </div >
    )
}

export default App
