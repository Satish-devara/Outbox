import { Email, CreateEmailPayload, QueueStats, ApiResponse } from '@/types/email';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

async function fetchApi<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const json: ApiResponse<T> = await res.json();
  if (!res.ok) throw new Error(json.error || `Request failed: ${res.status}`);
  return json;
}

export const api = {
  scheduleEmail: (payload: CreateEmailPayload) =>
    fetchApi<Email>('/emails', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getEmails: (status?: string, page = 1, limit = 50) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    params.set('page', String(page));
    params.set('limit', String(limit));
    return fetchApi<Email[]>(`/emails?${params.toString()}`);
  },

  getEmail: (id: string) =>
    fetchApi<Email>(`/emails/${id}`),

  cancelEmail: (id: string) =>
    fetchApi<Email>(`/emails/${id}`, { method: 'DELETE' }),

  getQueueStats: () =>
    fetchApi<QueueStats>('/queue/stats'),
};
