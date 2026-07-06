import { Router } from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import { requireProjectRole } from '../../middleware/projectAuth.middleware.js';
import * as rcaController from './rca.controller.js';

const router = Router({ mergeParams: true });

router.use(protect);

// Create RCA
router.post(
  '/',
  requireProjectRole(['MANAGER', 'MEMBER']),
  rcaController.create
);

// List RCAs
router.get(
  '/',
  requireProjectRole(['MANAGER', 'MEMBER', 'REVIEWER']),
  rcaController.list
);

// Export RCAs
router.get(
  '/export',
  requireProjectRole(['MANAGER', 'MEMBER', 'REVIEWER']),
  rcaController.exportCSV
);

// Get RCA details
router.get(
  '/:rcaId',
  requireProjectRole(['MANAGER', 'MEMBER', 'REVIEWER']),
  rcaController.get
);

// Patch DRAFT RCA
router.patch(
  '/:rcaId',
  requireProjectRole(['MANAGER', 'MEMBER']),
  rcaController.patch
);

// Upsert RCA Section
router.put(
  '/:rcaId/sections/:sectionType',
  requireProjectRole(['MANAGER', 'MEMBER']),
  rcaController.upsertSection
);

// Submit RCA
router.post(
  '/:rcaId/submit',
  requireProjectRole(['MANAGER', 'MEMBER']),
  rcaController.submit
);

// Reopen RCA
router.post(
  '/:rcaId/reopen',
  requireProjectRole(['MANAGER', 'MEMBER']),
  rcaController.reopen
);

// Close RCA
router.post(
  '/:rcaId/close',
  requireProjectRole(['MANAGER']),
  rcaController.close
);

export default router;
