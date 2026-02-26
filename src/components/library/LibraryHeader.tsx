import React from 'react';
import { ArrowLeft, Search, X, Plus } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import styles from './LibraryPage.module.css';

interface LibraryHeaderProps {
  totalCount: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onBack: () => void;
  onAdd: () => void;
}

export function LibraryHeader({ totalCount, searchQuery, onSearchChange, onBack, onAdd }: LibraryHeaderProps) {
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
