import crypto from 'crypto';

import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { sessions } from '@/models/session';
import { users } from '@/models/user';

import { client, db } from '@/utils/database';
import { createSession, deleteExpiredSessions, destroySession, getSession } from '@/utils/session';

const insertUser = async () => {
  const [user] = await db
    .insert(users)
    .values({ name: 'Session User', email: `${crypto.randomUUID()}@example.com`, passwordHash: 'x' })
    .returning({ id: users.id });
  if (!user) throw new Error('User insert returned no row');
  return user.id;
};

afterAll(async () => {
  await client.end();
});

describe('sessions', () => {
  it('creates a session and resolves its user', async () => {
    const userId = await insertUser();
    const token = await createSession(userId);
    expect(await getSession(token)).toEqual({ userId, renewed: false });
  });

  it('rejects unknown and destroyed tokens', async () => {
    const userId = await insertUser();
    const token = await createSession(userId);

    expect(await getSession('not-a-real-token')).toBeNull();

    await destroySession(token);
    expect(await getSession(token)).toBeNull();
  });

  it('does not resolve an expired session and deleteExpiredSessions removes it', async () => {
    const userId = await insertUser();
    const token = await createSession(userId);
    await db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(sessions.userId, userId));

    expect(await getSession(token)).toBeNull();

    await deleteExpiredSessions();
    expect(await db.select().from(sessions).where(eq(sessions.userId, userId))).toHaveLength(0);
  });

  it('does not slide a fresh session on read', async () => {
    const userId = await insertUser();
    const token = await createSession(userId);
    const [before] = await db.select({ expiresAt: sessions.expiresAt }).from(sessions).where(eq(sessions.userId, userId));

    await getSession(token);

    const [after] = await db.select({ expiresAt: sessions.expiresAt }).from(sessions).where(eq(sessions.userId, userId));
    expect(before).toBeDefined();
    expect(after).toEqual(before);
  });

  it('slides a session once it is past the halfway mark', async () => {
    const userId = await insertUser();
    const token = await createSession(userId);
    const nearExpiry = new Date(Date.now() + 1000 * 60);
    const lastUpdate = new Date(Date.now() - 1000 * 60);
    await db.update(sessions).set({ expiresAt: nearExpiry, updatedAt: lastUpdate }).where(eq(sessions.userId, userId));

    expect(await getSession(token)).toEqual({ userId, renewed: true });

    const [after] = await db
      .select({ expiresAt: sessions.expiresAt, updatedAt: sessions.updatedAt })
      .from(sessions)
      .where(eq(sessions.userId, userId));
    expect(after?.expiresAt.getTime()).toBeGreaterThan(nearExpiry.getTime());
    expect(after?.updatedAt.getTime()).toBeGreaterThan(lastUpdate.getTime());
  });
});
