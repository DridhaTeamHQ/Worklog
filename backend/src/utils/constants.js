/**
 * Domain vocabulary shared by the models (which store these values) and the routes
 * (whose Zod schemas validate against them).
 *
 * They live here rather than in a model so that a route never has to reach into the
 * model layer just to build a validation schema.
 */

export const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
export const STATUSES = ['pending', 'in_progress', 'completed'];
/** `overdue` is derived, never stored — it is filterable but not settable. */
export const FILTER_STATUSES = [...STATUSES, 'overdue'];

export const SEVERITIES = ['low', 'medium', 'high', 'critical'];
export const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
