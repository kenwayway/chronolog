type ContentTypedEntity = {
  contentType?: string
  fieldValues?: object
}

/**
 * Fields removed from built-in content types, by the type that used to own them.
 *
 * - `workout.exercises` — replaced by the structured workout fields.
 * - `bookmark.status` — an Inbox/Reading/Archived dropdown that defaulted to
 *   Inbox and was never moved off it, so every clipping turned into an unread
 *   debt the user never actually took on. Saving a link is not a promise.
 */
const RETIRED_FIELDS: Record<string, readonly string[]> = {
  workout: ['exercises'],
  bookmark: ['status'],
}

/**
 * Remove fields retired from built-in content types.
 *
 * This stays at the domain boundary so old imports, sync payloads, and clients
 * cannot reintroduce data that the current schema no longer supports.
 *
 * Returns the original reference untouched when there is nothing to strip —
 * `sanitizeContentTypedEntity` uses that identity to avoid cloning entities.
 */
export function sanitizeContentTypeFieldValues(
  contentType: string | null | undefined,
  fieldValues: Record<string, unknown> | null | undefined,
): Record<string, unknown> | undefined {
  if (!fieldValues || !contentType) return fieldValues ?? undefined

  const retired = RETIRED_FIELDS[contentType]
  if (!retired) return fieldValues

  const present = retired.filter(field =>
    Object.prototype.hasOwnProperty.call(fieldValues, field))
  if (present.length === 0) return fieldValues

  const remaining = { ...fieldValues }
  for (const field of present) delete remaining[field]
  return Object.keys(remaining).length > 0 ? remaining : undefined
}

export function sanitizeContentTypedEntity<T extends ContentTypedEntity>(entity: T): T {
  const current = entity.fieldValues as Record<string, unknown> | undefined
  const sanitized = sanitizeContentTypeFieldValues(entity.contentType, current)
  if (sanitized === current) return entity

  const updated = { ...entity } as T & { fieldValues?: Record<string, unknown> }
  if (sanitized) updated.fieldValues = sanitized
  else delete updated.fieldValues
  return updated
}
