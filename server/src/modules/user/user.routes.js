import { Router } from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import * as preferenceController from './preference.controller.js';

const router = Router();

// Securely check session first
router.use(protect);

router.get('/me/preferences', preferenceController.getPreferences);
router.patch('/me/preferences', preferenceController.updatePreferences);

export default router;
