import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { encryptSecret } from '../utils/crypto.js';
export const slackRoutes = Router();
slackRoutes.get('/status', requireAuth, async (_req, res, next) => {
  try { const connected = await prisma.slackConnection.findUnique({ where: { tenantId: res.locals.tenantId }, select: { id: true, teamId: true, teamName: true, channelId: true } }); res.json({ configured: Boolean(env.SLACK_CLIENT_ID && env.SLACK_CLIENT_SECRET), connection: connected }); }
  catch (error) { next(error); }
});
slackRoutes.get('/connect', requireAuth, (req, res) => {
  if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET) { res.status(503).send('Slack OAuth is not configured.'); return; }
  const state = jwt.sign({ purpose: 'slack', tenantId: res.locals.tenantId }, env.JWT_SECRET, { expiresIn: '10m' });
  const target = new URL('https://slack.com/oauth/v2/authorize');
  target.search = new URLSearchParams({ client_id: env.SLACK_CLIENT_ID, scope: 'chat:write,incoming-webhook', redirect_uri: env.SLACK_CALLBACK_URL, state }).toString();
  res.cookie('slack_oauth_state', state, { httpOnly: true, sameSite: 'lax', secure: env.NODE_ENV === 'production', maxAge: 10 * 60_000, path: '/api/slack/callback' });
  res.redirect(target.toString());
});
slackRoutes.get('/callback', async (req, res, next) => {
  try {
    if (typeof req.query.error === 'string') { res.clearCookie('slack_oauth_state', { path: '/api/slack/callback' }); res.redirect(`${env.WEB_ORIGIN}/?slackError=${encodeURIComponent(req.query.error)}`); return; }
    if (typeof req.query.code !== 'string' || typeof req.query.state !== 'string') throw new Error('Missing Slack OAuth callback values.');
    if (!req.cookies?.slack_oauth_state || req.cookies.slack_oauth_state !== req.query.state) throw new Error('Slack OAuth state did not match the browser session.');
    res.clearCookie('slack_oauth_state', { path: '/api/slack/callback' });
    const state = jwt.verify(req.query.state, env.JWT_SECRET) as jwt.JwtPayload;
    if (state.purpose !== 'slack' || typeof state.tenantId !== 'string') throw new Error('Invalid Slack OAuth state.');
    const response = await fetch('https://slack.com/api/oauth.v2.access', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code: req.query.code, client_id: env.SLACK_CLIENT_ID, client_secret: env.SLACK_CLIENT_SECRET, redirect_uri: env.SLACK_CALLBACK_URL }) });
    const result = await response.json() as { ok?: boolean; access_token?: string; team?: { id?: string; name?: string }; incoming_webhook?: { channel_id?: string }; error?: string };
    if (!response.ok || !result.ok || !result.access_token) throw new Error(result.error ?? 'Slack authorization failed.');
    const encryptedToken = encryptSecret(result.access_token);
    await prisma.slackConnection.upsert({ where: { tenantId: state.tenantId }, update: { accessToken: encryptedToken, teamId: result.team?.id, teamName: result.team?.name, channelId: result.incoming_webhook?.channel_id }, create: { tenantId: state.tenantId, accessToken: encryptedToken, teamId: result.team?.id, teamName: result.team?.name, channelId: result.incoming_webhook?.channel_id } });
    res.redirect(`${env.WEB_ORIGIN}/?slackConnected=1`);
  } catch (error) { next(error); }
});
slackRoutes.delete('/', requireAuth, async (_req, res, next) => { try { await prisma.slackConnection.deleteMany({ where: { tenantId: res.locals.tenantId } }); res.status(204).end(); } catch (error) { next(error); } });
