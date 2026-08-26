import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireManager } from '../middleware/auth.js';
import { validate, safeText, optionalText } from '../middleware/validate.js';
import { ok, created } from '../utils/http.js';
import { asyncHandler, badRequest } from '../utils/errors.js';
import { listProjects, getProject, createProject, updateProject } from '../services/projects.js';

const router = Router();
router.use(requireAuth);

const listQuery = z.object({
  includeArchived: z.enum(['true', 'false']).optional(),
});

/**
 * GET /api/projects
 * Readable by both roles — a team member needs the project list to label and filter
 * their own tasks. It exposes no task detail, only names, keys and counts.
 */
router.get('/', validate(listQuery, 'query'), asyncHandler(async (req, res) => {
  const includeArchived = req.validatedQuery.includeArchived === 'true';
  const projects = await listProjects({ includeArchived });
  return ok(res, projects, { total: projects.length });
}));

const parseId = (raw) => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid project id.');
  return id;
};

router.get('/:id', asyncHandler(async (req, res) => ok(res, await getProject(parseId(req.params.id)))));

const createSchema = z.object({
  name: safeText(120, 'Project name'),
  key: safeText(10, 'Project key'),
  description: optionalText(1000),
  leadId: z.coerce.number().int().positive().optional().nullable(),
});

/** Creating and changing projects is a manager responsibility. */
router.post('/', requireManager, validate(createSchema), asyncHandler(async (req, res) => {
  const project = await createProject(req.body);
  return created(res, { project, message: `Project ${project.project_key} created.` });
}));

const patchSchema = z.object({
  name: safeText(120, 'Project name').optional(),
  // Editable so typos can be fixed; existing task keys re-render under the new key.
  key: safeText(10, 'Project key').optional(),
  description: optionalText(1000),
  leadId: z.coerce.number().int().positive().optional().nullable(),
  isArchived: z.boolean().optional(),
});

router.patch('/:id', requireManager, validate(patchSchema), asyncHandler(async (req, res) => {
  const project = await updateProject(parseId(req.params.id), req.body);
  return ok(res, project);
}));

export default router;
