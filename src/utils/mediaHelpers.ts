import React from 'react';
import { Book, Film, Gamepad2, Tv, Clapperboard, Mic, CalendarCheck, CalendarOff } from 'lucide-react';
import type { MediaType, MediaStatus, MediaMetadata, MediaItem, TimelineItem } from '@/types';

export const MEDIA_TYPES: MediaType[] = ['Book', 'Movie', 'Game', 'TV', 'Anime', 'Podcast'];
export const MEDIA_STATUSES: MediaStatus[] = ['Planned', 'In Progress', 'Completed', 'Dropped', 'On Hold'];

export function getMediaIcon(mediaType: string, size: number = 16) {
  const iconProps = { size, strokeWidth: 2 };
  switch (mediaType) {
    case 'Book': return React.createElement(Book, iconProps);
    case 'Movie': return React.createElement(Film, iconProps);
    case 'Game': return React.createElement(Gamepad2, iconProps);
    case 'TV': return React.createElement(Tv, iconProps);
    case 'Anime': return React.createElement(Clapperboard, iconProps);
    case 'Podcast': return React.createElement(Mic, iconProps);
    default: return React.createElement(Film, iconProps);
  }
}

export function getMediaLabel(type: string) {
  const labels: Record<string, string> = {
    'Book': 'BOOKS', 'Movie': 'MOVIES', 'Game': 'GAMES',
    'TV': 'TV SHOWS', 'Anime': 'ANIME', 'Podcast': 'PODCASTS',
  };
  return labels[type] || type.toUpperCase();
}

export function getStatusColor(status?: MediaStatus) {
  switch (status) {
    case 'Completed': return '#22c55e';
    case 'In Progress': return '#3b82f6';
    case 'Planned': return '#a78bfa';
    case 'On Hold': return '#f59e0b';
    case 'Dropped': return '#ef4444';
    default: return 'var(--text-dim)';
  }
}

export function getMetadataFields(type: MediaType): { key: keyof MediaMetadata; label: string; inputType: 'text' | 'number' | 'date' }[] {
  switch (type) {
    case 'Movie': return [
      { key: 'director', label: 'Director', inputType: 'text' },
      { key: 'year', label: 'Year', inputType: 'number' },
      { key: 'genre', label: 'Genre', inputType: 'text' },
      { key: 'releasedDate', label: 'Released', inputType: 'date' },
    ];
    case 'Book': return [
      { key: 'author', label: 'Author', inputType: 'text' },
      { key: 'genre', label: 'Genre', inputType: 'text' },
    ];
    case 'Game': return [
      { key: 'developer', label: 'Developer', inputType: 'text' },
      { key: 'genre', label: 'Genre', inputType: 'text' },
      { key: 'releasedDate', label: 'Released', inputType: 'date' },
    ];
    case 'TV': return [
      { key: 'season', label: 'Season', inputType: 'number' },
    ];
    case 'Anime': return [
      { key: 'season', label: 'Season', inputType: 'number' },
    ];
    case 'Podcast': return [
      { key: 'host', label: 'Host', inputType: 'text' },
    ];
    default: return [];
  }
}

// ============================================
// Grouping
// ============================================

/** How the library page buckets its cards */
export type LibraryGroupMode = 'type' | 'month';

/** One rendered section of the library grid */
export interface LibrarySection {
  key: string;
  label: string;
  icon: React.ReactNode;
  items: MediaItem[];
}

/** Bucket key for items with no dateFinished — sorts last, never a real month */
const UNDATED_KEY = '__undated';

const MONTH_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

/**
 * Month bucket for an item, derived from dateFinished ("YYYY-MM-DD" → "YYYY-MM").
 * Sliced as a string rather than parsed as a Date: `new Date('2026-09-01')` is
 * UTC midnight, which lands in the previous month for anyone west of Greenwich.
 */
export function getMonthKey(item: MediaItem): string {
  const d = item.dateFinished;
  if (!d || !/^\d{4}-\d{2}/.test(d)) return UNDATED_KEY;
  return d.slice(0, 7);
}

/** "2026-09" → "SEPTEMBER 2026"; the undated bucket gets its own label */
export function getMonthLabel(key: string): string {
  if (key === UNDATED_KEY) return 'NO FINISH DATE';
  const [year, month] = key.split('-');
  const name = MONTH_NAMES[Number(month) - 1];
  return name ? `${name} ${year}` : key;
}

/** Group by media type, in MEDIA_TYPES order, newest-added first within a type */
export function groupByType(items: MediaItem[]): LibrarySection[] {
  const sections: LibrarySection[] = [];
  for (const type of MEDIA_TYPES) {
    const group = items.filter(m => m.mediaType === type);
    if (group.length === 0) continue;
    sections.push({
      key: type,
      label: getMediaLabel(type),
      icon: getMediaIcon(type, 12),
      items: group.sort((a, b) => b.createdAt - a.createdAt),
    });
  }
  return sections;
}

/**
 * Group by the month an item was finished, newest month first, with everything
 * missing a dateFinished collected into a trailing bucket.
 */
export function groupByMonth(items: MediaItem[]): LibrarySection[] {
  const buckets = new Map<string, MediaItem[]>();
  for (const item of items) {
    const key = getMonthKey(item);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }

  return [...buckets.keys()]
    .sort((a, b) => {
      // The undated bucket always trails the real months
      if (a === UNDATED_KEY) return 1;
      if (b === UNDATED_KEY) return -1;
      return b.localeCompare(a);
    })
    .map(key => ({
      key,
      label: getMonthLabel(key),
      icon: React.createElement(key === UNDATED_KEY ? CalendarOff : CalendarCheck, { size: 12, strokeWidth: 2 }),
      items: buckets.get(key)!.sort((a, b) => {
        const byDate = (b.dateFinished ?? '').localeCompare(a.dateFinished ?? '');
        return byDate !== 0 ? byDate : b.createdAt - a.createdAt;
      }),
    }));
}

// ============================================
// Reverse links: timeline entries → media item
// ============================================

/** One row in a media item's LOGS, oldest first */
export interface LinkedEntry {
  entry: TimelineItem;
  /** On a linked session start: how long the session ran, once it has ended */
  durationMs?: number;
}

function referencesMedia(entry: TimelineItem, mediaId: string): boolean {
  const values = entry.fieldValues;
  if (!values || !('mediaId' in values)) return false;
  return (values as { mediaId?: unknown }).mediaId === mediaId;
}

/**
 * Every timeline entry about this media item, oldest first.
 *
 * Direct matches go by `fieldValues.mediaId` rather than contentType: a
 * custom content type carrying a media-select field links up just the same.
 *
 * Only session starts carry fieldValues, so a linked session also pulls in
 * what was written while it ran — the notes logged during it and its closing
 * text, which is usually where the verdict lives. Zaddy comments stay out:
 * they hang off an entry, they are not logs of their own.
 */
export function findLinkedEntries(entries: TimelineItem[], mediaId: string): LinkedEntry[] {
  if (!mediaId) return [];
  const direct = entries.filter(entry => referencesMedia(entry, mediaId));
  const sessionIds = new Set(
    direct.filter(e => e.kind === 'session-start').map(e => e.entityId)
  );
  const endAt = new Map(
    entries.filter(e => e.kind === 'session-end' && sessionIds.has(e.entityId))
      .map(e => [e.entityId, e.timestamp])
  );
  const directIds = new Set(direct.map(e => e.id));

  const duringSessions = entries.filter(entry => {
    if (directIds.has(entry.id)) return false;
    if (entry.contentType === 'zaddy-comment') return false;
    if (entry.kind === 'session-end') {
      return sessionIds.has(entry.entityId) && entry.content.trim() !== '';
    }
    return entry.kind === 'note' && !!entry.sessionId && sessionIds.has(entry.sessionId);
  });

  return [
    ...direct.map(entry => {
      const end = entry.kind === 'session-start' ? endAt.get(entry.entityId) : undefined;
      return {
        entry,
        durationMs: end !== undefined ? end - entry.timestamp : undefined,
      };
    }),
    ...duringSessions.map(entry => ({ entry })),
  ].sort((a, b) => a.entry.timestamp - b.entry.timestamp);
}
