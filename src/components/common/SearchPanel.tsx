import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { CornerDownLeft, Search, X } from 'lucide-react'
import { useSessionContext } from '@/contexts/SessionContext'
import { useUIStateContext } from '@/hooks/useUIStateContext'
import { searchEntries } from '@/utils/searchEntries'
import type { TimelineItem } from '@/types'
import styles from './SearchPanel.module.css'

const RESULT_LIMIT = 100
const dateFormatter = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
})

function getPreview(entry: TimelineItem): string {
    const values = Object.values(entry.fieldValues ?? {})
        .filter(value => ['string', 'number', 'boolean'].includes(typeof value))
        .map(String)

    return [entry.content.trim(), ...values].filter(Boolean).join(' · ') || '(empty entry)'
}

function highlightText(text: string, query: string): ReactNode {
    const tokens = query.trim().split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return text

    const escaped = tokens.map(token => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const pattern = new RegExp(`(${escaped.join('|')})`, 'gi')

    return text.split(pattern).map((part, index) => (
        index % 2 === 1
            ? <mark key={`${part}-${index}`}>{part}</mark>
            : part
    ))
}

export function SearchPanel() {
    const { state: { contentTypes, mediaItems }, timelineItems: entries, categories } = useSessionContext()
    const {
        searchOpen,
        setSearchOpen,
        setCategoryFilter,
        setTagFilter,
        setContentTypeFilter,
        navigateToEntry,
    } = useUIStateContext()
    const [query, setQuery] = useState('')
    const [activeIndex, setActiveIndex] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)
    const activeResultRef = useRef<HTMLButtonElement>(null)

    const results = useMemo(() => searchEntries(entries, query, {
        categories,
        contentTypes,
        mediaItems,
    }), [entries, query, categories, contentTypes, mediaItems])
    const visibleResults = results.slice(0, RESULT_LIMIT)
    const selectedIndex = Math.min(activeIndex, Math.max(visibleResults.length - 1, 0))

    const closeSearch = useCallback(() => {
        setSearchOpen(false)
        setQuery('')
        setActiveIndex(0)
    }, [setSearchOpen])

    const openEntry = (entry: TimelineItem) => {
        setCategoryFilter([])
        setTagFilter([])
        setContentTypeFilter([])
        closeSearch()
        navigateToEntry(entry)
    }

    useEffect(() => {
        const handleGlobalKeyDown = (event: globalThis.KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') {
                event.preventDefault()
                if (searchOpen) closeSearch()
                else setSearchOpen(true)
            } else if (event.key === 'Escape' && searchOpen) {
                event.preventDefault()
                closeSearch()
            }
        }

        document.addEventListener('keydown', handleGlobalKeyDown)
        return () => document.removeEventListener('keydown', handleGlobalKeyDown)
    }, [searchOpen, setSearchOpen, closeSearch])

    useEffect(() => {
        if (searchOpen) inputRef.current?.focus()
    }, [searchOpen])

    useEffect(() => {
        activeResultRef.current?.scrollIntoView({ block: 'nearest' })
    }, [selectedIndex])

    if (!searchOpen) return null

    const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault()
            if (visibleResults.length === 0) return
            setActiveIndex(index => Math.min(index + 1, visibleResults.length - 1))
        } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActiveIndex(index => Math.max(index - 1, 0))
        } else if (event.key === 'Enter' && visibleResults[selectedIndex]) {
            event.preventDefault()
            openEntry(visibleResults[selectedIndex])
        }
    }

    const handleBackdropMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget) closeSearch()
    }

    return (
        <div className={styles.overlay} onMouseDown={handleBackdropMouseDown}>
            <section
                className={styles.panel}
                role="dialog"
                aria-modal="true"
                aria-label="Search entries"
                onMouseDown={event => event.stopPropagation()}
            >
                <div className={styles.searchRow}>
                    <Search size={18} aria-hidden="true" />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={event => {
                            setQuery(event.target.value)
                            setActiveIndex(0)
                        }}
                        onKeyDown={handleInputKeyDown}
                        className={styles.input}
                        placeholder="Search entries, tags, fields..."
                        aria-label="Search query"
                        aria-controls="entry-search-results"
                        autoComplete="off"
                        spellCheck={false}
                    />
                    {query && (
                        <button
                            className={styles.clearButton}
                            onClick={() => {
                                setQuery('')
                                setActiveIndex(0)
                                inputRef.current?.focus()
                            }}
                            aria-label="Clear search"
                        >
                            <X size={16} />
                        </button>
                    )}
                    <kbd className={styles.shortcut}>ESC</kbd>
                </div>

                <div id="entry-search-results" className={styles.results} role="listbox">
                    {!query.trim() && (
                        <div className={styles.emptyState}>
                            <span className={styles.emptyPrompt}>_</span>
                            <span>SEARCH ALL HISTORY</span>
                            <small>Content, tags, categories, types, fields, and media titles</small>
                        </div>
                    )}

                    {query.trim() && visibleResults.length === 0 && (
                        <div className={styles.emptyState}>
                            <span className={styles.emptyPrompt}>0</span>
                            <span>NO MATCHING ENTRIES</span>
                            <small>Try fewer or broader keywords</small>
                        </div>
                    )}

                    {visibleResults.map((entry, index) => {
                        const category = categories.find(item => item.id === entry.category)
                        const contentType = contentTypes.find(item => item.id === entry.contentType)
                        const isActive = index === selectedIndex

                        return (
                            <button
                                key={entry.id}
                                ref={isActive ? activeResultRef : undefined}
                                className={`${styles.result} ${isActive ? styles.activeResult : ''}`}
                                onClick={() => openEntry(entry)}
                                onMouseEnter={() => setActiveIndex(index)}
                                role="option"
                                aria-selected={isActive}
                            >
                                <div className={styles.resultMeta}>
                                    <time>{dateFormatter.format(entry.timestamp)}</time>
                                    {category && (
                                        <span style={{ color: category.color }}>#{category.label}</span>
                                    )}
                                    {contentType && contentType.id !== 'note' && (
                                        <span>{contentType.icon} {contentType.name}</span>
                                    )}
                                    {entry.tags?.map(tag => <span key={tag}>#{tag}</span>)}
                                </div>
                                <div className={styles.preview}>
                                    {highlightText(getPreview(entry), query)}
                                </div>
                            </button>
                        )
                    })}
                </div>

                <footer className={styles.footer}>
                    <span>
                        {query.trim()
                            ? `${results.length} RESULT${results.length === 1 ? '' : 'S'}${results.length > RESULT_LIMIT ? ` · SHOWING ${RESULT_LIMIT}` : ''}`
                            : 'TYPE TO SEARCH'}
                    </span>
                    <span className={styles.keyboardHint}>
                        <kbd>↑</kbd><kbd>↓</kbd> NAVIGATE
                        <kbd><CornerDownLeft size={11} /></kbd> OPEN
                    </span>
                </footer>
            </section>
        </div>
    )
}
