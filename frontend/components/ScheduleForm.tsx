'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { CreateEmailPayload } from '@/types/email';

interface ScheduleFormProps {
  onSuccess: () => void;
}

export default function ScheduleForm({ onSuccess }: ScheduleFormProps) {
  const [form, setForm] = useState<CreateEmailPayload>({
    to: '',
    subject: '',
    body: '',
    scheduledAt: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1);
    return now.toISOString().slice(0, 16);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await api.scheduleEmail({
        ...form,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
      });
      setSuccess('🎉 Email scheduled successfully!');
      setForm({ to: '', subject: '', body: '', scheduledAt: '' });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule email');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all duration-200';
  const labelClass = 'block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide';

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">Schedule an Email</h2>
        <p className="text-sm text-gray-500 mt-1">
          Emails are queued in BullMQ and sent via Ethereal SMTP at the exact scheduled time.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-5">
        {/* Recipient */}
        <div>
          <label htmlFor="to" className={labelClass}>Recipient</label>
          <input
            id="to"
            name="to"
            type="email"
            required
            value={form.to}
            onChange={handleChange}
            placeholder="recipient@example.com"
            className={inputClass}
          />
        </div>

        {/* Subject */}
        <div>
          <label htmlFor="subject" className={labelClass}>Subject</label>
          <input
            id="subject"
            name="subject"
            type="text"
            required
            value={form.subject}
            onChange={handleChange}
            placeholder="Your email subject"
            className={inputClass}
          />
        </div>

        {/* Body */}
        <div>
          <label htmlFor="body" className={labelClass}>Message Body</label>
          <textarea
            id="body"
            name="body"
            required
            rows={5}
            value={form.body}
            onChange={handleChange}
            placeholder="Write your email message here…"
            className={`${inputClass} resize-none`}
          />
          <p className="text-xs text-gray-600 mt-1">HTML is supported</p>
        </div>

        {/* Scheduled At */}
        <div>
          <label htmlFor="scheduledAt" className={labelClass}>Send At</label>
          <input
            id="scheduledAt"
            name="scheduledAt"
            type="datetime-local"
            required
            min={getMinDateTime()}
            value={form.scheduledAt}
            onChange={handleChange}
            className={`${inputClass} [color-scheme:dark]`}
          />
          <p className="text-xs text-gray-600 mt-1">Must be at least 1 minute in the future</p>
        </div>

        {/* Feedback */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-sm fade-in">
            ⚠️ {error}
          </div>
        )}
        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl px-4 py-3 text-sm fade-in">
            {success}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="
            w-full py-3 rounded-xl font-semibold text-sm
            bg-gradient-to-r from-indigo-600 to-purple-600
            hover:from-indigo-500 hover:to-purple-500
            disabled:opacity-50 disabled:cursor-not-allowed
            shadow-lg shadow-indigo-500/25
            transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-indigo-500/50
          "
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Scheduling…
            </span>
          ) : (
            '📅 Schedule Email'
          )}
        </button>
      </form>
    </div>
  );
}
