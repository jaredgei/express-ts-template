import { eq } from 'drizzle-orm';
import { Request, Response } from 'express';
import { z } from 'zod';

import { users, publicUserColumns, selectUserSchema } from '../models/user';
import { AuthenticatedRequest } from '../middleware/auth';
import { hashPassword, verifyPassword } from '../utils/auth';
import { db } from '../utils/database';
import { SESSION_COOKIE, sessionCookieOptions, createSession, destroySession } from '../utils/session';

export const registerBodySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const loginBodySchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const userResponseSchema = z.object({ user: selectUserSchema });

export const logoutResponseSchema = z.object({ success: z.boolean() });

export const getUsersResponseSchema = z.object({ users: z.array(selectUserSchema) });

const startSession = async (res: Response, userId: string) => {
  res.cookie(SESSION_COOKIE, await createSession(userId), sessionCookieOptions);
};

export const getUsersHandler = async (_req: Request, res: Response) =>
  res.status(200).json({ users: await db.select(publicUserColumns).from(users) });

export const registerHandler = async (req: Request, res: Response) => {
  const { name, email, password } = req.body;

  const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existingUser) return res.status(400).json({ errors: 'Email is already registered' });

  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(users).values({ name, email, passwordHash }).returning(publicUserColumns);

  await startSession(res, user.id);
  res.status(201).json({ user });
};

export const loginHandler = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !(await verifyPassword(password, user.passwordHash))) return res.status(401).json({ errors: 'Invalid email or password' });

  const { passwordHash: _, ...safeUser } = user;
  await startSession(res, safeUser.id);
  res.status(200).json({ user: safeUser });
};

export const logoutHandler = async (req: Request, res: Response) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) await destroySession(token);
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions);
  res.status(200).json({ success: true });
};

export const getMeHandler = async (req: AuthenticatedRequest, res: Response) => {
  const [user] = await db.select(publicUserColumns).from(users).where(eq(users.id, req.userId)).limit(1);
  if (!user) return res.status(404).json({ errors: 'User not found' });
  res.status(200).json({ user });
};
