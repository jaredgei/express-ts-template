import { Request, Response } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../utils/database';
import { users, selectUserSchema, UserRow } from '../models/user';
import { hashPassword, verifyPassword, signJwt, verifyJwt } from '../utils/auth';
import { AuthenticatedRequest } from '../middleware/auth';

// Cookie Options for standard JWT Refresh Tokens
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
};
const { maxAge: _maxAge, ...clearCookieOptions } = cookieOptions;

// Helper to set refresh token cookie and return response
const sendAuthResponse = (res: Response, statusCode: number, { passwordHash: _, ...user }: UserRow, accessToken: string, refreshToken: string) => {
  res.cookie('refreshToken', refreshToken, cookieOptions);
  res.status(statusCode).json({ user, accessToken });
};

// --- SCHEMAS ---

// Registration
export const registerBodySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const authResponseSchema = z.object({
  user: selectUserSchema,
  accessToken: z.string(),
});

// Login
export const loginBodySchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Refresh (Reads from cookie, so request body can be empty)
export const refreshResponseSchema = z.object({
  accessToken: z.string(),
});

// Logout
export const logoutResponseSchema = z.object({
  success: z.boolean(),
});

// Profile (/me)
export const getMeResponseSchema = z.object({
  user: selectUserSchema,
});

// GET /api/users (Admin / List - Public or Protected)
export const getUsersResponseSchema = z.object({
  users: z.array(selectUserSchema),
});

// --- HANDLERS ---

// GET /api/users
export const getUsersHandler = async (_req: Request, res: Response) => res.status(200).json({ users: await db.select().from(users) });

// POST /api/users/register
export const registerHandler = async (request: Request, response: Response) => {
  const { name, email, password } = request.body;

  // Check if email already exists
  const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existingUser) return response.status(400).json({ errors: 'Email is already registered' });

  // Hash password & save user
  const passwordHash = await hashPassword(password);
  const [newUser] = await db.insert(users).values({ name, email, passwordHash }).returning();

  // Generate tokens & respond
  const payload = { userId: newUser.id, email: newUser.email };
  sendAuthResponse(response, 201, newUser, signJwt(payload), signJwt(payload, true));
};

// POST /api/users/login
export const loginHandler = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !(await verifyPassword(password, user.passwordHash))) return res.status(401).json({ errors: 'Invalid email or password' });

  const payload = { userId: user.id, email: user.email };
  sendAuthResponse(res, 200, user, signJwt(payload), signJwt(payload, true));
};

// POST /api/users/refresh
export const refreshHandler = async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken;
  const payload = token ? verifyJwt(token, true) : null;
  if (!payload) return res.status(401).json({ errors: token ? 'Invalid or expired refresh token' : 'Refresh token not found in cookies' });

  res.status(200).json({ accessToken: signJwt({ userId: payload.userId, email: payload.email }, false) });
};

// POST /api/users/logout
export const logoutHandler = async (_req: Request, res: Response) => {
  res.clearCookie('refreshToken', clearCookieOptions);
  res.status(200).json({ success: true });
};

// GET /api/users/me (Authenticated profile fetch)
export const getMeHandler = async (req: AuthenticatedRequest, res: Response) => {
  const [user] = await db.select().from(users).where(eq(users.id, req.user.userId)).limit(1);
  if (!user) return res.status(404).json({ errors: 'User not found' });
  res.status(200).json({ user });
};
