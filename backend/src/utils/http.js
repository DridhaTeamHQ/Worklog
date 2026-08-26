/** Consistent success envelope so the frontend has one shape to unwrap. */
export const ok = (res, data, meta) =>
  res.json(meta ? { success: true, data, meta } : { success: true, data });

export const created = (res, data) => res.status(201).json({ success: true, data });
