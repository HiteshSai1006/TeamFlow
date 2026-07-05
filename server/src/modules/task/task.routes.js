import { Router } from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import { requireProjectRole } from '../../middleware/projectAuth.middleware.js';
import * as taskValidation from './task.validation.js';
import * as taskController from './task.controller.js';

// Use mergeParams so req.params.projectId is accessible inside task endpoints
const router = Router({ mergeParams: true });

// All routes require authentication and project membership
router.use(protect);
router.use(requireProjectRole(['MANAGER', 'MEMBER', 'REVIEWER']));

router.post('/', taskValidation.validateCreateTask, taskController.create);
router.get('/', taskController.list);
router.get('/:taskId', taskController.get);
router.patch('/:taskId', taskValidation.validateUpdateTask, taskController.update);

export default router;
