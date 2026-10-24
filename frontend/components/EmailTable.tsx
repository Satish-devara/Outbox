'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Email } from '@/types/email';
import { formatDate, getStatusColor, getStatusIcon } from '@/lib/utils';

interface EmailTableProps {
  status: 'scheduled' | 'sent';
  onRefresh: () => void;
}

export default function EmailTable({ status, onRefresh }: EmailTableProps) {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchEmails = useCallback(async () => {
    try {
      const res = await api.getEmails(status);
      setEmails(res.data);
      setError(null);
    } catch (e) {
      setError('Failed to fetch emails');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchEmails();
    const interval = setInterval(fetchEmails, 8000);
    return () => clearInterval(interval);
  }, [fetchEmails]);

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this scheduled email?')) return;
    setCancellingId(id);
    try {
      await api.cancelEmail(id);
      await fetchEmails();
      onRefresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to cancel');
    } finally {
      setCancellingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass rounded-xl p-4 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
        ⚠️ {error}
      </div>
    );
  }

  const title = status === 'scheduled' ? '⏰ Scheduled Emails' : '✅ Sent Emails';
  const emptyMsg = status === 'scheduled'
    ? 'No scheduled emails. Use the "Schedule Email" tab to create one.'
    : 'No sent emails yet.';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {emails.length} email{emails.length !== 1 ? 's' : ''} · auto-refreshes every 8s
          </p>
        </div>
        <button
          onClick={fetchEmails}
          className="text-xs text-gray-400 hover:text-white glass px-3 py-1.5 rounded-lg transition-all hover:bg-white/10"
        >
          ↻ Refresh
        </button>
      </div>

      {emails.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center text-gray-500">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-sm">{emptyMsg}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {emails.map((email) => (
            <div
              key={email.id}
              className="glass rounded-xl overflow-hidden border border-white/5 hover:border-white/10 transition-all duration-200 fade-in"
            >
              {/* Main row */}
              <div className="p-4 flex items-center gap-4">
                {/* Status badge */}
                <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${getStatusColor(email.status)}`}>
                  {getStatusIcon(email.status)} {email.status}
                </span>

                {/* Email info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white text-sm truncate">{email.subject}</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    To: {email.to_address}
                  </p>
                </div>

                {/* Timestamps */}
                <div className="hidden md:block text-right shrink-0">
                  <p className="text-xs text-gray-400">
                    {status === 'sent' && email.sent_at
                      ? `Sent ${formatDate(email.sent_at)}`
                      : `Scheduled ${formatDate(email.scheduled_at)}`}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Created {formatDate(email.created_at)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Ethereal link */}
                  {email.ethereal_url && (
                    <a
                      href={email.ethereal_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-400 hover:text-indigo-300 glass px-2.5 py-1 rounded-lg transition-all hover:bg-indigo-500/10"
                    >
                      👁 Preview
                    </a>
                  )}

                  {/* Expand */}
                  <button
                    onClick={() => setExpandedId(expandedId === email.id ? null : email.id)}
                    className="text-xs text-gray-400 hover:text-gray-200 glass px-2.5 py-1 rounded-lg transition-all hover:bg-white/10"
                  >
                    {expandedId === email.id ? '▲' : '▼'}
                  </button>

                  {/* Cancel */}
                  {email.status === 'scheduled' && (
                    <button
                      onClick={() => handleCancel(email.id)}
                      disabled={cancellingId === email.id}
                      className="text-xs text-red-400 hover:text-red-300 glass px-2.5 py-1 rounded-lg transition-all hover:bg-red-500/10 disabled:opacity-50"
                    >
                      {cancellingId === email.id ? '...' : '🗑 Cancel'}
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded details */}
              {expandedId === email.id && (
                <div className="border-t border-white/5 px-4 py-3 bg-black/20 fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-400">
                    <div>
                      <p className="text-gray-600 uppercase tracking-wide mb-1">ID</p>
                      <p className="font-mono text-gray-300">{email.id}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 uppercase tracking-wide mb-1">Job ID</p>
                      <p className="font-mono text-gray-300">{email.job_id ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 uppercase tracking-wide mb-1">Scheduled At</p>
                      <p>{formatDate(email.scheduled_at)}</p>
                    </div>
                    {email.sent_at && (
                      <div>
                        <p className="text-gray-600 uppercase tracking-wide mb-1">Sent At</p>
                        <p>{formatDate(email.sent_at)}</p>
                      </div>
                    )}
                    {email.error_message && (
                      <div className="col-span-2">
                        <p className="text-red-500 uppercase tracking-wide mb-1">Error</p>
                        <p className="text-red-400">{email.error_message}</p>
                      </div>
                    )}
                    <div className="col-span-2">
                      <p className="text-gray-600 uppercase tracking-wide mb-1">Message Body</p>
                      <div
                        className="bg-black/30 rounded-lg p-3 text-gray-300 max-h-32 overflow-y-auto"
                        dangerouslySetInnerHTML={{ __html: email.body }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
