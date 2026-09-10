import {
  getUsersHandler,
  getUsersResponseSchema,
  registerHandler,
  registerBodySchema,
  userResponseSchema,
  loginHandler,
  loginBodySchema,
  logoutHandler,
  logoutResponseSchema,
  getMeHandler,
} from '../handlers/user';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rateLimit';
import { createRouter } from '../utils/route';

const router = createRouter();

router.get('/', { response: getUsersResponseSchema, summary: 'Get all users' }, getUsersHandler);
router.post(
  '/register',
  { body: registerBodySchema, response: userResponseSchema, status: 201, summary: 'Register a new user' },
  authRateLimiter,
  registerHandler,
);
router.post(
  '/login',
  { body: loginBodySchema, response: userResponseSchema, summary: 'Authenticate user and start a session' },
  authRateLimiter,
  loginHandler,
);
router.post('/logout', { response: logoutResponseSchema, summary: 'Log out and destroy the session' }, logoutHandler);
router.get<AuthenticatedRequest>(
  '/me',
  { response: userResponseSchema, summary: 'Fetch authenticated user profile', security: true },
  authenticate,
  getMeHandler,
);

export default router;
