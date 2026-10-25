import { Client } from '@elastic/elasticsearch';

const ES_NODE = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
export const EMAILS_INDEX = 'emails';

let client: Client | null = null;
let isConnected = false;

export function getElasticsearchClient(): Client {
  if (!client) {
    client = new Client({
      node: ES_NODE,
      maxRetries: 3,
      requestTimeout: 10000,
    });
  }
  return client;
}

/**
 * Initializes the Elasticsearch 'emails' index with appropriate full-text
 * and keyword mappings if it doesn't already exist.
 */
export async function initElasticsearch(): Promise<boolean> {
  const es = getElasticsearchClient();
  try {
    const health = await es.cluster.health({});
    console.log(`✅  Elasticsearch connected (${health.status}) at ${ES_NODE}`);
    isConnected = true;

    const exists = await es.indices.exists({ index: EMAILS_INDEX });
    if (!exists) {
      await es.indices.create({
        index: EMAILS_INDEX,
        settings: {
          number_of_shards: 1,
          number_of_replicas: 0,
          analysis: {
            analyzer: {
              email_analyzer: {
                type: 'custom',
                tokenizer: 'uax_url_email',
                filter: ['lowercase'],
              },
            },
          },
        },
        mappings: {
          properties: {
            id: { type: 'keyword' },
            to_address: {
              type: 'text',
              analyzer: 'email_analyzer',
              fields: { keyword: { type: 'keyword' } },
            },
            from_address: {
              type: 'text',
              analyzer: 'email_analyzer',
              fields: { keyword: { type: 'keyword' } },
            },
            subject: {
              type: 'text',
              fields: { keyword: { type: 'keyword' } },
            },
            body: { type: 'text' },
            status: { type: 'keyword' },
            job_id: { type: 'keyword' },
            scheduled_at: { type: 'date' },
            sent_at: { type: 'date' },
            ethereal_url: { type: 'keyword' },
            error_message: { type: 'text' },
            created_at: { type: 'date' },
            updated_at: { type: 'date' },
          },
        },
      } as any);
      console.log(`✅  Elasticsearch index "${EMAILS_INDEX}" created`);
    } else {
      console.log(`✅  Elasticsearch index "${EMAILS_INDEX}" exists`);
    }
    return true;
  } catch (err) {
    console.warn(`⚠️  Elasticsearch connection pending: ${(err as Error).message}`);
    isConnected = false;
    return false;
  }
}

export function isElasticsearchConnected(): boolean {
  return isConnected;
}
