/**
 * Ticket controller.
 *
 * Managers and admins see every ticket and may filter by reporter; team members are
 * pinned to their own id regardless of what they send. Who may change what on an
 * existing ticket is decided in the model.
 */
import { ok, created } from '../utils/http.js';
import { asyncHandler, badRequest, forbidden, notFound } from '../utils/errors.js';
import { isManagerLevel, isTeamMember } from '../utils/roles.js';
import {
  listTickets, getTicketById, createTicket, updateTicketStatus, updateTicket, deleteTicket,
  ticketCounts,
} from '../models/ticket.js';

const parseId = (raw) => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid ticket id.');
  return id;
};

export const list = asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const filters = isManagerLevel(req.user.role)
    ? { ...q }
    : { ...q, reporterId: req.user.id };

  const { items, total } = await listTickets(filters);
  const counts = await ticketCounts(
    isManagerLevel(req.user.role) ? {} : { reporterId: req.user.id },
  );
  return ok(res, items, { total, counts, limit: q.limit, offset: q.offset });
});

export const getOne = asyncHandler(async (req, res) => {
  const ticket = await getTicketById(parseId(req.params.id));
  if (!ticket) throw notFound('That ticket no longer exists.');
  if (isTeamMember(req.user.role) && ticket.reporter_id !== req.user.id) {
    throw forbidden('You can only view tickets you raised.');
  }
  return ok(res, ticket);
});

/**
 * POST /api/tickets — team members only.
 *
 * Managers do not raise tickets here: a ticket is a report from the person doing the
 * work, and the model ties it to a task assigned to them.
 */
export const create = asyncHandler(async (req, res) => {
  if (!isTeamMember(req.user.role)) {
    throw forbidden('Tickets are raised by the team member working on the task.');
  }
  const ticket = await createTicket({ ...req.body, reporterId: req.user.id });
  return created(res, {
    ticket,
    message: `Ticket ${ticket.ticket_key} raised. Your manager has been notified.`,
  });
});

export const setStatus = asyncHandler(async (req, res) => {
  const ticket = await updateTicketStatus({
    ticketId: parseId(req.params.id),
    status: req.body.status,
    resolutionNote: req.body.resolutionNote,
    actor: req.user,
  });
  return ok(res, ticket);
});

export const update = asyncHandler(async (req, res) => {
  const ticket = await updateTicket({
    ticketId: parseId(req.params.id),
    actor: req.user,
    patch: req.body,
  });
  return ok(res, ticket);
});

export const remove = asyncHandler(async (req, res) => {
  await deleteTicket({ ticketId: parseId(req.params.id), actor: req.user });
  return ok(res, { message: 'Ticket deleted.' });
});
