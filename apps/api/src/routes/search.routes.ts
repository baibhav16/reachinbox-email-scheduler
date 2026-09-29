import { Router } from 'express';
import { z } from 'zod';
import { elastic, EMAIL_INDEX } from '../config/elasticsearch.js';
export const searchRoutes = Router();
searchRoutes.get('/', async (req, res, next) => {
  try {
    const { q, status, from, to } = z.object({ q: z.string().optional().default(''), status: z.enum(['SCHEDULED','PROCESSING','SENT','FAILED']).optional(), from: z.string().datetime().optional(), to: z.string().datetime().optional() }).parse(req.query);
    const filters: object[] = [{ term: { tenantId: res.locals.tenantId } }];
    if (status) filters.push({ term: { status } });
    if (from || to) filters.push({ range: { scheduledAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } });
    const result = await elastic.search({ index: EMAIL_INDEX, size: 100, query: { bool: { filter: filters, ...(q ? { must: [{ multi_match: { query: q, fields: ['recipient^3','subject^2','body'], fuzziness: 'AUTO' } }] } : {}) } }, sort: [{ scheduledAt: 'desc' }] });
    res.json({ emails: result.hits.hits.map(hit => ({ id: hit._id, ...(hit._source as Record<string, unknown>) })) });
  } catch (error) { next(error); }
});
