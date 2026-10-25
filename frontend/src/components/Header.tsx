export default function Header() {
  const getQueueDashboardUrl = (): string => {
    if (import.meta.env.VITE_API_URL) {
      return import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') + '/admin/queues';
    }
    if (
      typeof window !== 'undefined' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      return 'https://outbox-2cqf.onrender.com/admin/queues';
    }
    return 'http://localhost:3001/admin/queues';
  };

  const queueDashboardUrl = getQueueDashboardUrl();

  return (
    <header className="border-b border-white/5 bg-[#0e0e15]/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo + Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 ring-1 ring-white/20">
            <span className="text-xl">📬</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold gradient-text leading-tight tracking-tight">
                Outbox
              </h1>
              <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                React.js
              </span>
              <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 hidden sm:inline">
                Elasticsearch
              </span>
            </div>
            <p className="text-xs text-gray-400">High-Reliability Email Scheduler Service</p>
          </div>
        </div>

        {/* Live Status & BullMQ Dashboard Link */}
        <div className="flex items-center gap-3">
          <a
            href={queueDashboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300 hover:text-white bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 hover:border-indigo-400/50 px-3 py-1.5 rounded-full transition-all shadow-sm"
            title="Open Live BullMQ Dashboard UI"
          >
            <span>📊</span>
            <span>BullMQ Dashboard</span>
            <span className="text-[10px] opacity-70">↗</span>
          </a>

          <div className="hidden md:flex items-center gap-2 text-xs text-gray-300 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="font-medium text-emerald-400">Active</span>
          </div>
        </div>
      </div>
    </header>
  );
}
