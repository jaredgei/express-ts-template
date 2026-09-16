import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { sessions } from '@/models/session';
import { users } from '@/models/user';

import { client, db } from '@/utils/database';
import { createSession, deleteExpiredSessions, destroySession, getSessionUserId } from '@/utils/session';

const insertUser = async () => {
  const [user] = await db.insert(users).values({ name: 'Session User', email: 'session@example.com', passwordHash: 'x' }).returning({ id: users.id });
  return user.id;
};

beforeEach(async () => {
  await db.delete(users);
});

afterAll(async () => {
  await client.end();
});

describe('sessions', () => {
  it('creates a session and resolves its user', async () => {
    const userId = await insertUser();
    const token = await createSession(userId);
    expect(await getSessionUserId(token)).toBe(userId);
  });

  it('rejects unknown and destroyed tokens', async () => {
    const userId = await insertUser();
    const token = await createSession(userId);

    expect(await getSessionUserId('not-a-real-token')).toBeNull();

    await destroySession(token);
    expect(await getSessionUserId(token)).toBeNull();
  });

  it('does not resolve an expired session and deleteExpiredSessions removes it', async () => {
    const userId = await insertUser();
    const token = await createSession(userId);
    await db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(sessions.userId, userId));

    expect(await getSessionUserId(token)).toBeNull();

    await deleteExpiredSessions();
    expect(await db.select().from(sessions)).toHaveLength(0);
  });

  it('does not slide a fresh session on read', async () => {
    const userId = await insertUser();
    const token = await createSession(userId);
    const [before] = await db.select({ expiresAt: sessions.expiresAt }).from(sessions).where(eq(sessions.userId, userId));

    await getSessionUserId(token);

    const [after] = await db.select({ expiresAt: sessions.expiresAt }).from(sessions).where(eq(sessions.userId, userId));
    expect(after.expiresAt.getTime()).toBe(before.expiresAt.getTime());
  });

  it('slides a session once it is past the halfway mark', async () => {
    const userId = await insertUser();
    const token = await createSession(userId);
    const nearExpiry = new Date(Date.now() + 1000 * 60);
    await db.update(sessions).set({ expiresAt: nearExpiry }).where(eq(sessions.userId, userId));

    await getSessionUserId(token);

    const [after] = await db.select({ expiresAt: sessions.expiresAt }).from(sessions).where(eq(sessions.userId, userId));
    expect(after.expiresAt.getTime()).toBeGreaterThan(nearExpiry.getTime());
  });
});
