import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { authRoutes } from './routes/auth.routes.js';
import { emailRoutes } from './routes/email.routes.js';
import { senderRoutes } from './routes/sender.routes.js';
import { searchRoutes } from './routes/search.routes.js';
import { slackRoutes } from './routes/slack.routes.js';
import { emailQueue } from './queues/email.queue.js';
import { requireAuth } from './middleware/auth.middleware.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

export const app = express();
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api/slack', slackRoutes);
app.use('/api/emails', requireAuth, emailRoutes);
app.use('/api/senders', requireAuth, senderRoutes);
app.use('/api/search', requireAuth, searchRoutes);

const boardAdapter = new ExpressAdapter();
boardAdapter.setBasePath('/admin/queues');
createBullBoard({ queues: [new BullMQAdapter(emailQueue)], serverAdapter: boardAdapter });
app.use('/admin/queues', (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Basic ')) { res.setHeader('WWW-Authenticate', 'Basic realm="BullMQ dashboard"'); res.status(401).send('Authentication required'); return; }
  const decoded = Buffer.from(auth.slice(6), 'base64').toString();
  const [username, ...rest] = decoded.split(':'); const password = rest.join(':');
  if (username !== env.QUEUE_DASHBOARD_USER || password !== env.QUEUE_DASHBOARD_PASSWORD) { res.status(401).send('Invalid credentials'); return; }
  next();
}, boardAdapter.getRouter());

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err && typeof err === 'object' && 'issues' in err) { res.status(400).json({ error: 'Validation failed.', details: (err as { issues: unknown }).issues }); return; }
  const message = err instanceof Error ? err.message : 'Unexpected server error.';
  logger.error({ err }, 'Request failed');
  res.status(500).json({ error: env.NODE_ENV === 'production' ? 'Unexpected server error.' : message });
});
