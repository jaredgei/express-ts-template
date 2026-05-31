import { Request, Response } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../utils/database';
import { users, selectUserSchema } from '../models/user';
import { hashPassword, verifyPassword, signJwt, verifyJwt } from '../utils/auth';
import { AuthenticatedRequest } from '../middleware/auth';

// Cookie Options for standard JWT Refresh Tokens
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
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
export const getUsersHandler = async (_request: Request, response: Response) => {
  const allUsers = await db.select().from(users);
  response.status(200).json({ users: allUsers });
};

// POST /api/users/register
export const registerHandler = async (request: Request, response: Response) => {
  const { name, email, password } = request.body;

  // Check if email already exists
  const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existingUser) return response.status(400).json({ errors: 'Email is already registered' });

  // Hash password & save user
  const passwordHash = await hashPassword(password);
  const [newUser] = await db.insert(users).values({ name, email, passwordHash }).returning();

  // Generate tokens
  const payload = { userId: newUser.id, email: newUser.email };
  const accessToken = signJwt(payload, false);
  const refreshToken = signJwt(payload, true);

  // Set the HTTP-Only cookie for refresh token
  response.cookie('refreshToken', refreshToken, cookieOptions);

  // Strip passwordHash before response
  const { passwordHash: _, ...publicUser } = newUser;

  response.status(201).json({
    user: publicUser,
    accessToken,
  });
};

// POST /api/users/login
export const loginHandler = async (request: Request, response: Response) => {
  const { email, password } = request.body;

  // Retrieve user
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!user) return response.status(401).json({ errors: 'Invalid email or password' });

  // Verify password
  const isValidPassword = await verifyPassword(password, user.passwordHash);
  if (!isValidPassword) return response.status(401).json({ errors: 'Invalid email or password' });

  // Generate tokens
  const payload = { userId: user.id, email: user.email };
  const accessToken = signJwt(payload, false);
  const refreshToken = signJwt(payload, true);

  // Set the HTTP-Only cookie for refresh token
  response.cookie('refreshToken', refreshToken, cookieOptions);

  // Strip passwordHash before response
  const { passwordHash: _, ...publicUser } = user;

  response.status(200).json({
    user: publicUser,
    accessToken,
  });
};

// POST /api/users/refresh
export const refreshHandler = async (request: Request, response: Response) => {
  // Read token from secure cookies
  const refreshToken = request.cookies?.refreshToken;
  if (!refreshToken) return response.status(401).json({ errors: 'Refresh token not found in cookies' });
  const payload = verifyJwt(refreshToken, true);
  if (!payload) return response.status(401).json({ errors: 'Invalid or expired refresh token' });

  // Issue new access token
  const newAccessToken = signJwt({ userId: payload.userId, email: payload.email }, false);

  response.status(200).json({ accessToken: newAccessToken });
};

// POST /api/users/logout
export const logoutHandler = async (_request: Request, response: Response) => {
  // Clear the secure cookie
  response.clearCookie('refreshToken', {
    httpOnly: cookieOptions.httpOnly,
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite,
  });

  response.status(200).json({
    success: true,
  });
};

// GET /api/users/me (Authenticated profile fetch)
export const getMeHandler = async (request: AuthenticatedRequest, response: Response) => {
  if (!request.user) return response.status(401).json({ errors: 'Unauthorized' });
  const [user] = await db.select().from(users).where(eq(users.id, request.user.userId)).limit(1);
  if (!user) return response.status(404).json({ errors: 'User not found' });
  const { passwordHash: _, ...publicUser } = user;
  response.status(200).json({ user: publicUser });
};
