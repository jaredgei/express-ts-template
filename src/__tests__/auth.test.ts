import { describe, it, expect } from 'vitest';
import { signJwt, verifyJwt, hashPassword, verifyPassword, TokenPayload } from '../utils/auth';

const payload: TokenPayload = { userId: 'user-123', email: 'test@example.com' };

describe('JWT', () => {
  it('signs and verifies an access token', () => {
    const token = signJwt(payload);
    const result = verifyJwt(token);
    expect(result).toEqual(payload);
  });

  it('signs and verifies a refresh token', () => {
    const token = signJwt(payload, true);
    const result = verifyJwt(token, true);
    expect(result).toEqual(payload);
  });

  it('rejects an access token verified as refresh', () => {
    const token = signJwt(payload, false);
    expect(verifyJwt(token, true)).toBeNull();
  });

  it('rejects a tampered token', () => {
    const token = signJwt(payload);
    expect(verifyJwt(token + 'x')).toBeNull();
  });

  it('rejects malformed tokens', () => {
    expect(verifyJwt('')).toBeNull();
    expect(verifyJwt('a.b')).toBeNull();
    expect(verifyJwt('not-a-jwt')).toBeNull();
  });
});

describe('Password Hashing', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('mypassword');
    expect(await verifyPassword('mypassword', hash)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('mypassword');
    expect(await verifyPassword('wrongpassword', hash)).toBe(false);
  });

  it('produces unique hashes (different salts)', async () => {
    const [a, b] = await Promise.all([hashPassword('same'), hashPassword('same')]);
    expect(a).not.toBe(b);
  });

  it('rejects malformed hashes', async () => {
    expect(await verifyPassword('anything', '')).toBe(false);
    expect(await verifyPassword('anything', 'noseparator')).toBe(false);
  });
});
