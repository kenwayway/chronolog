/**
 * Type guards for content type narrowing
 * Use these to safely access typed fieldValues
 */

import type { Entry, TaskFields, BookmarkFields, MoodFields, WorkoutFields, MediaFields } from './index'

// ============================================
// Typed Entry interfaces (narrowed)
// ============================================

/** Entry with task content type */
export interface TaskEntry extends Entry {
    contentType: 'task'
    fieldValues: TaskFields
}

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

/** Entry with media content type */
export interface MediaEntry extends Entry {
    contentType: 'media'
    fieldValues: MediaFields
}

// ============================================
// Type Guards
// ============================================

/** Check if entry is a task */
export function isTaskEntry(entry: Entry): entry is TaskEntry {
    return entry.contentType === 'task' && entry.fieldValues !== undefined
}

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

/** Check if entry is a media */
export function isMediaEntry(entry: Entry): entry is MediaEntry {
    return entry.contentType === 'media' && entry.fieldValues !== undefined
}

// ============================================
// Field Value Helpers
// ============================================

/** Safely get task fields (returns undefined if not a task) */
export function getTaskFields(entry: Entry): TaskFields | undefined {
    return isTaskEntry(entry) ? entry.fieldValues : undefined
}

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

/** Safely get media fields */
export function getMediaFields(entry: Entry): MediaFields | undefined {
    return isMediaEntry(entry) ? entry.fieldValues : undefined
}
