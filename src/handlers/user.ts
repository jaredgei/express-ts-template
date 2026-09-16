import { eq } from 'drizzle-orm';
import { Request, Response } from 'express';
import { z } from 'zod';

import { users, publicUserColumns, selectUserSchema } from '@/models/user';
import { hashPassword, verifyPassword, dummyPasswordHash } from '@/utils/auth';
import { db } from '@/utils/database';
import { SESSION_COOKIE, sessionCookieOptions, createSession, destroySession } from '@/utils/session';

export const registerBodySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const loginBodySchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const listUsersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const userResponseSchema = z.object({ user: selectUserSchema });

export const logoutResponseSchema = z.object({ success: z.boolean() });

export const getUsersResponseSchema = z.object({ users: z.array(selectUserSchema) });

export const errorResponseSchema = z.object({ errors: z.array(z.string()) });

const startSession = async (res: Response, userId: string) => {
  res.cookie(SESSION_COOKIE, await createSession(userId), sessionCookieOptions);
};

export const getUsersHandler = async (req: Request<unknown, unknown, unknown, z.infer<typeof listUsersQuerySchema>>, res: Response) => {
  const { limit, offset } = req.query;
  res.json({ users: await db.select(publicUserColumns).from(users).limit(limit).offset(offset) });
};

export const registerHandler = async (req: Request<unknown, unknown, z.infer<typeof registerBodySchema>>, res: Response) => {
  const { name, email, password } = req.body;

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    await verifyPassword(password, await dummyPasswordHash());
    return res.status(400).json({ errors: ['Email is already registered'] });
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(users).values({ name, email, passwordHash }).returning(publicUserColumns);

  await startSession(res, user.id);
  res.status(201).json({ user });
};

export const loginHandler = async (req: Request<unknown, unknown, z.infer<typeof loginBodySchema>>, res: Response) => {
  const { email, password } = req.body;

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    await verifyPassword(password, await dummyPasswordHash());
    return res.status(401).json({ errors: ['Invalid email or password'] });
  }
  if (!(await verifyPassword(password, user.passwordHash))) return res.status(401).json({ errors: ['Invalid email or password'] });

  const { passwordHash: _, ...safeUser } = user;
  await startSession(res, safeUser.id);
  res.json({ user: safeUser });
};

export const logoutHandler = async (req: Request, res: Response) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) await destroySession(token);
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions);
  res.json({ success: true });
};

export const getMeHandler = async (req: Request, res: Response) => {
  if (!req.userId) return res.status(401).json({ errors: ['Unauthorized'] });
  const [user] = await db.select(publicUserColumns).from(users).where(eq(users.id, req.userId)).limit(1);
  if (!user) return res.status(404).json({ errors: ['User not found'] });
  res.json({ user });
};
