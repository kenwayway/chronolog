import { lazy, Suspense, useRef, useMemo } from "react";
import { Routes, Route } from "react-router-dom";
import { useSession } from "./hooks/useSession";
import { useCategories } from "./hooks/useCategories";
import { useCloudSync } from "./hooks/useCloudSync";
import { useAICategories } from "./hooks/useAICategories";
import { useEntryHandlers } from "./hooks/useEntryHandlers";
import { useAutoCategorize } from "./hooks/useAutoCategorize";
import { useFollowUpLink } from "./hooks/useFollowUpLink";
import { buildTimelineLinkIndex, projectTimelineItems } from "./domain/timeline";
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
    EditModal,
    ActivityPanel,
    NavPanel,
    SearchPanel,
} from "./components";
import type { CategoryId, UseSessionReturn } from "./types";
import type { InputPanelRef } from "./components/input/InputPanel";
import styles from "./App.module.css";

// Route- and modal-level code splitting: keep the timeline's first paint
// small; these chunks load on navigation or when settings first opens.
const LibraryPage = lazy(() => import("./pages/LibraryPage").then(m => ({ default: m.LibraryPage })));
const GalleryPage = lazy(() => import("./pages/GalleryPage").then(m => ({ default: m.GalleryPage })));
const RetroPage = lazy(() => import("./pages/RetroPage").then(m => ({ default: m.RetroPage })));
const SettingsModal = lazy(() => import("./components/modals/SettingsModal").then(m => ({ default: m.SettingsModal })));

function App() {
    const session = useSession();

    if (!session.isHydrated) {
        return (
            <div className="min-h-screen flex items-center justify-center font-mono" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
                INITIALIZING STORAGE...
            </div>
        );
    }

    return <HydratedApp session={session} />;
}

function HydratedApp({ session }: { session: UseSessionReturn }) {
    const { state, isStreaming, actions } = session;
    const { categories } = useCategories();
    const { categorize } = useAICategories();
    const timelineItems = useMemo(
        () => projectTimelineItems(state.notes, state.sessions),
        [state.notes, state.sessions],
    );
    const linkIndex = useMemo(() => buildTimelineLinkIndex(timelineItems), [timelineItems]);

    // Cloud sync
    const cloudSync = useCloudSync({
        notes: state.notes,
        sessions: state.sessions,
        contentTypes: state.contentTypes,
        mediaItems: state.mediaItems,
        onImportData: actions.importData,
    });

    // Auto-categorize new entries via AI
    useAutoCategorize({
        items: timelineItems,
        contentTypes: state.contentTypes,
        isLoggedIn: cloudSync.isLoggedIn,
        categorize,
        updateNote: actions.updateNote,
        updateSession: actions.updateSession,
    });

    // Entry handlers (extracted to reduce App.tsx complexity)
    const handlers = useEntryHandlers({
        actions,
        isLoggedIn: cloudSync.isLoggedIn,
    });

    // Context values — memoized with stable deps to prevent unnecessary re-renders
    const sessionContextValue = useMemo(() => ({
        state,
        timelineItems,
        linkIndex,
        actions,
        categories,
        isStreaming,
    }), [state, timelineItems, linkIndex, actions, categories, isStreaming]);

    // Fix: field-by-field deps instead of the spread object (which is always a new ref)
    const cloudSyncContextValue = useMemo(() => ({
        isLoggedIn: cloudSync.isLoggedIn,
        isSyncing: cloudSync.isSyncing,
        lastSynced: cloudSync.lastSynced,
        error: cloudSync.error,
        notionSync: cloudSync.notionSync,
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
        cloudSync.notionSync,
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
                    <Suspense fallback={
                        <div className="min-h-screen flex items-center justify-center font-mono" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
                            LOADING MODULE...
                        </div>
                    }>
                        <Routes>
                            <Route path="/library" element={<LibraryPage />} />
                            <Route path="/gallery" element={<GalleryPage />} />
                            <Route path="/retro" element={<RetroPage />} />
                            <Route path="/" element={
                                <MainView
                                    isStreaming={isStreaming}
                                    handlers={handlers}
                                />
                            } />
                        </Routes>
                    </Suspense>
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
    const { state, actions, timelineItems } = useSessionContext();
    const ui = useUIStateContext();
    const inputPanelRef = useRef<InputPanelRef>(null);

    // Follow-up linking
    const followUp = useFollowUpLink({
        items: timelineItems,
        updateNote: actions.updateNote,
        updateSession: actions.updateSession,
        inputPanelRef,
    });

    const filteredEntries = useMemo(() => {
        const hasFilters = ui.categoryFilter.length > 0
            || ui.tagFilter.length > 0
            || ui.contentTypeFilter.length > 0;

        if (hasFilters) {
            let results = timelineItems;
            if (ui.categoryFilter.length > 0) {
                results = results.filter(entry => ui.categoryFilter.includes(entry.category as CategoryId));
            }
            if (ui.tagFilter.length > 0) {
                results = results.filter(entry => entry.tags && ui.tagFilter.every(tag => entry.tags!.includes(tag)));
            }
            if (ui.contentTypeFilter.length > 0) {
                results = results.filter(entry => entry.contentType && ui.contentTypeFilter.includes(entry.contentType));
            }
            return [...results].sort((a, b) => b.timestamp - a.timestamp);
        }

        // The default timeline only needs one day. Filter first and let Timeline
        // sort that small result, avoiding an O(n log n) sort of all history.
        const target = ui.selectedDate || new Date();
        const day = new Date(target.getFullYear(), target.getMonth(), target.getDate());
        const dayStart = day.getTime();
        const nextDay = new Date(day);
        nextDay.setDate(nextDay.getDate() + 1);
        const dayEnd = nextDay.getTime();
        return timelineItems.filter(entry =>
            entry.timestamp >= dayStart && entry.timestamp < dayEnd
        );
    }, [timelineItems, ui.categoryFilter, ui.tagFilter, ui.contentTypeFilter, ui.selectedDate]);

    return (
        <div
            className={`${styles.appShell} ${ui.leftSidebarOpen ? styles.activityPanelOpen : ""} min-h-screen flex flex-col font-mono`}
            style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
        >
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
                        filterKey={`${ui.categoryFilter.join(',')}|${ui.tagFilter.join(',')}|${ui.contentTypeFilter.join(',')}`}
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

            <SearchPanel />

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

            <NavPanel
                isOpen={ui.navOpen}
                onClose={() => ui.setNavOpen(false)}
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

            {/* Mounted only when open so its chunk loads on first use. */}
            {ui.settingsOpen && (
                <Suspense fallback={null}>
                    <SettingsModal
                        isOpen={ui.settingsOpen}
                        onClose={() => ui.setSettingsOpen(false)}
                    />
                </Suspense>
            )}
        </div>
    );
}

export default App;
