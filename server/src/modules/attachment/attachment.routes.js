import { Router } from 'express';
import prisma from '../../config/db.js';
import { protect } from '../../middleware/auth.middleware.js';
import { requireProjectRole } from '../../middleware/projectAuth.middleware.js';
import { handleMulterUpload } from '../../middleware/upload.middleware.js';
import * as attachmentController from './attachment.controller.js';

const router = Router({ mergeParams: true });

// Scoping validation middleware
async function validateProjectTaskScope(req, res, next) {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const taskId = parseInt(req.params.taskId, 10);

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      const error = new Error('Project not found.');
      error.statusCode = 404;
      return next(error);
    }

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.projectId !== projectId) {
      const error = new Error('Task not found.');
      error.statusCode = 404;
      return next(error);
    }

    req.project = project;
    req.task = task;
    next();
  } catch (err) {
    next(err);
  }
}

// Project status check middleware
function rejectArchivedProject(req, res, next) {
  if (req.project && req.project.status === 'ARCHIVED') {
    const error = new Error('Cannot mutate attachments in an archived project.');
    error.statusCode = 400;
    return next(error);
  }
  next();
}

// All attachment operations must be authenticated
router.use(protect);

// Upload: Only MANAGER and MEMBER are allowed
router.post(
  '/',
  requireProjectRole(['MANAGER', 'MEMBER']),
  validateProjectTaskScope,
  rejectArchivedProject,
  handleMulterUpload,
  attachmentController.uploadFile
);

// List: MANAGER, MEMBER, and REVIEWER are allowed
router.get(
  '/',
  requireProjectRole(['MANAGER', 'MEMBER', 'REVIEWER']),
  validateProjectTaskScope,
  attachmentController.list
);

// Download: MANAGER, MEMBER, and REVIEWER are allowed
router.get(
  '/:attachmentId/download',
  requireProjectRole(['MANAGER', 'MEMBER', 'REVIEWER']),
  validateProjectTaskScope,
  attachmentController.download
);

// Delete: Authenticated project members (ownership verified inside the controller/service)
router.delete(
  '/:attachmentId',
  requireProjectRole(['MANAGER', 'MEMBER', 'REVIEWER']),
  validateProjectTaskScope,
  rejectArchivedProject,
  attachmentController.remove
);

export default router;
