import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useSession } from "./hooks/useSession";
import { useCategories } from "./hooks/useCategories";
import { useTheme } from "./hooks/useTheme";
import { useCloudSync } from "./hooks/useCloudSync";
import { useAICategories } from "./hooks/useAICategories";
import { useGoogleTasks } from "./hooks/useGoogleTasks";
import { useEntryHandlers } from "./hooks/useEntryHandlers";
import { useAutoCategorize } from "./hooks/useAutoCategorize";

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
import type { Entry, CategoryId } from "./types";
import type { InputPanelRef } from "./components/input/InputPanel";

interface Position {
    x: number;
    y: number;
}

interface ContextMenuState {
    isOpen: boolean;
    position: Position;
    entry: Entry | null;
}

interface EditModalState {
    isOpen: boolean;
    entry: Entry | null;
}

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

    // Entry handlers (extracted to reduce App.jsx complexity)
    const handlers = useEntryHandlers({
        actions,
        isLoggedIn: cloudSync.isLoggedIn,
        googleTasks,
    });

    // UI State
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [editModal, setEditModal] = useState<EditModalState>({ isOpen: false, entry: null });
    const [followUpEntry, setFollowUpEntry] = useState<Entry | null>(null); // Entry to follow up on
    const [categoryFilter, setCategoryFilter] = useState<CategoryId[]>([]);
    const [showLanding, setShowLanding] = useState(true); // Show landing page initially
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({
        isOpen: false,
        position: { x: 0, y: 0 },
        entry: null,
    });

    // Ref to focus input panel
    const inputPanelRef = useRef<InputPanelRef>(null);

    // Ref to track pending link (entry ID to link the next new entry to)
    const pendingLinkRef = useRef<string | null>(null);
    const prevEntriesLengthRef = useRef(state.entries.length);

    // Watch for new entries and create pending links
    useEffect(() => {
        if (state.entries.length > prevEntriesLengthRef.current && pendingLinkRef.current) {
            // A new entry was added and we have a pending link
            const newEntry = state.entries[state.entries.length - 1];
            const linkToId = pendingLinkRef.current;

            if (newEntry && linkToId) {
                // Create bidirectional link
                const linkToEntry = state.entries.find(e => e.id === linkToId);

                if (linkToEntry) {
                    // Update the new entry
                    const newLinks = newEntry.linkedEntries || [];
                    if (!newLinks.includes(linkToId)) {
                        actions.updateEntry(newEntry.id, { linkedEntries: [...newLinks, linkToId] });
                    }

                    // Update the linked-to entry
                    const existingLinks = linkToEntry.linkedEntries || [];
                    if (!existingLinks.includes(newEntry.id)) {
                        actions.updateEntry(linkToId, { linkedEntries: [...existingLinks, newEntry.id] });
                    }
                }
            }

            pendingLinkRef.current = null;
            setFollowUpEntry(null); // Clear follow-up UI state
        }
        prevEntriesLengthRef.current = state.entries.length;
    }, [state.entries, actions]);

    // Context menu handlers
    const handleContextMenu = useCallback((entry: Entry, position: Position) => {
        setContextMenu({ isOpen: true, position, entry });
    }, []);

    const closeContextMenu = useCallback(() => {
        setContextMenu(prev => ({ ...prev, isOpen: false }));
    }, []);



    // Edit modal handlers
    const openEditModal = useCallback((entry: Entry) => {
        setEditModal({ isOpen: true, entry });
    }, []);

    const closeEditModal = useCallback(() => {
        setEditModal({ isOpen: false, entry: null });
    }, []);

    // Follow up handler - set entry to follow up and focus input
    const handleFollowUp = useCallback((entry: Entry) => {
        setFollowUpEntry(entry);
        pendingLinkRef.current = entry.id; // Set pending link
        // Focus input panel after state update
        setTimeout(() => {
            inputPanelRef.current?.focus();
        }, 100);
    }, []);

    // Clear follow up
    const clearFollowUp = useCallback(() => {
        setFollowUpEntry(null);
        pendingLinkRef.current = null; // Clear pending link
    }, []);

    // Navigate to an entry (switch date if needed)
    const navigateToEntry = useCallback((targetEntry: Entry) => {
        if (!targetEntry) return;
        const targetDate = new Date(targetEntry.timestamp);
        targetDate.setHours(0, 0, 0, 0);

        // Switch to the target date
        setSelectedDate(targetDate);

        // After a short delay, scroll to the entry
        setTimeout(() => {
            const entryElement = document.querySelector(`[data-entry-id="${targetEntry.id}"]`) as HTMLElement | null;
            if (entryElement) {
                entryElement.scrollIntoView({ behavior: "smooth", block: "center" });
                entryElement.style.backgroundColor = "var(--accent-subtle)";
                setTimeout(() => {
                    entryElement.style.backgroundColor = "";
                }, 1500);
            }
        }, 100);
    }, []);

    // Filtered entries for timeline (memoized for performance)
    const filteredEntries = useMemo(() => {
        // When category filter is active, show ALL matching entries (ignore date)
        if (categoryFilter.length > 0) {
            return state.entries
                .filter(entry => categoryFilter.includes(entry.category as CategoryId))
                .sort((a, b) => b.timestamp - a.timestamp);
        }
        // Otherwise, filter by date using timestamp range (avoids Date object creation per entry)
        const target = selectedDate || new Date();
        const dayStart = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
        const dayEnd = dayStart + 86_400_000; // 24h in ms
        return state.entries.filter(entry =>
            entry.timestamp >= dayStart && entry.timestamp < dayEnd
        );
    }, [state.entries, categoryFilter, selectedDate]);

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

            <main className="flex-1 flex flex-col max-w-4xl w-full mx-auto relative">
                {showLanding ? (
                    <LandingPage onDismiss={() => setShowLanding(false)} />
                ) : (
                    <Timeline
                        entries={filteredEntries}
                        allEntries={state.entries}
                        status={state.status}
                        categories={categories}
                        onContextMenu={handleContextMenu}
                        onEdit={openEditModal}
                        categoryFilter={categoryFilter}
                        onNavigateToEntry={navigateToEntry}
                        mediaItems={state.mediaItems}
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
                cloudSync={cloudSync}
                followUpEntry={followUpEntry}
                onClearFollowUp={clearFollowUp}
                mediaItems={state.mediaItems}
                onAddMediaItem={actions.addMediaItem}
            />

            <TasksPanel
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                onCompleteTask={handlers.handleCompleteTask}
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
                onEdit={(entry) => handlers.handleEditEntry(entry, openEditModal)}
                onDelete={handlers.handleDeleteEntry}
                onCopy={handlers.handleCopyEntry}
                onMarkAsTask={handlers.handleMarkAsTask}
                onLink={handleFollowUp}
                onDeleteAIComment={(entry) => actions.updateEntry(entry.id, { aiComment: undefined })}
                googleTasksEnabled={googleTasks.isLoggedIn}
            />

            <EditModal
                isOpen={editModal.isOpen}
                entry={editModal.entry}
                categories={categories}
                onSave={handlers.handleSaveEdit}
                onClose={closeEditModal}
                allEntries={state.entries}
                mediaItems={state.mediaItems}
                onAddMediaItem={actions.addMediaItem}
            />

            <SettingsModal
                isOpen={settingsOpen}
                onClose={() => setSettingsOpen(false)}

                categories={categories}
                entries={state.entries}
                contentTypes={state.contentTypes}
                mediaItems={state.mediaItems}
                onImportData={actions.importData}
                cloudSync={cloudSync}
                googleTasks={googleTasks}
            />
        </div>
    );
}

export default App;
