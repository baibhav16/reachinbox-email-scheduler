import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { env } from '../config/env.js';
const key = () => createHash('sha256').update(env.SMTP_ENCRYPTION_KEY || env.JWT_SECRET).digest();
export function encryptSecret(value: string) {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const content = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${content.toString('base64')}`;
}
export function decryptSecret(value: string) {
  const [iv, tag, content] = value.split('.');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(content, 'base64')), decipher.final()]).toString('utf8');
}
