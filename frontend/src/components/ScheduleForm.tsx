import { useState } from 'react';
import { api } from '../lib/api';
import { CreateEmailPayload } from '../types/email';

interface ScheduleFormProps {
  onSuccess: () => void;
}

const PRESET_SENDERS = [
  'scheduler@outbox.dev',
  'outreach@reachinbox.ai',
  'growth@reachinbox.ai',
  'founders@reachinbox.ai',
];

export default function ScheduleForm({ onSuccess }: ScheduleFormProps) {
  const [form, setForm] = useState<CreateEmailPayload>({
    to: '',
    from: 'scheduler@outbox.dev',
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
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
    return localISOTime;
  };

  const handleQuickPreset = (minutes: number) => {
    const d = new Date(Date.now() + minutes * 60 * 1000);
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localISOTime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    setForm((f) => ({ ...f, scheduledAt: localISOTime }));
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
      setSuccess('🎉 Email scheduled in BullMQ! Indexed in Elasticsearch for instant search.');
      setForm({ to: '', from: 'scheduler@outbox.dev', subject: '', body: '', scheduledAt: '' });
      setTimeout(() => {
        onSuccess();
      }, 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule email');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full bg-[#141420]/80 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200';
  const labelClass = 'block text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wider';

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white tracking-tight">Schedule New Email</h2>
        <p className="text-sm text-gray-400 mt-1">
          Supports multiple senders, delayed execution via BullMQ, and real-time indexing into Elasticsearch.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl border border-white/10">
        {/* Sender (Multiple Senders Support) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="from" className={labelClass}>From (Sender Account)</label>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-gray-500 mr-1">Pick:</span>
              {PRESET_SENDERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, from: s }))}
                  className={`text-[10px] px-2 py-0.5 rounded-md border transition-all ${
                    form.from === s
                      ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50'
                      : 'bg-white/5 hover:bg-white/10 text-gray-400 border-white/5'
                  }`}
                >
                  {s.split('@')[0]}
                </button>
              ))}
            </div>
          </div>
          <input
            id="from"
            name="from"
            type="text"
            required
            value={form.from || ''}
            onChange={handleChange}
            placeholder="scheduler@outbox.dev or Custom Name <sender@domain.com>"
            className={inputClass}
          />
        </div>

        {/* Recipient */}
        <div>
          <label htmlFor="to" className={labelClass}>Recipient Email</label>
          <input
            id="to"
            name="to"
            type="email"
            required
            value={form.to}
            onChange={handleChange}
            placeholder="lead@company.com"
            className={inputClass}
          />
        </div>

        {/* Subject */}
        <div>
          <label htmlFor="subject" className={labelClass}>Subject Line</label>
          <input
            id="subject"
            name="subject"
            type="text"
            required
            value={form.subject}
            onChange={handleChange}
            placeholder="Introduction & Partnership Opportunity"
            className={inputClass}
          />
        </div>

        {/* Body */}
        <div>
          <label htmlFor="body" className={labelClass}>Email Body</label>
          <textarea
            id="body"
            name="body"
            required
            rows={5}
            value={form.body}
            onChange={handleChange}
            placeholder="Hi there,<br><br>We would love to connect..."
            className={`${inputClass} resize-none font-sans`}
          />
          <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
            <span>💡</span> Rich text / HTML is supported for email formatting
          </p>
        </div>

        {/* Scheduled At */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="scheduledAt" className={labelClass}>Execution Time (Send At)</label>
            {/* Quick Presets */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-gray-500 mr-1">Quick:</span>
              <button
                type="button"
                onClick={() => handleQuickPreset(2)}
                className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-indigo-400 border border-white/5 transition-all"
              >
                +2m
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset(5)}
                className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-indigo-400 border border-white/5 transition-all"
              >
                +5m
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset(60)}
                className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-indigo-400 border border-white/5 transition-all"
              >
                +1h
              </button>
            </div>
          </div>
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
          <p className="text-xs text-gray-500 mt-1.5">Selected in your local timezone, persisted in UTC</p>
        </div>

        {/* Feedback Messages */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-4 py-3 text-sm flex items-start gap-2 fade-in">
            <span className="shrink-0 text-base">⚠️</span>
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl px-4 py-3 text-sm flex items-start gap-2 fade-in">
            <span className="shrink-0 text-base">🎉</span>
            <span>{success}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="
            w-full py-3.5 rounded-xl font-bold text-sm text-white
            bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-[length:200%_auto]
            hover:bg-right hover:shadow-lg hover:shadow-indigo-500/30
            active:scale-[0.99]
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-300
            focus:outline-none focus:ring-2 focus:ring-indigo-500/50
            flex items-center justify-center gap-2
          "
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Dispatching to BullMQ...</span>
            </>
          ) : (
            <>
              <span>⚡</span>
              <span>Schedule Email Now</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
