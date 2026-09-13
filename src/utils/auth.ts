import argon2 from 'argon2';

export const hashPassword = (password: string): Promise<string> => argon2.hash(password, { type: argon2.argon2id });

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
};

// Verified against unknown emails so login timing does not reveal whether an account exists.
export const dummyPasswordHash = argon2.hash('invalid-password-placeholder', { type: argon2.argon2id });
