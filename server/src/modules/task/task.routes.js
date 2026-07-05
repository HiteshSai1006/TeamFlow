import { Router } from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import { requireProjectRole } from '../../middleware/projectAuth.middleware.js';
import * as taskValidation from './task.validation.js';
import * as taskController from './task.controller.js';

const router = Router({ mergeParams: true });

router.use(protect);
router.use(requireProjectRole(['MANAGER', 'MEMBER', 'REVIEWER']));

router.post('/', taskValidation.validateCreateTask, taskController.create);
router.get('/', taskController.list);
router.get('/:taskId', taskController.get);
router.patch('/:taskId', taskValidation.validateUpdateTask, taskController.update);

// Task dependencies endpoints
router.post('/:taskId/relations', taskController.addRelation);
router.delete('/:taskId/relations/:relationId', taskController.removeRelation);

export default router;
