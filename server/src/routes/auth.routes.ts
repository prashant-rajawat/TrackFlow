import { Router } from 'express';
import { register, login, getMe, logout } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireDatabase } from '../middleware/db.middleware.js';
import { loginRateLimiter, registerRateLimiter } from '../middleware/rateLimit.middleware.js';

const router = Router();

router.use(requireDatabase);

router.post('/register', registerRateLimiter, register);
router.post('/login', loginRateLimiter, login);
router.get('/me', requireAuth, getMe);
router.post('/logout', logout);

export default router;
