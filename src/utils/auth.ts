import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export async function comparePassword(
  candidatePassword: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, hashedPassword);
}
