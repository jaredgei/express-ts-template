import crypto from 'crypto';
import { promisify } from 'util';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET as string;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string;

if (!process.env.JWT_ACCESS_SECRET) throw new Error('JWT_ACCESS_SECRET is not defined in environment variables');
if (!process.env.JWT_REFRESH_SECRET) throw new Error('JWT_REFRESH_SECRET is not defined in environment variables');

const pbkdf2Async = promisify(crypto.pbkdf2);

export type TokenPayload = {
  userId: string;
  email: string;
};

/**
 * Signs a JWT token utilizing HMAC SHA256 (HS256) via Node's native crypto module.
 */
export function signJwt(payload: TokenPayload, isRefresh = false): string {
  const secret = isRefresh ? REFRESH_SECRET : ACCESS_SECRET;
  const expiresInSeconds = isRefresh ? 60 * 60 * 24 * 7 : 60 * 15; // 7 days vs 15 mins

  const header = { alg: 'HS256', typ: 'JWT' };
  const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');

  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload = { ...payload, exp };
  const base64Payload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');

  const signatureInput = `${base64Header}.${base64Payload}`;
  const signature = crypto.createHmac('sha256', secret).update(signatureInput).digest('base64url');

  return `${signatureInput}.${signature}`;
}

/**
 * Verifies a JWT token utilizing HMAC SHA256 signature checks.
 */
export function verifyJwt(token: string, isRefresh = false): TokenPayload | null {
  try {
    const secret = isRefresh ? REFRESH_SECRET : ACCESS_SECRET;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;
    const signatureInput = `${header}.${payload}`;
    const expectedSignature = crypto.createHmac('sha256', secret).update(signatureInput).digest('base64url');

    // Constant-time comparison to prevent timing attacks
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null;

    const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (decodedPayload.exp && Date.now() / 1000 > decodedPayload.exp) return null; // Check expiration

    return {
      userId: decodedPayload.userId,
      email: decodedPayload.email,
    };
  } catch {
    return null;
  }
}

/**
 * Hashes a password utilizing PBKDF2 with SHA512 for optimal security.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await pbkdf2Async(password, salt, 100000, 64, 'sha512');
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verifies a password hash utilizing timingSafeEqual for protection against timing attacks.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, key] = hash.split(':');
  if (!salt || !key) return false;
  try {
    const derivedKey = await pbkdf2Async(password, salt, 100000, 64, 'sha512');
    return crypto.timingSafeEqual(derivedKey, Buffer.from(key, 'hex'));
  } catch {
    return false;
  }
}
