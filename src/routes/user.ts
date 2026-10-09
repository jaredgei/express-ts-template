import {
  getMeHandler,
  listSessionsHandler,
  listSessionsQuerySchema,
  listSessionsResponseSchema,
  loginBodySchema,
  loginHandler,
  logoutHandler,
  logoutResponseSchema,
  registerBodySchema,
  registerHandler,
  userResponseSchema,
} from '@/handlers/user';

import { loginEmailRateLimiter, loginIpRateLimiter, registerRateLimiter } from '@/middleware/rateLimit';

import { createRouter, errorResponseSchema } from '@/utils/route';

const router = createRouter();

router.post(
  '/register',
  {
    body: registerBodySchema,
    status: 201,
    response: userResponseSchema,
    responses: {
      409: { description: 'Email already registered', schema: errorResponseSchema },
      429: { description: 'Too many attempts', schema: errorResponseSchema },
    },
    summary: 'Register a new user',
  },
  registerRateLimiter,
  registerHandler,
);

router.post(
  '/login',
  {
    body: loginBodySchema,
    response: userResponseSchema,
    responses: {
      401: { description: 'Invalid credentials', schema: errorResponseSchema },
      429: { description: 'Too many attempts', schema: errorResponseSchema },
    },
    summary: 'Authenticate user and start a session',
  },
  loginIpRateLimiter,
  loginEmailRateLimiter,
  loginHandler,
);

router.post('/logout', { response: logoutResponseSchema, summary: 'Log out and destroy the session' }, logoutHandler);

router.get('/me', { response: userResponseSchema, summary: 'Fetch authenticated user profile', security: true }, getMeHandler);

router.get(
  '/me/sessions',
  { query: listSessionsQuerySchema, response: listSessionsResponseSchema, summary: "List the authenticated user's active sessions", security: true },
  listSessionsHandler,
);

export default router;
