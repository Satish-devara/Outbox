export interface Email {
  id: string;
  to_address: string;
  subject: string;
  body: string;
  scheduled_at: Date;
  status: 'scheduled' | 'sent' | 'failed' | 'cancelled';
  job_id: string | null;
  sent_at: Date | null;
  ethereal_url: string | null;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateEmailDto {
  to: string;
  subject: string;
  body: string;
  scheduledAt: string; // ISO 8601 string
}

export interface EmailJobData {
  emailId: string;
  to: string;
  subject: string;
  body: string;
}
