import { useState, useCallback } from "react";
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
  Timeline,
  InputPanel,
  TasksPanel,
  ContextMenu,
  SettingsModal,
  EditModal,
  ActivityPanel,
  LinkSelector,
} from "./components";

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
  const [selectedDate, setSelectedDate] = useState(null);
  const [editModal, setEditModal] = useState({ isOpen: false, entry: null });
  const [linkSelector, setLinkSelector] = useState({ isOpen: false, entry: null });
  const [categoryFilter, setCategoryFilter] = useState([]);
  const [contextMenu, setContextMenu] = useState({
    isOpen: false,
    position: { x: 0, y: 0 },
    entry: null,
  });

  // Context menu handlers
  const handleContextMenu = useCallback((entry, position) => {
    setContextMenu({ isOpen: true, position, entry });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, []);

  // Edit modal handlers
  const openEditModal = useCallback((entry) => {
    setEditModal({ isOpen: true, entry });
  }, []);

  const closeEditModal = useCallback(() => {
    setEditModal({ isOpen: false, entry: null });
  }, []);

  // Link selector handlers
  const openLinkSelector = useCallback((entry) => {
    setLinkSelector({ isOpen: true, entry });
  }, []);

  const closeLinkSelector = useCallback(() => {
    setLinkSelector({ isOpen: false, entry: null });
  }, []);

  // Bidirectional link handler
  const handleLink = useCallback((sourceId, newLinkedIds) => {
    const sourceEntry = state.entries.find(e => e.id === sourceId);
    if (!sourceEntry) return;

    const oldLinkedIds = sourceEntry.linkedEntries || [];

    // Update source entry
    actions.updateEntry(sourceId, { linkedEntries: newLinkedIds });

    // Find entries to add/remove backlinks
    const addedIds = newLinkedIds.filter(id => !oldLinkedIds.includes(id));
    const removedIds = oldLinkedIds.filter(id => !newLinkedIds.includes(id));

    // Add backlinks to newly linked entries
    addedIds.forEach(targetId => {
      const targetEntry = state.entries.find(e => e.id === targetId);
      if (targetEntry) {
        const targetLinks = targetEntry.linkedEntries || [];
        if (!targetLinks.includes(sourceId)) {
          actions.updateEntry(targetId, { linkedEntries: [...targetLinks, sourceId] });
        }
      }
    });

    // Remove backlinks from unlinked entries
    removedIds.forEach(targetId => {
      const targetEntry = state.entries.find(e => e.id === targetId);
      if (targetEntry) {
        const targetLinks = targetEntry.linkedEntries || [];
        actions.updateEntry(targetId, { linkedEntries: targetLinks.filter(id => id !== sourceId) });
      }
    });
  }, [state.entries, actions]);

  // Filtered entries for timeline
  const getFilteredEntries = () => {
    // When category filter is active, show ALL matching entries (ignore date)
    if (categoryFilter.length > 0) {
      return state.entries
        .filter(entry => categoryFilter.includes(entry.category))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
    // Otherwise, filter by date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = selectedDate || today;
    return state.entries.filter(entry => {
      const entryDate = new Date(entry.timestamp);
      return entryDate.toDateString() === targetDate.toDateString();
    });
  };

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
        <Timeline
          entries={getFilteredEntries()}
          allEntries={state.entries}
          status={state.status}
          categories={categories}
          onContextMenu={handleContextMenu}
          categoryFilter={categoryFilter}
        />
      </main>

      <InputPanel
        status={state.status}
        onLogIn={handlers.handleLogIn}
        onSwitch={handlers.handleSwitch}
        onNote={handlers.handleNote}
        onLogOff={handlers.handleLogOff}
        cloudSync={cloudSync}
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
        onLink={openLinkSelector}
        googleTasksEnabled={googleTasks.isLoggedIn}
      />

      <LinkSelector
        isOpen={linkSelector.isOpen}
        sourceEntry={linkSelector.entry}
        entries={state.entries}
        onLink={handleLink}
        onClose={closeLinkSelector}
      />

      <EditModal
        isOpen={editModal.isOpen}
        entry={editModal.entry}
        categories={categories}
        onSave={handlers.handleSaveEdit}
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
    </div>
  );
}

export default App;

