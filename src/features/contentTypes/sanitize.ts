type ContentTypedEntity = {
  contentType?: string
  fieldValues?: object
}

/**
 * Remove fields retired from built-in content types.
 *
 * This stays at the domain boundary so old imports, sync payloads, and clients
 * cannot reintroduce data that the current schema no longer supports.
 */
export function sanitizeContentTypeFieldValues(
  contentType: string | null | undefined,
  fieldValues: Record<string, unknown> | null | undefined,
): Record<string, unknown> | undefined {
  if (
    !fieldValues
    || contentType !== 'workout'
    || !Object.prototype.hasOwnProperty.call(fieldValues, 'exercises')
  ) {
    return fieldValues ?? undefined
  }

  const { exercises: _retiredExercises, ...remaining } = fieldValues
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
