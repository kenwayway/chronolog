import { useRef, useMemo } from "react";
import { Routes, Route } from "react-router-dom";
import { useSession } from "./hooks/useSession";
import { useCategories } from "./hooks/useCategories";
import { useTheme } from "./hooks/useTheme";
import { useCloudSync } from "./hooks/useCloudSync";
import { useAICategories } from "./hooks/useAICategories";
import { useGoogleTasks } from "./hooks/useGoogleTasks";
import { useEntryHandlers } from "./hooks/useEntryHandlers";
import { useAutoCategorize } from "./hooks/useAutoCategorize";
import { useUIState } from "./hooks/useUIState";
import { useFollowUpLink } from "./hooks/useFollowUpLink";
import { SessionContext } from "./contexts/SessionContext";
import { CloudSyncContext } from "./contexts/CloudSyncContext";

import {
    Header,
    LandingPage,
    Timeline,
    InputPanel,
    TasksPanel,
    ContextMenu,
    SettingsModal,
    EditModal,
    ActivityPanel,
} from "./components";
import type { CategoryId } from "./types";
import type { InputPanelRef } from "./components/input/InputPanel";
import { LibraryPage } from "./pages/LibraryPage";

function App() {
    const { state, isStreaming, actions } = useSession();
    const { categories } = useCategories();
    const { isDark, toggleTheme } = useTheme();
    const googleTasks = useGoogleTasks();
    const { categorize } = useAICategories();

    // Cloud sync
    const cloudSync = useCloudSync({
        entries: state.entries,
        contentTypes: state.contentTypes,
        mediaItems: state.mediaItems,
        onImportData: actions.importData,
    });

    // Auto-categorize new entries via AI
    useAutoCategorize({
        entries: state.entries,
        contentTypes: state.contentTypes,
        isLoggedIn: cloudSync.isLoggedIn,
        categorize,
        updateEntry: actions.updateEntry,
    });

    // Entry handlers (extracted to reduce App.tsx complexity)
    const handlers = useEntryHandlers({
        actions,
        isLoggedIn: cloudSync.isLoggedIn,
        googleTasks,
    });

    // UI State (sidebars, modals, context menu, navigation)
    const ui = useUIState();

    // Follow-up linking
    const inputPanelRef = useRef<InputPanelRef>(null);
    const followUp = useFollowUpLink({
        entries: state.entries,
        updateEntry: actions.updateEntry,
        inputPanelRef,
    });

    // Filtered entries for timeline
    const filteredEntries = useMemo(() => {
        if (ui.categoryFilter.length > 0) {
            return state.entries
                .filter(entry => ui.categoryFilter.includes(entry.category as CategoryId))
                .sort((a, b) => b.timestamp - a.timestamp);
        }
        if (ui.tagFilter.length > 0) {
            return state.entries
                .filter(entry =>
                    entry.tags && ui.tagFilter.every(t => entry.tags!.includes(t))
                )
                .sort((a, b) => b.timestamp - a.timestamp);
        }
        const target = ui.selectedDate || new Date();
        const dayStart = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
        const dayEnd = dayStart + 86_400_000;
        return state.entries.filter(entry =>
            entry.timestamp >= dayStart && entry.timestamp < dayEnd
        );
    }, [state.entries, ui.categoryFilter, ui.tagFilter, ui.selectedDate]);

    // Context values (memoized to avoid unnecessary re-renders)
    const sessionContextValue = useMemo(() => ({
        state,
        actions,
        categories,
        isStreaming,
    }), [state, actions, categories, isStreaming]);

    const cloudSyncContextValue = useMemo(() => cloudSync, [cloudSync]);

    return (
        <SessionContext.Provider value={sessionContextValue}>
            <CloudSyncContext.Provider value={cloudSyncContextValue}>
                <Routes>
                    <Route path="/library" element={<LibraryPage />} />
                    <Route path="/" element={
                        <div className="min-h-screen flex flex-col font-mono" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                            <Header
                                isStreaming={isStreaming}
                                pendingTaskCount={0}
                                selectedDate={ui.selectedDate}
                                onDateChange={ui.setSelectedDate}
                                isDark={isDark}
                                onToggleTheme={toggleTheme}
                                onOpenSidebar={() => ui.setSidebarOpen(true)}
                                onOpenLeftSidebar={() => ui.setLeftSidebarOpen(true)}
                                onOpenSettings={() => ui.setSettingsOpen(true)}
                            />

                            <main className="flex-1 flex flex-col max-w-4xl w-full mx-auto relative">
                                {ui.showLanding ? (
                                    <LandingPage onDismiss={() => ui.setShowLanding(false)} />
                                ) : (
                                    <Timeline
                                        entries={filteredEntries}
                                        status={state.status}
                                        onContextMenu={ui.handleContextMenu}
                                        onEdit={ui.openEditModal}
                                        onDeleteAIComment={(entry) => actions.updateEntry(entry.id, { aiComment: undefined })}
                                        categoryFilter={ui.categoryFilter}
                                        onNavigateToEntry={ui.navigateToEntry}
                                    />
                                )}
                            </main>

                            <InputPanel
                                ref={inputPanelRef}
                                status={state.status}
                                onLogIn={handlers.handleLogIn}
                                onSwitch={handlers.handleSwitch}
                                onNote={handlers.handleNote}
                                onLogOff={handlers.handleLogOff}
                                followUpEntry={followUp.followUpEntry}
                                onClearFollowUp={followUp.clearFollowUp}
                            />

                            <TasksPanel
                                isOpen={ui.sidebarOpen}
                                onClose={() => ui.setSidebarOpen(false)}
                                onCompleteTask={handlers.handleCompleteTask}
                                googleTasks={googleTasks}
                            />

                            <ActivityPanel
                                isOpen={ui.leftSidebarOpen}
                                onClose={() => ui.setLeftSidebarOpen(false)}
                                selectedDate={ui.selectedDate}
                                onDateChange={ui.setSelectedDate}
                                categoryFilter={ui.categoryFilter}
                                onCategoryFilterChange={ui.setCategoryFilter}
                                tagFilter={ui.tagFilter}
                                onTagFilterChange={ui.setTagFilter}
                            />

                            <ContextMenu
                                isOpen={ui.contextMenu.isOpen}
                                position={ui.contextMenu.position}
                                entry={ui.contextMenu.entry}
                                onClose={ui.closeContextMenu}
                                onEdit={(entry) => handlers.handleEditEntry(entry, ui.openEditModal)}
                                onDelete={handlers.handleDeleteEntry}
                                onCopy={handlers.handleCopyEntry}
                                onMarkAsTask={handlers.handleMarkAsTask}
                                onLink={followUp.handleFollowUp}
                                onDeleteAIComment={(entry) => actions.updateEntry(entry.id, { aiComment: undefined })}
                                googleTasksEnabled={googleTasks.isLoggedIn}
                            />

                            <EditModal
                                isOpen={ui.editModal.isOpen}
                                entry={ui.editModal.entry}
                                onSave={handlers.handleSaveEdit}
                                onClose={ui.closeEditModal}
                            />

                            <SettingsModal
                                isOpen={ui.settingsOpen}
                                onClose={() => ui.setSettingsOpen(false)}
                                googleTasks={googleTasks}
                            />
                        </div>
                    } />
                </Routes>
            </CloudSyncContext.Provider>
        </SessionContext.Provider>
    );
}

export default App;
