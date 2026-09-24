/**
 * Ticket controller.
 *
 * Managers and admins see every ticket and may filter by reporter; team members are
 * pinned to their own id regardless of what they send. Who may change what on an
 * existing ticket is decided in the model.
 */
import { ok, created } from '../utils/http.js';
import { asyncHandler, badRequest, forbidden, notFound } from '../utils/errors.js';
import { canAccessTickets, isManagerLevel, isTeamMember } from '../utils/roles.js';
import { departmentScope, isEmptyScope, scopedDepartment, withinScope } from '../utils/scope.js';
import {
  listTickets, getTicketById, createTicket, updateTicketStatus, updateTicket, deleteTicket,
  assignTicket, ticketCounts,
} from '../models/ticket.js';

const parseId = (raw) => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid ticket id.');
  return id;
};

const ensureTicketAccess = (user) => {
  if (!canAccessTickets(user)) throw forbidden('The ticket system is available only to Technology & AI and Management teams.');
};

export const list = asyncHandler(async (req, res) => {
  ensureTicketAccess(req.user);
  const q = req.validatedQuery;

  if (!isManagerLevel(req.user.role)) {
    const department = req.user.department || undefined;
    const filter = {
      ...q,
      department: department || undefined,
      reporterId: q.reporterId,
      assigneeId: q.assigneeId,
    };
    if (!department) {
      filter.reporterId = req.user.id;
    }
    const { items, total } = await listTickets(filter);
    const counts = await ticketCounts({
      department,
      reporterId: filter.reporterId,
      assigneeId: filter.assigneeId,
    });
    return ok(res, items, { total, counts, limit: q.limit, offset: q.offset });
  }

  // A ticket belongs to the department of whoever raised it, so the same confinement
  // that governs the roster governs the bug queue.
  const scope = departmentScope(req.user);
  if (isEmptyScope(scope)) {
    return ok(res, [], {
      total: 0,
      counts: { total: 0, open: 0, in_progress: 0, resolved: 0, closed: 0, critical_open: 0, unresolved: 0 },
      limit: q.limit,
      offset: q.offset,
    });
  }

  const department = scopedDepartment(scope, q.department);
  const { items, total } = await listTickets({ ...q, department });
  const counts = await ticketCounts({ department, assigneeId: q.assigneeId, reporterId: q.reporterId });
  return ok(res, items, { total, counts, limit: q.limit, offset: q.offset });
});

export const getOne = asyncHandler(async (req, res) => {
  ensureTicketAccess(req.user);
  const ticket = await getTicketById(parseId(req.params.id));
  if (!ticket) throw notFound('That ticket no longer exists.');
  // Same wording as a missing ticket: whether an id exists in another department is
  // not something a manager should be able to establish.
  if (isManagerLevel(req.user.role)
      && !withinScope(departmentScope(req.user), ticket.reporter_department)) {
    throw notFound('That ticket no longer exists.');
  }
  if (isTeamMember(req.user.role)) {
    const sameDept = req.user.department && ticket.reporter_department === req.user.department;
    const isParticipant = ticket.reporter_id === req.user.id || ticket.assignee_id === req.user.id;
    if (!sameDept && !isParticipant) {
      throw forbidden('You can only view tickets in your department.');
    }
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
  ensureTicketAccess(req.user);
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
  ensureTicketAccess(req.user);
  const ticket = await updateTicketStatus({
    ticketId: parseId(req.params.id),
    status: req.body.status,
    resolutionNote: req.body.resolutionNote,
    actor: req.user,
  });
  return ok(res, ticket);
});

export const update = asyncHandler(async (req, res) => {
  ensureTicketAccess(req.user);
  const ticket = await updateTicket({
    ticketId: parseId(req.params.id),
    actor: req.user,
    patch: req.body,
  });
  return ok(res, ticket);
});

export const assign = asyncHandler(async (req, res) => {
  ensureTicketAccess(req.user);
  if (isTeamMember(req.user.role)) {
    throw forbidden('Only managers and admins can assign tickets.');
  }
  const ticketId = parseId(req.params.id);
  const ticket = await getTicketById(ticketId);
  if (!ticket) throw notFound('That ticket no longer exists.');

  const scope = departmentScope(req.user);
  if (!withinScope(scope, ticket.reporter_department)) {
    throw forbidden('You can only assign tickets within your department.');
  }

  const updatedTicket = await assignTicket({
    ticketId,
    assigneeId: req.body.assigneeId ?? null,
    actor: req.user,
  });

  return ok(res, updatedTicket);
});

export const remove = asyncHandler(async (req, res) => {
  ensureTicketAccess(req.user);
  await deleteTicket({ ticketId: parseId(req.params.id), actor: req.user });
  return ok(res, { message: 'Ticket deleted.' });
});
