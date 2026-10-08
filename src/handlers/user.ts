import { asc, eq, sql } from 'drizzle-orm';
import { Request, Response } from 'express';
import { z } from 'zod';

import { publicUserColumns, selectUserSchema, users } from '@/models/user';

import { HttpError } from '@/middleware/error';

import { dummyPasswordHash, hashPassword, verifyPassword } from '@/utils/auth';
import { db } from '@/utils/database';
import { TypedRequest } from '@/utils/route';
import { createSession, destroySession, SESSION_COOKIE, sessionCookieOptions } from '@/utils/session';

const emailSchema = z
  .email('Invalid email address')
  .max(255)
  .transform((value) => value.trim().toLowerCase());

export const registerBodySchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: emailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters').max(256),
});

export const loginBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const listUsersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const userResponseSchema = z.object({ user: selectUserSchema });

export const logoutResponseSchema = z.object({ success: z.boolean() });

export const getUsersResponseSchema = z.object({ users: z.array(selectUserSchema) });

const startSession = async (req: Request, res: Response, userId: string) => {
  const previousToken = req.cookies?.[SESSION_COOKIE];
  if (previousToken) await destroySession(previousToken);
  res.cookie(SESSION_COOKIE, await createSession(userId), sessionCookieOptions);
};

export const getUsersHandler = async (req: TypedRequest<{ query: typeof listUsersQuerySchema; security: true }>, res: Response) => {
  const { limit, offset } = req.query;
  res.json({ users: await db.select(publicUserColumns).from(users).orderBy(asc(users.createdAt), asc(users.id)).limit(limit).offset(offset) });
};

export const registerHandler = async (req: TypedRequest<{ body: typeof registerBodySchema }>, res: Response) => {
  const { name, email, password } = req.body;

  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(users).values({ name, email, passwordHash }).returning(publicUserColumns);

  await startSession(req, res, user.id);
  res.status(201).json({ user });
};

export const loginHandler = async (req: TypedRequest<{ body: typeof loginBodySchema }>, res: Response) => {
  const { email, password } = req.body;

  const [match] = await db
    .select({ user: publicUserColumns, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(sql`lower(${users.email})`, email))
    .limit(1);
  const valid = await verifyPassword(password, match?.passwordHash ?? (await dummyPasswordHash()));
  if (!match || !valid) throw new HttpError(401, 'Invalid email or password');

  await startSession(req, res, match.user.id);
  res.json({ user: match.user });
};

export const logoutHandler = async (req: Request, res: Response) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) await destroySession(token);
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions);
  res.json({ success: true });
};

export const getMeHandler = async (req: TypedRequest<{ security: true }>, res: Response) => {
  const [user] = await db.select(publicUserColumns).from(users).where(eq(users.id, req.userId)).limit(1);
  if (!user) throw new HttpError(404, 'User not found');
  res.json({ user });
};
