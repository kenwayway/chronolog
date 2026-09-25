import React from 'react';
import { Book, Film, Gamepad2, Tv, Clapperboard, Mic, CalendarCheck, CalendarOff } from 'lucide-react';
import type { MediaType, MediaStatus, MediaMetadata, MediaItem, TimelineItem } from '@/types';
import { sessionEndTimelineId } from '@/domain/timeline';

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

/** A linked entry, with its session's closing text when it is a session start */
export interface LinkedEntry {
  entry: TimelineItem;
  /** The matching session-end item, present only when it carries text */
  end?: TimelineItem;
}

/**
 * Timeline entries that reference this media item, newest first.
 *
 * Matches on `fieldValues.mediaId` rather than on contentType: a custom
 * content type carrying a media-select field links up just the same.
 *
 * Only session starts carry fieldValues, so a session's end is paired back in
 * here — that closing note is usually where the verdict lives.
 */
export function findLinkedEntries(entries: TimelineItem[], mediaId: string): LinkedEntry[] {
  if (!mediaId) return [];
  const matched = entries.filter(entry => {
    const values = entry.fieldValues;
    if (!values || !('mediaId' in values)) return false;
    return (values as { mediaId?: unknown }).mediaId === mediaId;
  });

  const endIds = new Set(
    matched.filter(e => e.kind === 'session-start').map(e => sessionEndTimelineId(e.entityId))
  );
  const ends = new Map(
    entries.filter(e => endIds.has(e.id) && e.content.trim()).map(e => [e.entityId, e])
  );

  return matched
    .sort((a, b) => b.timestamp - a.timestamp)
    .map(entry => ({
      entry,
      end: entry.kind === 'session-start' ? ends.get(entry.entityId) : undefined,
    }));
}
