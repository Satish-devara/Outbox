export interface Email {
  id: string;
  to_address: string;
  from_address: string;
  subject: string;
  body: string;
  scheduled_at: string;
  status: 'scheduled' | 'sent' | 'failed' | 'cancelled';
  job_id: string | null;
  sent_at: string | null;
  ethereal_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateEmailPayload {
  to: string;
  from?: string; // multiple senders support
  subject: string;
  body: string;
  scheduledAt: string;
}

export interface QueueStats {
  waiting: number;
  delayed: number;
  active: number;
  completed: number;
  failed: number;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
  query?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: PaginationMeta;
  message?: string;
  error?: string;
}
