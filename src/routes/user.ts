import {
  getUsersHandler,
  getUsersResponseSchema,
  listUsersQuerySchema,
  registerHandler,
  registerBodySchema,
  userResponseSchema,
  loginHandler,
  loginBodySchema,
  logoutHandler,
  logoutResponseSchema,
  getMeHandler,
  errorResponseSchema,
} from '@/handlers/user';
import { authenticate } from '@/middleware/auth';
import { authRateLimiter } from '@/middleware/rateLimit';
import { createRouter } from '@/utils/route';

const router = createRouter();

router.get('/', { query: listUsersQuerySchema, response: getUsersResponseSchema, summary: 'List users' }, getUsersHandler);

router.post(
  '/register',
  {
    body: registerBodySchema,
    responses: {
      201: { schema: userResponseSchema },
      400: { description: 'Email already registered or invalid input', schema: errorResponseSchema },
      429: { description: 'Too many attempts', schema: errorResponseSchema },
    },
    summary: 'Register a new user',
  },
  authRateLimiter,
  registerHandler,
);

router.post(
  '/login',
  {
    body: loginBodySchema,
    responses: {
      200: { schema: userResponseSchema },
      401: { description: 'Invalid credentials', schema: errorResponseSchema },
      429: { description: 'Too many attempts', schema: errorResponseSchema },
    },
    summary: 'Authenticate user and start a session',
  },
  authRateLimiter,
  loginHandler,
);

router.post('/logout', { response: logoutResponseSchema, summary: 'Log out and destroy the session' }, logoutHandler);

router.get(
  '/me',
  {
    responses: {
      200: { schema: userResponseSchema },
      401: { description: 'Not authenticated', schema: errorResponseSchema },
    },
    summary: 'Fetch authenticated user profile',
    security: true,
  },
  authenticate,
  getMeHandler,
);

export default router;
