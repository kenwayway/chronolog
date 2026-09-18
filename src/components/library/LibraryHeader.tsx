import React from 'react';
import { ArrowLeft, Search, X, Plus, LayoutGrid, CalendarDays } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import type { LibraryGroupMode } from '@/utils/mediaHelpers';
import styles from './LibraryPage.module.css';

interface LibraryHeaderProps {
  totalCount: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onBack: () => void;
  onAdd: () => void;
  groupMode: LibraryGroupMode;
  onGroupModeChange: (mode: LibraryGroupMode) => void;
}

export function LibraryHeader({ totalCount, searchQuery, onSearchChange, onBack, onAdd, groupMode, onGroupModeChange }: LibraryHeaderProps) {
  const { tokens } = useTheme();

  return (
    <header className={styles.header}>
      <button onClick={onBack} className={styles.headerBackBtn} title="Back to timeline">
        <ArrowLeft size={18} />
      </button>
      <div className={styles.headerTitle}>
        <div className={styles.headerTitleRow}>
          <span className={styles.headerPrefix}>{tokens.panelTitlePrefix}</span>
          <span className={styles.headerLabel}>LIBRARY</span>
          <span className={styles.headerCount}>&middot; {totalCount}</span>
        </div>
      </div>
      <div className={styles.groupToggle} role="group" aria-label="Group by">
        <button
          onClick={() => onGroupModeChange('type')}
          className={`${styles.groupToggleBtn} ${groupMode === 'type' ? styles.groupToggleBtnActive : ''}`}
          aria-pressed={groupMode === 'type'}
          title="Group by type"
        >
          <LayoutGrid size={12} />
          TYPE
        </button>
        <button
          onClick={() => onGroupModeChange('month')}
          className={`${styles.groupToggleBtn} ${groupMode === 'month' ? styles.groupToggleBtnActive : ''}`}
          aria-pressed={groupMode === 'month'}
          title="Group by month finished"
        >
          <CalendarDays size={12} />
          MONTH
        </button>
      </div>
      <div className={styles.headerSearch}>
        <Search size={13} className={styles.headerSearchIcon} />
        <input
          type="text"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search..."
          className={styles.headerSearchInput}
        />
        {searchQuery && (
          <button onClick={() => onSearchChange('')} className={styles.headerClearBtn}>
            <X size={12} />
          </button>
        )}
      </div>
      <button onClick={onAdd} className="icon-btn" style={{ width: 32, height: 32 }} title="Add media">
        <Plus size={16} />
      </button>
    </header>
  );
}
