import { Router } from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import { requireProjectRole } from '../../middleware/projectAuth.middleware.js';
import * as controller from './report.controller.js';

const router = Router({ mergeParams: true });

router.use(protect);
router.use(requireProjectRole(['MANAGER', 'MEMBER', 'REVIEWER']));

router.get('/summary', controller.getSummary);

export default router;
