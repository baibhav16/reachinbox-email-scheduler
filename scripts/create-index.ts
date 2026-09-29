import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { Client } from '@elastic/elasticsearch';
const index = process.env.ELASTICSEARCH_INDEX ?? 'scheduled-emails';
const client = new Client({ node: process.env.ELASTICSEARCH_URL ?? 'http://localhost:9200' });
try {
  const exists = await client.indices.exists({ index });
  if (!exists) {
    const definition = JSON.parse(await readFile(new URL('../infrastructure/elasticsearch/mappings.json', import.meta.url), 'utf8'));
    await client.indices.create({ index, ...definition });
    console.log(`Created Elasticsearch index: ${index}`);
  } else console.log(`Elasticsearch index already exists: ${index}`);
} finally { await client.close(); }
