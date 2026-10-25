import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { QueueStats as QueueStatsType } from '../types/email';

interface StatCardProps {
  label: string;
  value: number;
  icon: string;
  color: string;
  borderHover: string;
}

function StatCard({ label, value, icon, color, borderHover }: StatCardProps) {
  return (
    <div className={`glass rounded-2xl p-4 flex items-center gap-4 border border-white/5 ${borderHover} transition-all duration-300 hover:scale-[1.02] shadow-sm`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-extrabold text-white tracking-tight">{value}</p>
        <p className="text-xs font-medium text-gray-400 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export default function QueueStats() {
  const [stats, setStats] = useState<QueueStatsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const res = await api.getQueueStats();
      setStats(res.data);
      setError(null);
    } catch {
      setError('Could not reach backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 4000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-20 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass rounded-xl p-4 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
        <span>⚠️</span> {error} — backend is waking up or connecting
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
          BullMQ Queue Monitor
        </p>
        <span className="text-[11px] text-gray-500">Live · polling every 4s</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Delayed" value={stats.delayed} icon="⏳" color="bg-blue-500/10 text-blue-400 border border-blue-500/20" borderHover="hover:border-blue-500/40" />
        <StatCard label="Waiting" value={stats.waiting} icon="📥" color="bg-amber-500/10 text-amber-400 border border-amber-500/20" borderHover="hover:border-amber-500/40" />
        <StatCard label="Active" value={stats.active} icon="⚙️" color="bg-purple-500/10 text-purple-400 border border-purple-500/20" borderHover="hover:border-purple-500/40" />
        <StatCard label="Completed" value={stats.completed} icon="✅" color="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" borderHover="hover:border-emerald-500/40" />
        <StatCard label="Failed" value={stats.failed} icon="❌" color="bg-red-500/10 text-red-400 border border-red-500/20" borderHover="hover:border-red-500/40" />
      </div>
    </div>
  );
}
