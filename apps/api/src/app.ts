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
app.use(express.json({ limit: '12mb' }));
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
app.use('/admin/queues', requireAuth, boardAdapter.getRouter());

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err && typeof err === 'object' && 'issues' in err) { res.status(400).json({ error: 'Validation failed.', details: (err as { issues: unknown }).issues }); return; }
  const message = err instanceof Error ? err.message : 'Unexpected server error.';
  logger.error({ err }, 'Request failed');
  res.status(500).json({ error: env.NODE_ENV === 'production' ? 'Unexpected server error.' : message });
});
