import { Email, CreateEmailPayload, QueueStats, ApiResponse } from '../types/email';

const getBaseUrl = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    return 'https://outbox-2cqf.onrender.com/api';
  }
  return 'http://localhost:3001/api';
};

const BASE_URL = getBaseUrl();

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

  searchEmails: (queryStr: string, status?: string) => {
    const params = new URLSearchParams();
    params.set('q', queryStr);
    if (status) params.set('status', status);
    return fetchApi<Email[]>(`/emails/search?${params.toString()}`);
  },

  getEmail: (id: string) =>
    fetchApi<Email>(`/emails/${id}`),

  cancelEmail: (id: string) =>
    fetchApi<Email>(`/emails/${id}`, { method: 'DELETE' }),

  getQueueStats: () =>
    fetchApi<QueueStats>('/queue/stats'),
};
