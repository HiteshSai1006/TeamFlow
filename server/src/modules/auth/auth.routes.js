import { Router } from 'express';
import { register, login, logout, me } from './auth.controller.js';
import { protect } from '../../middleware/auth.middleware.js';

const router = Router();

// Authentication Router paths
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout); // Idempotent public logout
router.get('/me', protect, me); // Protected user profile check

export default router;
