import type { Entry, BookmarkFields, MoodFields, WorkoutFields, VaultFields, MediaFields, NotionTaskFields } from './index'

// ============================================
// Typed Entry interfaces (narrowed)
// ============================================

/** Entry with bookmark content type */
export interface BookmarkEntry extends Entry {
    contentType: 'bookmark'
    fieldValues: BookmarkFields
}

/** Entry with mood content type */
export interface MoodEntry extends Entry {
    contentType: 'mood'
    fieldValues: MoodFields
}

/** Entry with workout content type */
export interface WorkoutEntry extends Entry {
    contentType: 'workout'
    fieldValues: WorkoutFields
}

/** Entry with vault content type */
export interface VaultEntry extends Entry {
    contentType: 'vault'
    fieldValues: VaultFields
}

/** Entry with media content type */
export interface MediaEntry extends Entry {
    contentType: 'media'
    fieldValues: MediaFields
}

/** Entry with Notion task content type */
export interface NotionTaskEntry extends Entry {
    contentType: 'notion-task'
    fieldValues: NotionTaskFields
}

// ============================================
// Type Guards
// ============================================

/** Check if entry is a bookmark */
export function isBookmarkEntry(entry: Entry): entry is BookmarkEntry {
    return entry.contentType === 'bookmark' && entry.fieldValues !== undefined
}

/** Check if entry is a mood */
export function isMoodEntry(entry: Entry): entry is MoodEntry {
    return entry.contentType === 'mood' && entry.fieldValues !== undefined
}

/** Check if entry is a workout */
export function isWorkoutEntry(entry: Entry): entry is WorkoutEntry {
    return entry.contentType === 'workout' && entry.fieldValues !== undefined
}

/** Check if entry is a vault */
export function isVaultEntry(entry: Entry): entry is VaultEntry {
    return entry.contentType === 'vault' && entry.fieldValues !== undefined
}

/** Check if entry is a media */
export function isMediaEntry(entry: Entry): entry is MediaEntry {
    return entry.contentType === 'media' && entry.fieldValues !== undefined
}

/** Check if entry is linked to a Notion task */
export function isNotionTaskEntry(entry: Entry): entry is NotionTaskEntry {
    return entry.contentType === 'notion-task' && entry.fieldValues !== undefined
}

// ============================================
// Field Value Helpers
// ============================================

/** Safely get bookmark fields */
export function getBookmarkFields(entry: Entry): BookmarkFields | undefined {
    return isBookmarkEntry(entry) ? entry.fieldValues : undefined
}

/** Safely get mood fields */
export function getMoodFields(entry: Entry): MoodFields | undefined {
    return isMoodEntry(entry) ? entry.fieldValues : undefined
}

/** Safely get workout fields */
export function getWorkoutFields(entry: Entry): WorkoutFields | undefined {
    return isWorkoutEntry(entry) ? entry.fieldValues : undefined
}

/** Safely get vault fields */
export function getVaultFields(entry: Entry): VaultFields | undefined {
    return isVaultEntry(entry) ? entry.fieldValues : undefined
}

/** Safely get media fields */
export function getMediaFields(entry: Entry): MediaFields | undefined {
    return isMediaEntry(entry) ? entry.fieldValues : undefined
}

/** Safely get Notion task fields */
export function getNotionTaskFields(entry: Entry): NotionTaskFields | undefined {
    return isNotionTaskEntry(entry) ? entry.fieldValues : undefined
}
