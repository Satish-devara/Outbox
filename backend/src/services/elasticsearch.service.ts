import { getElasticsearchClient, EMAILS_INDEX, isElasticsearchConnected } from '../config/elasticsearch';
import { Email } from '../models/email.model';
import { query } from '../config/database';

export async function indexEmailDocument(email: Email): Promise<void> {
  if (!isElasticsearchConnected()) return;
  const es = getElasticsearchClient();

  try {
    await es.index({
      index: EMAILS_INDEX,
      id: email.id,
      document: {
        id: email.id,
        to_address: email.to_address,
        from_address: email.from_address || 'scheduler@outbox.dev',
        subject: email.subject,
        body: email.body,
        status: email.status,
        job_id: email.job_id,
        scheduled_at: email.scheduled_at,
        sent_at: email.sent_at,
        ethereal_url: email.ethereal_url,
        error_message: email.error_message,
        created_at: email.created_at,
        updated_at: email.updated_at,
      },
      refresh: true,
    });
  } catch (err) {
    console.error(`⚠️  Failed to index email ${email.id} into Elasticsearch:`, (err as Error).message);
  }
}

export async function deleteEmailDocument(emailId: string): Promise<void> {
  if (!isElasticsearchConnected()) return;
  const es = getElasticsearchClient();

  try {
    await es.delete({
      index: EMAILS_INDEX,
      id: emailId,
      refresh: true,
    });
  } catch (err) {
    // Ignore 404 document missing
  }
}

export async function searchEmailsIndex(
  searchTerm: string,
  status?: string,
  limit = 50
): Promise<{ emails: Email[]; total: number }> {
  if (!isElasticsearchConnected()) {
    // Fallback to database LIKE search if ES is disconnected
    console.warn('⚠️  Elasticsearch offline, falling back to database query');
    const statusFilter = status ? `AND status = $2` : '';
    const params = status ? [`%${searchTerm}%`, status, limit] : [`%${searchTerm}%`, limit];
    const rows = await query<Email>(
      `SELECT * FROM emails
        WHERE (subject ILIKE $1 OR to_address ILIKE $1 OR body ILIKE $1)
        ${statusFilter}
        ORDER BY scheduled_at DESC
        LIMIT ${status ? '$3' : '$2'}`,
      params
    );
    return { emails: rows, total: rows.length };
  }

  const es = getElasticsearchClient();

  const mustClauses: any[] = [];

  if (searchTerm && searchTerm.trim().length > 0) {
    mustClauses.push({
      multi_match: {
        query: searchTerm,
        fields: ['to_address^3', 'from_address^2', 'subject^2', 'body'],
        fuzziness: 'AUTO',
        operator: 'or',
      },
    });
  } else {
    mustClauses.push({ match_all: {} });
  }

  if (status) {
    mustClauses.push({ term: { status } });
  }

  const searchResult = await es.search<Email>({
    index: EMAILS_INDEX,
    size: limit,
    query: {
      bool: {
        must: mustClauses,
      },
    },
    sort: [
      { scheduled_at: { order: 'desc' } },
    ],
  });

  const hits = searchResult.hits.hits;
  const total = typeof searchResult.hits.total === 'number'
    ? searchResult.hits.total
    : (searchResult.hits.total?.value ?? hits.length);

  const emails: Email[] = hits.map((hit) => hit._source as Email);

  return { emails, total };
}

/**
 * Syncs any existing records in PostgreSQL to Elasticsearch
 */
export async function syncAllEmailsToElasticsearch(): Promise<void> {
  if (!isElasticsearchConnected()) return;
  try {
    const rows = await query<Email>(`SELECT * FROM emails`);
    for (const email of rows) {
      await indexEmailDocument(email);
    }
    console.log(`✅  Synced ${rows.length} emails to Elasticsearch index`);
  } catch (err) {
    console.error('Failed to sync emails to Elasticsearch:', (err as Error).message);
  }
}
