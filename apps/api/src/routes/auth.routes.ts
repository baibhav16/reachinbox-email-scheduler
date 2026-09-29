import { Router } from 'express';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { encryptSecret } from '../utils/crypto.js';
import { emailQueue } from '../queues/email.queue.js';
import { elastic } from '../config/elasticsearch.js';

export const authRoutes = Router();
authRoutes.get('/google', (req, res) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) { res.status(503).send('Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.'); return; }
  const state = jwt.sign({ purpose: 'google', nonce: crypto.randomUUID() }, env.JWT_SECRET, { expiresIn: '10m' });
  const target = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  target.search = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: env.GOOGLE_CALLBACK_URL, response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account' }).toString();
  res.cookie('google_oauth_state', state, { httpOnly: true, sameSite: 'lax', secure: env.NODE_ENV === 'production', maxAge: 10 * 60_000, path: '/api/auth/google/callback' });
  res.redirect(target.toString());
});
authRoutes.get('/google/callback', async (req, res, next) => {
  try {
    if (typeof req.query.error === 'string') { res.clearCookie('google_oauth_state', { path: '/api/auth/google/callback' }); res.redirect(`${env.WEB_ORIGIN}/?authError=${encodeURIComponent(req.query.error)}`); return; }
    const code = req.query.code; const state = req.query.state;
    if (typeof code !== 'string' || typeof state !== 'string') throw new Error('Missing Google OAuth callback values.');
    if (!req.cookies?.google_oauth_state || req.cookies.google_oauth_state !== state) throw new Error('Google OAuth state did not match the browser session.');
    res.clearCookie('google_oauth_state', { path: '/api/auth/google/callback' });
    const claims = jwt.verify(state, env.JWT_SECRET) as jwt.JwtPayload;
    if (claims.purpose !== 'google') throw new Error('Invalid OAuth state.');
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: env.GOOGLE_CALLBACK_URL, grant_type: 'authorization_code' }) });
    const tokens = await tokenResponse.json() as { access_token?: string; error?: string };
    if (!tokenResponse.ok || !tokens.access_token) throw new Error(tokens.error ?? 'Google token exchange failed.');
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { authorization: `Bearer ${tokens.access_token}` } });
    const profile = await profileResponse.json() as { id?: string; email?: string; name?: string; picture?: string; verified_email?: boolean };
    if (!profile.id || !profile.email || !profile.name || profile.verified_email !== true) throw new Error('Google did not provide a verified profile.');
    const user = await prisma.user.upsert({ where: { googleId: profile.id }, update: { name: profile.name, email: profile.email, avatarUrl: profile.picture }, create: { googleId: profile.id, name: profile.name, email: profile.email, avatarUrl: profile.picture } });
    let membership = await prisma.userTenant.findFirst({ where: { userId: user.id }, include: { tenant: true } });
    if (!membership) {
      const tenant = await prisma.tenant.create({ data: { name: `${profile.name}'s workspace` } });
      membership = await prisma.userTenant.create({ data: { userId: user.id, tenantId: tenant.id }, include: { tenant: true } });
      try {
        const account = env.ETHEREAL_USER && env.ETHEREAL_PASSWORD ? { user: env.ETHEREAL_USER, pass: env.ETHEREAL_PASSWORD } : await nodemailer.createTestAccount();
        await prisma.sender.create({ data: { tenantId: tenant.id, name: 'Ethereal Demo Sender', email: account.user, smtpHost: env.ETHEREAL_HOST, smtpPort: env.ETHEREAL_PORT, smtpUser: account.user, smtpPassword: encryptSecret(account.pass) } });
      } catch (error) { console.warn('Could not provision Ethereal sender. Add an SMTP sender from Settings.', error instanceof Error ? error.message : error); }
    }
    const session = jwt.sign({ userId: user.id }, env.JWT_SECRET, { expiresIn: '7d' });
    res.cookie('session', session, { httpOnly: true, sameSite: 'lax', secure: env.NODE_ENV === 'production', maxAge: 7 * 24 * 3600_000 });
    // Deterministic job IDs make reconciliation safe if the API stopped after the DB commit.
    const pending = await prisma.scheduledEmail.findMany({ where: { tenantId: membership.tenantId, status: 'SCHEDULED' } });
    for (const email of pending) await emailQueue.add('send-email', { emailId: email.id }, { jobId: email.id, delay: Math.max(0, email.scheduledAt.getTime() - Date.now()) });
    await elastic.ping().catch(() => undefined);
    res.redirect(env.WEB_ORIGIN);
  } catch (error) { next(error); }
});
authRoutes.get('/me', requireAuth, (req, res) => res.json({ user: res.locals.user, tenant: res.locals.tenant }));
authRoutes.post('/logout', (req, res) => { res.clearCookie('session'); res.status(204).end(); });
authRoutes.get('/status', (_req, res) => res.json({ googleConfigured: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) }));
