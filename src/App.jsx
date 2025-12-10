import { useState, useCallback, useEffect, useRef } from "react";
import { useSession } from "./hooks/useSession";
import { useCategories } from "./hooks/useCategories";
import { useTheme } from "./hooks/useTheme";
import { useCloudSync } from "./hooks/useCloudSync";
import { useAICategories } from "./hooks/useAICategories";
import { useGoogleTasks } from "./hooks/useGoogleTasks";
import {
    Header,
    Timeline,
    InputPanel,
    TasksPanel,
    ContextMenu,
    SettingsModal,
    EditModal,
    ActivityPanel,
} from "./components";

function App() {
    const { state, isStreaming, actions } = useSession();
    const { categories } = useCategories();
    const { isDark, toggleTheme } = useTheme();
    const googleTasks = useGoogleTasks();

    // AI categorization via backend API
    const { categorize } = useAICategories();
    const lastEntryCountRef = useRef(state.entries.length);

    // Cloud sync
    const cloudSync = useCloudSync({
        entries: state.entries,
        onImportData: actions.importData,
    });

    // Auto-suggest category for new entries (via backend API)
    useEffect(() => {
        const currentCount = state.entries.length;
        if (currentCount > lastEntryCountRef.current && cloudSync.isLoggedIn) {
            const newEntry = state.entries[state.entries.length - 1];
            // Only suggest for notes and session starts with content, and without existing category
            if (newEntry && newEntry.content && !newEntry.category) {
                // Get token from cloudSync
                const token = localStorage.getItem('chronolog_cloud_token');
                if (token) {
                    categorize(newEntry.content, token).then(categoryId => {
                        if (categoryId) {
                            actions.updateEntry(newEntry.id, { category: categoryId });
                        }
                    });
                }
            }
        }
        lastEntryCountRef.current = currentCount;
    }, [state.entries.length, cloudSync.isLoggedIn, categorize, actions]);

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

    // Check if user is logged in, show alert if not
    const requireLogin = useCallback(() => {
        if (!cloudSync.isLoggedIn) {
            alert('Please connect to cloud sync to edit. Go to Settings > Cloud Sync to login.');
            return false;
        }
        return true;
    }, [cloudSync.isLoggedIn]);

    const handleLogIn = useCallback((content) => {
        if (!requireLogin()) return;
        actions.logIn(content)
    }, [actions, requireLogin])

    const handleSwitch = useCallback((content) => {
        if (!requireLogin()) return;
        actions.switchSession(content)
    }, [actions, requireLogin])

    const handleNote = useCallback((content) => {
        if (!requireLogin()) return;
        actions.addNote(content)
    }, [actions, requireLogin])

    const handleLogOff = useCallback((content) => {
        if (!requireLogin()) return;
        actions.logOff(content)
    }, [actions, requireLogin])

    const handleContextMenu = useCallback((entry, position) => {
        setContextMenu({ isOpen: true, position, entry })
    }, [])

    const closeContextMenu = useCallback(() => {
        setContextMenu(prev => ({ ...prev, isOpen: false }))
    }, [])

    const handleEditEntry = useCallback((entry) => {
        if (!requireLogin()) return;
        setEditModal({ isOpen: true, entry })
    }, [requireLogin])

    const handleSaveEdit = useCallback((entryId, updates) => {
        if (!requireLogin()) return;
        const cleanUpdates = Object.fromEntries(
            Object.entries(updates).filter(([, v]) => v !== undefined)
        )
        if (Object.keys(cleanUpdates).length > 0) {
            actions.updateEntry(entryId, cleanUpdates)
        }
    }, [actions, requireLogin])

    const closeEditModal = useCallback(() => {
        setEditModal({ isOpen: false, entry: null })
    }, [])

    const handleDeleteEntry = useCallback((entry) => {
        if (!requireLogin()) return;
        if (confirm('Delete this entry?')) {
            actions.deleteEntry(entry.id)
        }
    }, [actions, requireLogin])

    const handleCopyEntry = useCallback((entry) => {
        navigator.clipboard.writeText(entry.content || '')
    }, [])

    const handleMarkAsTask = useCallback(async (entry) => {
        if (!requireLogin()) return;

        // Mark entry as TASK locally
        actions.markAsTask(entry.id);

        // Create Google Task if logged in
        if (googleTasks.isLoggedIn) {
            try {
                await googleTasks.createTask(entry.content, entry.id);
            } catch (err) {
                console.error('Failed to create Google Task:', err);
            }
        }
    }, [actions, requireLogin, googleTasks]);

    const handleCompleteTask = useCallback((entryId, content) => {
        actions.completeTask(entryId, content)
    }, [actions])

    return (
        <div className="min-h-screen flex flex-col font-mono" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
            <Header
                isStreaming={isStreaming}
                pendingTaskCount={0}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                isDark={isDark}
                onToggleTheme={toggleTheme}
                onOpenSidebar={() => setSidebarOpen(true)}
                onOpenLeftSidebar={() => setLeftSidebarOpen(true)}
                onOpenSettings={() => setSettingsOpen(true)}
                cloudSync={cloudSync}
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
                cloudSync={cloudSync}
            />

            <TasksPanel
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                onCompleteTask={handleCompleteTask}
                googleTasks={googleTasks}
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
                onMarkAsTask={handleMarkAsTask}
                googleTasksEnabled={googleTasks.isLoggedIn}
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
                aiBaseUrl={state.aiBaseUrl}
                aiModel={state.aiModel}
                onSaveAIConfig={actions.setAIConfig}
                categories={categories}
                entries={state.entries}
                onImportData={actions.importData}
                cloudSync={cloudSync}
                googleTasks={googleTasks}
            />
        </div >
    )
}

export default App
