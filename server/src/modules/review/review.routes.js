import { Router } from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import * as reviewController from './review.controller.js';

const router = Router();

router.use(protect);

router.get('/my-pending', reviewController.myPending);
router.post('/:reviewId/decision', reviewController.decide);

export default router;
