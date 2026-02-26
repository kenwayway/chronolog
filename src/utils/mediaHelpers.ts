import React from 'react';
import { Book, Film, Gamepad2, Tv, Clapperboard, Mic } from 'lucide-react';
import type { MediaType, MediaStatus, MediaMetadata } from '@/types';

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
