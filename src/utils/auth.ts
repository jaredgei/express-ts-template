import argon2 from 'argon2';

const ARGON2_OPTIONS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (password: string): Promise<string> => argon2.hash(password, ARGON2_OPTIONS);

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
};

let cachedDummyHash: Promise<string> | undefined;

// Verified against unknown emails so auth timing does not reveal whether an account exists.
export const dummyPasswordHash = (): Promise<string> => (cachedDummyHash ??= hashPassword('invalid-password-placeholder'));
