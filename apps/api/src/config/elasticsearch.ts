import { Client } from '@elastic/elasticsearch';
import { env } from './env.js';
export const elastic = new Client({ node: env.ELASTICSEARCH_URL });
export const EMAIL_INDEX = env.ELASTICSEARCH_INDEX;
export async function ensureEmailIndex() {
  try {
    if (!(await elastic.indices.exists({ index: EMAIL_INDEX }))) await elastic.indices.create({ index: EMAIL_INDEX, mappings: { properties: {
      tenantId: { type: 'keyword' }, recipient: { type: 'text' }, subject: { type: 'text' }, body: { type: 'text' },
      status: { type: 'keyword' }, senderId: { type: 'keyword' }, campaignId: { type: 'keyword' }, scheduledAt: { type: 'date' }, sentAt: { type: 'date' }
    } } });
  } catch (error) { console.warn('Elasticsearch index initialization deferred:', error instanceof Error ? error.message : error); }
}
