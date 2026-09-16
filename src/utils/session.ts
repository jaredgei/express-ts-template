import crypto from 'crypto';

import { and, eq, gt, lt } from 'drizzle-orm';

import { sessions } from '@/models/session';
import { db } from '@/utils/database';
import { isProduction } from '@/utils/env';

export const SESSION_COOKIE = 'sid';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export const sessionCookieOptions = {
  httpOnly: true,
  secure: isProduction,
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
  const now = Date.now();
  const tokenHash = hashToken(token);

  const [session] = await db
    .select({ userId: sessions.userId, expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date(now))))
    .limit(1);
  if (!session) return null;

  // Slide expiry only once past the halfway mark to avoid a write on every request.
  if (session.expiresAt.getTime() - now < SESSION_TTL_MS / 2) {
    await db
      .update(sessions)
      .set({ expiresAt: new Date(now + SESSION_TTL_MS) })
      .where(eq(sessions.tokenHash, tokenHash));
  }

  return session.userId;
};

export const destroySession = async (token: string): Promise<void> => {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
};

export const deleteExpiredSessions = async (): Promise<void> => {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
};
