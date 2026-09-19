/**
 * Escapes LIKE metacharacters in a user-supplied search term.
 *
 * Without this, `%` and `_` typed by a person are read as wildcards: searching for
 * "100%" would match every message. Backslash is the escape character, declared with
 * ESCAPE '\\' at each call site so both drivers agree.
 */
export const escapeLike = (term) => term.replace(/[\\%_]/g, '\\$&');

/** Consistent success envelope so the frontend has one shape to unwrap. */
export const ok = (res, data, meta) =>
  res.json(meta ? { success: true, data, meta } : { success: true, data });

export const created = (res, data) => res.status(201).json({ success: true, data });
