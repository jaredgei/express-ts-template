import crypto from 'crypto';

import { and, eq, gt, lt } from 'drizzle-orm';

import { sessions } from '../models/session';
import { db } from './database';

export const SESSION_COOKIE = 'sid';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: SESSION_TTL_MS,
};

const hashToken = (token: string): string => crypto.createHash('sha256').update(token).digest('hex');

export const createSession = async (userId: string): Promise<string> => {
  const token = crypto.randomBytes(32).toString('base64url');
  await db.insert(sessions).values({ userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + SESSION_TTL_MS) });
  return token;
};

export const getSessionUserId = async (token: string): Promise<string | null> => {
  const [session] = await db
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return session?.userId ?? null;
};

export const destroySession = async (token: string): Promise<void> => {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
};

export const deleteExpiredSessions = async (): Promise<void> => {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
};
