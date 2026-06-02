import {
  getUsersHandler,
  getUsersResponseSchema,
  registerHandler,
  registerBodySchema,
  authResponseSchema,
  loginHandler,
  loginBodySchema,
  refreshHandler,
  refreshResponseSchema,
  logoutHandler,
  logoutResponseSchema,
  getMeHandler,
  getMeResponseSchema,
} from '../handlers/user';
import { createRouter } from '../utils/route';
import { authenticate } from '../middleware/auth';

const router = createRouter();

// Public User Management endpoints
router.get('/', { response: getUsersResponseSchema, summary: 'Get all users' }, getUsersHandler);
router.post('/register', { body: registerBodySchema, response: authResponseSchema, status: 201, summary: 'Register a new user' }, registerHandler);
router.post('/login', { body: loginBodySchema, response: authResponseSchema, summary: 'Authenticate user and issue tokens' }, loginHandler);
router.post('/refresh', { response: refreshResponseSchema, summary: 'Issue a new access token using the HTTP-Only refresh cookie' }, refreshHandler);
router.post('/logout', { response: logoutResponseSchema, summary: 'Log out the user and clear secure refresh cookies' }, logoutHandler);

// Protected user profile endpoint
router.get('/me', { response: getMeResponseSchema, summary: 'Fetch authenticated user profile', security: true }, authenticate, getMeHandler);

export default router;
