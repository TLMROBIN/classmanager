import bcrypt from "bcryptjs";

export function verifyPassword(plainText: string, passwordHash: string) {
  return bcrypt.compareSync(plainText, passwordHash);
}

export function hashPassword(plainText: string) {
  return bcrypt.hashSync(plainText, 10);
}
