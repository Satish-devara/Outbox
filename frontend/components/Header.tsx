export default function Header() {
  return (
    <header className="border-b border-white/5 bg-black/20 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo + Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <span className="text-lg">📬</span>
          </div>
          <div>
            <h1 className="text-lg font-bold gradient-text leading-tight">
              Outbox
            </h1>
            <p className="text-xs text-gray-500">Email Scheduler</p>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          Powered by BullMQ + Redis
        </div>
      </div>
    </header>
  );
}
