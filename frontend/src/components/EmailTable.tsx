import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import { Email, PaginationMeta } from '../types/email';
import { formatDate, getStatusColor, getStatusIcon } from '../lib/utils';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

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

  // Handle Elasticsearch full-text search with debounce
  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setIsSearching(false);
      fetchEmails(page);
      return;
    }

    setIsSearching(true);
    setLoading(true);
    try {
      setError(null);
      const res = await api.searchEmails(q.trim(), status);
      setEmails(res.data);
      if (res.meta) setMeta(res.meta);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Elasticsearch query failed');
    } finally {
      setLoading(false);
    }
  }, [status, page, fetchEmails]);

  const onSearchInputChange = (val: string) => {
    setSearchQuery(val);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      handleSearch(val);
    }, 350);
  };

  useEffect(() => {
    if (!searchQuery.trim()) {
      setLoading(true);
      fetchEmails(page);
      const interval = setInterval(() => fetchEmails(page), 6000);
      return () => clearInterval(interval);
    }
  }, [fetchEmails, page, searchQuery]);

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this scheduled email? BullMQ job will be removed.')) return;
    setCancellingId(id);
    try {
      await api.cancelEmail(id);
      if (searchQuery.trim()) {
        await handleSearch(searchQuery);
      } else {
        await fetchEmails(page);
      }
      onRefresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to cancel');
    } finally {
      setCancellingId(null);
    }
  };

  const emptyMessages: Record<string, string> = {
    scheduled: 'No scheduled emails in queue. Switch to "Schedule Email" tab to create one.',
    sent:      'No sent emails yet. When scheduled emails reach their dispatch time, they will appear here.',
    failed:    'No failed emails. All scheduled jobs delivered cleanly!',
    cancelled: 'No cancelled emails.',
  };
  const emptyMsg = status ? emptyMessages[status] : 'No emails found in this category.';

  if (loading && emails.length === 0) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error && emails.length === 0) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm flex items-center gap-2">
        ⚠️ {error}
      </div>
    );
  }

  return (
    <div>
      {/* Header row & Elasticsearch Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {meta ? `${meta.total} total emails ${isSearching ? '(Elasticsearch indexed)' : 'in database'}` : `${emails.length} emails`}
            {' '}· auto-refreshes every 6s
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Elasticsearch Search Input */}
          <div className="relative flex items-center">
            <span className="absolute left-2.5 text-xs text-gray-400 pointer-events-none">🔍</span>
            <input
              type="text"
              placeholder="Search via Elasticsearch..."
              value={searchQuery}
              onChange={(e) => onSearchInputChange(e.target.value)}
              className="bg-[#141420]/80 border border-white/10 rounded-xl pl-8 pr-7 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 w-52 sm:w-64 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setIsSearching(false);
                  fetchEmails(page);
                }}
                className="absolute right-2 text-xs text-gray-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
          <button
            onClick={() => {
              setLoading(true);
              if (searchQuery.trim()) {
                handleSearch(searchQuery);
              } else {
                fetchEmails(page);
              }
            }}
            className="text-xs font-medium text-gray-300 hover:text-white bg-white/5 border border-white/10 hover:bg-white/10 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5"
          >
            <span>↻</span>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {emails.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center text-gray-400 border border-white/5">
          <p className="text-4xl mb-3">{searchQuery ? '🔎' : '📭'}</p>
          <p className="text-sm font-medium">
            {searchQuery
              ? `No emails matched your Elasticsearch search query "${searchQuery}".`
              : emptyMsg}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2.5">
            {emails.map((email) => (
              <div
                key={email.id}
                className="glass border border-white/8 hover:border-white/15 rounded-xl overflow-hidden transition-all duration-200 fade-in"
              >
                {/* Main row */}
                <div className="px-4 py-3.5 flex items-center gap-3">
                  {/* Status badge */}
                  <span className={`shrink-0 text-[11px] px-2.5 py-1 rounded-full font-semibold tracking-wide uppercase whitespace-nowrap ${getStatusColor(email.status)}`}>
                    {getStatusIcon(email.status)} {email.status}
                  </span>

                  {/* Subject + To + From */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm truncate">{email.subject}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-400 truncate mt-0.5">
                      <span className="truncate">To: {email.to_address}</span>
                      <span className="text-gray-600">&bull;</span>
                      <span className="truncate text-indigo-400/80">From: {email.from_address || 'scheduler@outbox.dev'}</span>
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div className="hidden md:block text-right shrink-0 text-xs text-gray-400">
                    {email.status === 'sent' && email.sent_at ? (
                      <span className="text-emerald-400/90 font-medium">Sent: {formatDate(email.sent_at)}</span>
                    ) : (
                      <span>Scheduled: {formatDate(email.scheduled_at)}</span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    {email.ethereal_url && (
                      <a
                        href={email.ethereal_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-indigo-300 hover:text-white bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 shadow-sm"
                      >
                        <span>👁</span>
                        <span className="hidden sm:inline">Preview</span>
                      </a>
                    )}
                    <button
                      onClick={() => setExpandedId(expandedId === email.id ? null : email.id)}
                      className="text-xs text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 px-2.5 py-1.5 rounded-lg transition-all"
                      title="Toggle details"
                    >
                      {expandedId === email.id ? '▲ Less' : '▼ Details'}
                    </button>
                    {email.status === 'scheduled' && (
                      <button
                        onClick={() => handleCancel(email.id)}
                        disabled={cancellingId === email.id}
                        className="text-xs text-red-300 hover:text-white bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-50"
                      >
                        {cancellingId === email.id ? '…' : '🗑 Cancel'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Details Panel */}
                {expandedId === email.id && (
                  <div className="border-t border-white/5 px-4 py-4 bg-black/40 fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="text-gray-500 uppercase tracking-widest text-[10px] font-semibold mb-1">Email ID</p>
                        <p className="font-mono text-gray-200 bg-white/5 px-2 py-1 rounded border border-white/5 break-all">{email.id}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 uppercase tracking-widest text-[10px] font-semibold mb-1">BullMQ Job ID</p>
                        <p className="font-mono text-gray-200 bg-white/5 px-2 py-1 rounded border border-white/5 break-all">{email.job_id ?? 'None'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 uppercase tracking-widest text-[10px] font-semibold mb-1">From (Sender)</p>
                        <p className="text-indigo-300 font-medium">{email.from_address || 'scheduler@outbox.dev'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 uppercase tracking-widest text-[10px] font-semibold mb-1">To (Recipient)</p>
                        <p className="text-gray-200">{email.to_address}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 uppercase tracking-widest text-[10px] font-semibold mb-1">Scheduled At (Target UTC)</p>
                        <p className="text-gray-200">{formatDate(email.scheduled_at)}</p>
                      </div>
                      {email.sent_at && (
                        <div>
                          <p className="text-gray-500 uppercase tracking-widest text-[10px] font-semibold mb-1">Sent At</p>
                          <p className="text-emerald-300">{formatDate(email.sent_at)}</p>
                        </div>
                      )}
                      {email.ethereal_url && (
                        <div className="col-span-1 md:col-span-2">
                          <p className="text-gray-500 uppercase tracking-widest text-[10px] font-semibold mb-1">Ethereal Email Web View</p>
                          <a
                            href={email.ethereal_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-400 hover:text-indigo-300 break-all underline underline-offset-2 flex items-center gap-1.5"
                          >
                            <span>🔗</span>
                            <span>{email.ethereal_url}</span>
                          </a>
                        </div>
                      )}
                      {email.error_message && (
                        <div className="col-span-1 md:col-span-2">
                          <p className="text-red-400 uppercase tracking-widest text-[10px] font-semibold mb-1">Failure Reason</p>
                          <p className="text-red-300 bg-red-500/10 p-2 rounded-lg border border-red-500/20">{email.error_message}</p>
                        </div>
                      )}
                      <div className="col-span-1 md:col-span-2">
                        <p className="text-gray-500 uppercase tracking-widest text-[10px] font-semibold mb-1">Email Body Content</p>
                        <div
                          className="bg-black/60 border border-white/10 rounded-xl p-3.5 text-gray-200 max-h-48 overflow-y-auto text-xs leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: email.body }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {meta && meta.pages > 1 && !isSearching && (
            <div className="flex items-center justify-between mt-5">
              <p className="text-xs text-gray-400">
                Showing {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
              </p>
              <div className="flex gap-1.5">
                <button
                  disabled={meta.page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="text-xs px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg transition-all disabled:opacity-30"
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
                        'text-xs w-8 h-8 rounded-lg font-medium transition-all',
                        p === meta.page
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                          : 'bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400',
                      ].join(' ')}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  disabled={meta.page >= meta.pages}
                  onClick={() => setPage((p) => p + 1)}
                  className="text-xs px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg transition-all disabled:opacity-30"
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
