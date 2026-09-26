import { hash, verify } from '@node-rs/argon2';

export function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || Buffer.byteLength(password) > 1024) throw new Error('password must be 12 characters minimum and 1024 bytes maximum');
  return hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

export function verifyPassword(password: string, digest: string): Promise<boolean> {
  return verify(digest, password);
}
