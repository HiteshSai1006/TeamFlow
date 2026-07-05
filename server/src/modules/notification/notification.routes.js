import express from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import * as controller from './notification.controller.js';

const router = express.Router();

router.use(protect);

router.get('/', controller.list);
router.post('/read-all', controller.readAll);
router.post('/:id/read', controller.read);
router.get('/preferences', controller.getPref);
router.put('/preferences', controller.updatePref);

export default router;
