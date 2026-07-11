import { useRef, useMemo } from "react";
import { Routes, Route } from "react-router-dom";
import { useSession } from "./hooks/useSession";
import { useCategories } from "./hooks/useCategories";
import { useCloudSync } from "./hooks/useCloudSync";
import { useAICategories } from "./hooks/useAICategories";
import { useEntryHandlers } from "./hooks/useEntryHandlers";
import { useAutoCategorize } from "./hooks/useAutoCategorize";
import { useFollowUpLink } from "./hooks/useFollowUpLink";
import { SessionContext, useSessionContext } from "./contexts/SessionContext";
import { CloudSyncContext } from "./contexts/CloudSyncContext";
import { UIStateProvider } from "./components/providers/UIStateProvider";
import { useUIStateContext } from "./hooks/useUIStateContext";

import {
    Header,
    LandingPage,
    Timeline,
    InputPanel,
    ContextMenu,
    SettingsModal,
    EditModal,
    ActivityPanel,
} from "./components";
import type { CategoryId, Entry } from "./types";
import type { InputPanelRef } from "./components/input/InputPanel";
import { LibraryPage } from "./pages/LibraryPage";
import { GalleryPage } from "./pages/GalleryPage";

function App() {
    const { state, isStreaming, actions } = useSession();
    const { categories } = useCategories();
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
    });

    // Context values — memoized with stable deps to prevent unnecessary re-renders
    const sessionContextValue = useMemo(() => ({
        state,
        actions,
        categories,
        isStreaming,
    }), [state, actions, categories, isStreaming]);

    // Fix: field-by-field deps instead of the spread object (which is always a new ref)
    const cloudSyncContextValue = useMemo(() => ({
        isLoggedIn: cloudSync.isLoggedIn,
        isSyncing: cloudSync.isSyncing,
        lastSynced: cloudSync.lastSynced,
        error: cloudSync.error,
        login: cloudSync.login,
        logout: cloudSync.logout,
        sync: cloudSync.sync,
        uploadImage: cloudSync.uploadImage,
        cleanupImages: cloudSync.cleanupImages,
        testAI: cloudSync.testAI,
        token: cloudSync.token,
    }), [
        cloudSync.isLoggedIn,
        cloudSync.isSyncing,
        cloudSync.lastSynced,
        cloudSync.error,
        cloudSync.login,
        cloudSync.logout,
        cloudSync.sync,
        cloudSync.uploadImage,
        cloudSync.cleanupImages,
        cloudSync.testAI,
        cloudSync.token,
    ]);

    return (
        <SessionContext.Provider value={sessionContextValue}>
            <CloudSyncContext.Provider value={cloudSyncContextValue}>
                <UIStateProvider>
                    <Routes>
                        <Route path="/library" element={<LibraryPage />} />
                        <Route path="/gallery" element={<GalleryPage />} />
                        <Route path="/" element={
                            <MainView
                                isStreaming={isStreaming}
                                handlers={handlers}
                            />
                        } />
                    </Routes>
                </UIStateProvider>
            </CloudSyncContext.Provider>
        </SessionContext.Provider>
    );
}

/**
 * Main view component — separated from App so it can consume UIStateContext.
 * This eliminates the need to lift UI state from the context back into App.
 */
function MainView({
    isStreaming,
    handlers,
}: {
    isStreaming: boolean;
    handlers: ReturnType<typeof useEntryHandlers>;
}) {
    const { state, actions } = useSessionContext();
    const ui = useUIStateContext();
    const inputPanelRef = useRef<InputPanelRef>(null);

    // Follow-up linking
    const followUp = useFollowUpLink({
        entries: state.entries,
        updateEntry: actions.updateEntry,
        inputPanelRef,
    });

    // Optimized filtered entries: pre-sort once, then filter
    const sortedEntries = useMemo(
        () => [...state.entries].sort((a, b) => b.timestamp - a.timestamp),
        [state.entries]
    );

    const filteredEntries = useMemo(() => {
        if (ui.categoryFilter.length > 0) {
            return sortedEntries.filter(entry =>
                ui.categoryFilter.includes(entry.category as CategoryId)
            );
        }
        if (ui.tagFilter.length > 0) {
            return sortedEntries.filter(entry =>
                entry.tags && ui.tagFilter.every(t => entry.tags!.includes(t))
            );
        }
        if (ui.contentTypeFilter.length > 0) {
            return sortedEntries.filter(entry =>
                entry.contentType && ui.contentTypeFilter.includes(entry.contentType)
            );
        }
        // Date filter — no sort needed, just filter from sorted
        const target = ui.selectedDate || new Date();
        const dayStart = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
        const dayEnd = dayStart + 86_400_000;
        return state.entries.filter(entry =>
            entry.timestamp >= dayStart && entry.timestamp < dayEnd
        );
    }, [sortedEntries, state.entries, ui.categoryFilter, ui.tagFilter, ui.contentTypeFilter, ui.selectedDate]);

    return (
        <div className="min-h-screen flex flex-col font-mono" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
            <Header
                isStreaming={isStreaming}
                selectedDate={ui.selectedDate}
                onDateChange={ui.setSelectedDate}
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
                        categoryFilter={ui.categoryFilter}
                        isFilterMode={ui.categoryFilter.length > 0 || ui.tagFilter.length > 0 || ui.contentTypeFilter.length > 0}
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

            <ActivityPanel
                isOpen={ui.leftSidebarOpen}
                onClose={() => ui.setLeftSidebarOpen(false)}
                categoryFilter={ui.categoryFilter}
                onCategoryFilterChange={ui.setCategoryFilter}
                tagFilter={ui.tagFilter}
                onTagFilterChange={ui.setTagFilter}
                contentTypeFilter={ui.contentTypeFilter}
                onContentTypeFilterChange={ui.setContentTypeFilter}
            />

            <ContextMenu
                isOpen={ui.contextMenu.isOpen}
                position={ui.contextMenu.position}
                entry={ui.contextMenu.entry}
                onClose={ui.closeContextMenu}
                onEdit={(entry) => handlers.handleEditEntry(entry, ui.openEditModal)}
                onDelete={handlers.handleDeleteEntry}
                onCopy={handlers.handleCopyEntry}
                onLink={followUp.handleFollowUp}
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
            />
        </div>
    );
}

export default App;
