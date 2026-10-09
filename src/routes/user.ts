import { and, asc, eq, gt, sql } from 'drizzle-orm';
import { z } from 'zod';

import { publicSessionColumns, selectSessionSchema, sessions } from '@/models/session';
import { publicUserColumns, selectUserSchema, users } from '@/models/user';

import { HttpError } from '@/middleware/error';
import { loginEmailRateLimiter, loginIpRateLimiter, registerRateLimiter } from '@/middleware/rateLimit';

import { dummyPasswordHash, hashPassword, verifyPassword } from '@/utils/auth';
import { db } from '@/utils/database';
import { createRouter } from '@/utils/route';
import { endSession, startSession } from '@/utils/session';

const email = z.string().trim().toLowerCase().max(255).check(z.email('Invalid email address'));
const password = z.string().max(256);
const userResponse = z.object({ user: selectUserSchema });

const router = createRouter('/api/users');

router.post(
  '/register',
  {
    summary: 'Register a new user',
    body: z.object({
      name: z.string().trim().min(1, 'Name is required').max(255),
      email,
      password: password.min(8, 'Password must be at least 8 characters'),
    }),
    response: userResponse,
    status: 201,
    errors: { 409: 'Email already registered', 429: 'Too many attempts' },
    use: [registerRateLimiter],
  },
  async (req, res) => {
    const { password, ...fields } = req.body;
    const [user] = await db
      .insert(users)
      .values({ ...fields, passwordHash: await hashPassword(password) })
      .returning(publicUserColumns);
    if (!user) throw new Error('Insert returned no row');
    await startSession(req, res, user.id);
    return { user };
  },
);

router.post(
  '/login',
  {
    summary: 'Authenticate user and start a session',
    body: z.object({ email, password: password.min(1, 'Password is required') }),
    response: userResponse,
    errors: { 401: 'Invalid credentials', 429: 'Too many attempts' },
    use: [loginIpRateLimiter, loginEmailRateLimiter],
  },
  async (req, res) => {
    const [match] = await db
      .select({ user: publicUserColumns, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(sql`lower(${users.email})`, req.body.email))
      .limit(1);
    const valid = await verifyPassword(req.body.password, match?.passwordHash ?? (await dummyPasswordHash()));
    if (!match || !valid) throw new HttpError(401, 'Invalid email or password');

    await startSession(req, res, match.user.id);
    return { user: match.user };
  },
);

router.post('/logout', { summary: 'Log out and destroy the session' }, endSession);

router.get(
  '/me',
  { summary: 'Fetch authenticated user profile', security: true, response: userResponse, errors: { 404: 'User not found' } },
  async (req) => {
    const [user] = await db.select(publicUserColumns).from(users).where(eq(users.id, req.userId)).limit(1);
    if (!user) throw new HttpError(404, 'User not found');
    return { user };
  },
);

router.get(
  '/me/sessions',
  {
    summary: "List the authenticated user's active sessions",
    security: true,
    query: z.object({ limit: z.coerce.number().int().min(1).max(100).default(20), offset: z.coerce.number().int().min(0).default(0) }),
    response: z.object({ sessions: z.array(selectSessionSchema) }),
  },
  async (req) => ({
    sessions: await db
      .select(publicSessionColumns)
      .from(sessions)
      .where(and(eq(sessions.userId, req.userId), gt(sessions.expiresAt, new Date())))
      .orderBy(asc(sessions.createdAt), asc(sessions.id))
      .limit(req.query.limit)
      .offset(req.query.offset),
  }),
);

export default router;
