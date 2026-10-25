'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Email, PaginationMeta } from '@/types/email';
import { formatDate, getStatusColor, getStatusIcon } from '@/lib/utils';

interface EmailTableProps {
  status?: 'scheduled' | 'sent' | 'failed' | 'cancelled';
  title: string;
  onRefresh: () => void;
}

const PAGE_SIZE = 20;

export default function EmailTable({ status, title, onRefresh }: EmailTableProps) {
  const [emails, setEmails] = useState<Email[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchEmails = useCallback(async (p = page) => {
    try {
      setError(null);
      const res = await api.getEmails(status, p, PAGE_SIZE);
      setEmails(res.data);
      if (res.meta) setMeta(res.meta);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch emails');
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    setLoading(true);
    fetchEmails(page);
    const interval = setInterval(() => fetchEmails(page), 8000);
    return () => clearInterval(interval);
  }, [fetchEmails, page]);

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this scheduled email?')) return;
    setCancellingId(id);
    try {
      await api.cancelEmail(id);
      await fetchEmails(page);
      onRefresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to cancel');
    } finally {
      setCancellingId(null);
    }
  };

  const emptyMessages: Record<string, string> = {
    scheduled: 'No scheduled emails. Use the "Schedule" tab to create one.',
    sent:      'No sent emails yet.',
    failed:    'No failed emails. All good! 🎉',
    cancelled: 'No cancelled emails.',
  };
  const emptyMsg = status ? emptyMessages[status] : 'No emails found.';

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm flex items-center gap-2">
        ⚠️ {error}
      </div>
    );
  }

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {meta ? `${meta.total} total` : `${emails.length} emails`}
            {' '}· auto-refreshes every 8s
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchEmails(page); }}
          className="text-xs text-gray-400 hover:text-white bg-white/5 border border-white/8 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-all"
        >
          ↻ Refresh
        </button>
      </div>

      {emails.length === 0 ? (
        <div className="bg-white/4 border border-white/8 rounded-2xl p-12 text-center text-gray-500">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-sm">{emptyMsg}</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {emails.map((email) => (
              <div
                key={email.id}
                className="bg-white/4 border border-white/8 hover:border-white/15 rounded-xl overflow-hidden transition-all duration-200 fade-in"
              >
                {/* Main row */}
                <div className="px-4 py-3 flex items-center gap-3">
                  {/* Status badge */}
                  <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${getStatusColor(email.status)}`}>
                    {getStatusIcon(email.status)} {email.status}
                  </span>

                  {/* Subject + To */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm truncate">{email.subject}</p>
                    <p className="text-xs text-gray-500 truncate">→ {email.to_address}</p>
                  </div>

                  {/* Timestamp */}
                  <div className="hidden md:block text-right shrink-0 text-xs text-gray-500">
                    {email.status === 'sent' && email.sent_at ? (
                      <span>Sent {formatDate(email.sent_at)}</span>
                    ) : (
                      <span>Scheduled {formatDate(email.scheduled_at)}</span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {email.ethereal_url && (
                      <a
                        href={email.ethereal_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-1 rounded-lg transition-all"
                      >
                        👁 Preview
                      </a>
                    )}
                    <button
                      onClick={() => setExpandedId(expandedId === email.id ? null : email.id)}
                      className="text-[11px] text-gray-400 hover:text-gray-200 bg-white/5 hover:bg-white/10 px-2 py-1 rounded-lg transition-all"
                    >
                      {expandedId === email.id ? '▲' : '▼'}
                    </button>
                    {email.status === 'scheduled' && (
                      <button
                        onClick={() => handleCancel(email.id)}
                        disabled={cancellingId === email.id}
                        className="text-[11px] text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2 py-1 rounded-lg transition-all disabled:opacity-50"
                      >
                        {cancellingId === email.id ? '…' : '🗑 Cancel'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded panel */}
                {expandedId === email.id && (
                  <div className="border-t border-white/5 px-4 py-3 bg-black/25 fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-gray-600 uppercase tracking-widest text-[10px] mb-1">Email ID</p>
                        <p className="font-mono text-gray-300 break-all">{email.id}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 uppercase tracking-widest text-[10px] mb-1">Job ID (BullMQ)</p>
                        <p className="font-mono text-gray-300 break-all">{email.job_id ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 uppercase tracking-widest text-[10px] mb-1">Scheduled At</p>
                        <p className="text-gray-300">{formatDate(email.scheduled_at)}</p>
                      </div>
                      {email.sent_at && (
                        <div>
                          <p className="text-gray-600 uppercase tracking-widest text-[10px] mb-1">Sent At</p>
                          <p className="text-gray-300">{formatDate(email.sent_at)}</p>
                        </div>
                      )}
                      {email.ethereal_url && (
                        <div className="col-span-2">
                          <p className="text-gray-600 uppercase tracking-widest text-[10px] mb-1">Ethereal Preview URL</p>
                          <a
                            href={email.ethereal_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-400 hover:text-indigo-300 break-all underline underline-offset-2"
                          >
                            {email.ethereal_url}
                          </a>
                        </div>
                      )}
                      {email.error_message && (
                        <div className="col-span-2">
                          <p className="text-red-500 uppercase tracking-widest text-[10px] mb-1">Error</p>
                          <p className="text-red-400">{email.error_message}</p>
                        </div>
                      )}
                      <div className="col-span-2">
                        <p className="text-gray-600 uppercase tracking-widest text-[10px] mb-1">Body Preview</p>
                        <div
                          className="bg-black/40 border border-white/5 rounded-lg p-3 text-gray-300 max-h-32 overflow-y-auto text-xs leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: email.body }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {meta && meta.pages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-gray-500">
                Showing {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
              </p>
              <div className="flex gap-1.5">
                <button
                  disabled={meta.page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="text-xs px-3 py-1.5 bg-white/5 border border-white/8 hover:bg-white/10 rounded-lg transition-all disabled:opacity-30"
                >
                  ← Prev
                </button>
                {Array.from({ length: Math.min(meta.pages, 7) }, (_, i) => {
                  const p = i + 1;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={[
                        'text-xs w-8 h-8 rounded-lg transition-all',
                        p === meta.page
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white/5 border border-white/8 hover:bg-white/10 text-gray-400',
                      ].join(' ')}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  disabled={meta.page >= meta.pages}
                  onClick={() => setPage((p) => p + 1)}
                  className="text-xs px-3 py-1.5 bg-white/5 border border-white/8 hover:bg-white/10 rounded-lg transition-all disabled:opacity-30"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
