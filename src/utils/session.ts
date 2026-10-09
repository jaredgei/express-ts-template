import crypto from 'crypto';

import { and, eq, gt, lt } from 'drizzle-orm';
import { CookieOptions, Request, Response } from 'express';

import { sessions } from '@/models/session';

import { db } from '@/utils/database';
import { isProduction } from '@/utils/env';

export const SESSION_COOKIE = isProduction ? '__Host-sid' : 'sid';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

const sessionCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  path: '/',
  maxAge: SESSION_TTL_MS,
};

export const sessionToken = (req: Request): string | undefined => {
  const token: unknown = req.cookies?.[SESSION_COOKIE];
  return typeof token === 'string' && token ? token : undefined;
};

export const setSessionCookie = (res: Response, token: string) => res.cookie(SESSION_COOKIE, token, sessionCookieOptions);

const hashToken = (token: string): string => crypto.createHash('sha256').update(token).digest('hex');

export const createSession = async (userId: string): Promise<string> => {
  const token = crypto.randomBytes(32).toString('base64url');
  await db.insert(sessions).values({ userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + SESSION_TTL_MS) });
  return token;
};

export const getSession = async (token: string) => {
  const now = Date.now();
  const tokenHash = hashToken(token);

  const [session] = await db
    .select({ userId: sessions.userId, expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date(now))))
    .limit(1);
  if (!session) return null;

  // Slide expiry only once past the halfway mark to avoid a write on every request.
  const renewed = session.expiresAt.getTime() - now < SESSION_TTL_MS / 2;
  if (renewed) {
    await db
      .update(sessions)
      .set({ expiresAt: new Date(now + SESSION_TTL_MS) })
      .where(eq(sessions.tokenHash, tokenHash));
  }

  return { userId: session.userId, renewed };
};

export const destroySession = async (token: string): Promise<void> => {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
};

export const startSession = async (req: Request, res: Response, userId: string) => {
  const previousToken = sessionToken(req);
  if (previousToken) await destroySession(previousToken);
  setSessionCookie(res, await createSession(userId));
};

export const endSession = async (req: Request, res: Response) => {
  const token = sessionToken(req);
  if (token) await destroySession(token);
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions);
};

export const deleteExpiredSessions = async (): Promise<void> => {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
};
