import { Router } from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import { requireProjectRole } from '../../middleware/projectAuth.middleware.js';
import * as commentController from './comment.controller.js';

const router = Router({ mergeParams: true });

router.use(protect);
router.use(requireProjectRole(['MANAGER', 'MEMBER', 'REVIEWER']));

router.post('/', commentController.create);
router.get('/', commentController.list);
router.patch('/:commentId', commentController.update);
router.delete('/:commentId', commentController.remove);

export default router;
