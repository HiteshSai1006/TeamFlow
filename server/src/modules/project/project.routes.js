import { Router } from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import { requireProjectRole } from '../../middleware/projectAuth.middleware.js';
import * as projectValidation from './project.validation.js';
import * as projectController from './project.controller.js';
import * as preferenceController from './preference.controller.js';

const router = Router();

// All project routes require authentication
router.use(protect);

// Global projects endpoints
router.post('/', projectValidation.validateCreateProject, projectController.create);
router.get('/', projectController.list);

// Specific project endpoints (membership authorized)
router.get('/:projectId', requireProjectRole(['MANAGER', 'MEMBER', 'REVIEWER']), projectController.get);
router.patch('/:projectId', requireProjectRole(['MANAGER']), projectController.update);

// Project task view preference endpoints
router.get('/:projectId/view-preference', requireProjectRole(['MANAGER', 'MEMBER', 'REVIEWER']), preferenceController.getPreference);
router.patch('/:projectId/view-preference', requireProjectRole(['MANAGER', 'MEMBER', 'REVIEWER']), preferenceController.updatePreference);

// Lifecycle actions
router.post('/:projectId/archive', requireProjectRole(['MANAGER']), projectController.archive);
router.post('/:projectId/restore', requireProjectRole(['MANAGER']), projectController.restore);

// Membership routes
router.get('/:projectId/members', requireProjectRole(['MANAGER', 'MEMBER', 'REVIEWER']), projectController.listMembers);
router.post('/:projectId/members', requireProjectRole(['MANAGER']), projectValidation.validateInviteMember, projectController.inviteMember);
router.patch('/:projectId/members/:memberId', requireProjectRole(['MANAGER']), projectController.updateMemberRole);
router.delete('/:projectId/members/:memberId', requireProjectRole(['MANAGER']), projectController.removeMember);

export default router;
