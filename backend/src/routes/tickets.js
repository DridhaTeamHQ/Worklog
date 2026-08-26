import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate, safeText, optionalText } from '../middleware/validate.js';
import { ok, created } from '../utils/http.js';
import { asyncHandler, badRequest, forbidden, notFound } from '../utils/errors.js';
import {
  listTickets, getTicketById, createTicket, updateTicketStatus, updateTicket, deleteTicket,
  ticketCounts, SEVERITIES, TICKET_STATUSES,
} from '../services/tickets.js';

const router = Router();
router.use(requireAuth);

const listQuery = z.object({
  reporterId: z.coerce.number().int().positive().optional(),
  projectId: z.coerce.number().int().positive().optional(),
  taskId: z.coerce.number().int().positive().optional(),
  status: z.enum([...TICKET_STATUSES, 'unresolved']).optional(),
  severity: z.enum(SEVERITIES).optional(),
  search: z.string().trim().max(200).optional(),
  sort: z.enum(['created_desc', 'created_asc', 'severity_desc', 'status_asc']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/tickets
 * Managers see every ticket and may filter by reporter; team members are pinned to
 * their own id regardless of what they send.
 */
router.get('/', validate(listQuery, 'query'), asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const filters = req.user.role === 'manager'
    ? { ...q }
    : { ...q, reporterId: req.user.id };

  const { items, total } = await listTickets(filters);
  const counts = await ticketCounts(
    req.user.role === 'manager' ? {} : { reporterId: req.user.id },
  );
  return ok(res, items, { total, counts, limit: q.limit, offset: q.offset });
}));

const parseId = (raw) => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid ticket id.');
  return id;
};

router.get('/:id', asyncHandler(async (req, res) => {
  const ticket = await getTicketById(parseId(req.params.id));
  if (!ticket) throw notFound('That ticket no longer exists.');
  if (req.user.role === 'team_member' && ticket.reporter_id !== req.user.id) {
    throw forbidden('You can only view tickets you raised.');
  }
  return ok(res, ticket);
}));

const createSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  taskId: z.coerce.number().int().positive(),
  title: safeText(160, 'Ticket title'),
  description: safeText(6000, 'Bug description'),
  severity: z.enum(SEVERITIES).default('medium'),
});

/**
 * POST /api/tickets — team members only.
 *
 * Managers do not raise tickets here: a ticket is a report from the person doing the
 * work, and the service ties it to a task assigned to them.
 */
router.post('/', validate(createSchema), asyncHandler(async (req, res) => {
  if (req.user.role !== 'team_member') {
    throw forbidden('Tickets are raised by the team member working on the task.');
  }
  const ticket = await createTicket({ ...req.body, reporterId: req.user.id });
  return created(res, {
    ticket,
    message: `Ticket ${ticket.ticket_key} raised. Your manager has been notified.`,
  });
}));

const statusSchema = z.object({
  status: z.enum(TICKET_STATUSES),
  resolutionNote: optionalText(2000),
});

router.patch('/:id/status', validate(statusSchema), asyncHandler(async (req, res) => {
  const ticket = await updateTicketStatus({
    ticketId: parseId(req.params.id),
    status: req.body.status,
    resolutionNote: req.body.resolutionNote,
    actor: req.user,
  });
  return ok(res, ticket);
}));

const patchSchema = z.object({
  title: safeText(160, 'Ticket title').optional(),
  description: safeText(6000, 'Bug description').optional(),
  severity: z.enum(SEVERITIES).optional(),
});

router.patch('/:id', validate(patchSchema), asyncHandler(async (req, res) => {
  const ticket = await updateTicket({
    ticketId: parseId(req.params.id),
    actor: req.user,
    patch: req.body,
  });
  return ok(res, ticket);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await deleteTicket({ ticketId: parseId(req.params.id), actor: req.user });
  return ok(res, { message: 'Ticket deleted.' });
}));

export default router;
