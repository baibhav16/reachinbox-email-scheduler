import { createDecipheriv, createHash } from 'node:crypto';
const key = () => createHash('sha256').update(process.env.SMTP_ENCRYPTION_KEY || process.env.JWT_SECRET || '').digest();
export function decryptSecret(value: string) {
  const [iv, tag, content] = value.split('.');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(content, 'base64')), decipher.final()]).toString('utf8');
}
