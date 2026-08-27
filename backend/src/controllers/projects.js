/**
 * Project controller.
 *
 * Reads are open to both roles — a team member needs the project list to label and
 * filter their own tasks, and it exposes no task detail. Writes are manager-level,
 * enforced by `requireManager` on the route.
 */
import { ok, created } from '../utils/http.js';
import { asyncHandler, badRequest } from '../utils/errors.js';
import { listProjects, getProject, createProject, updateProject } from '../models/project.js';

const parseId = (raw) => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid project id.');
  return id;
};

export const list = asyncHandler(async (req, res) => {
  const includeArchived = req.validatedQuery.includeArchived === 'true';
  const projects = await listProjects({ includeArchived });
  return ok(res, projects, { total: projects.length });
});

export const getOne = asyncHandler(async (req, res) =>
  ok(res, await getProject(parseId(req.params.id))));

export const create = asyncHandler(async (req, res) => {
  const project = await createProject(req.body);
  return created(res, { project, message: `Project ${project.project_key} created.` });
});

export const update = asyncHandler(async (req, res) => {
  const project = await updateProject(parseId(req.params.id), req.body);
  return ok(res, project);
});
