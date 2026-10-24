'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { QueueStats as QueueStatsType } from '@/types/email';

interface StatCardProps {
  label: string;
  value: number;
  icon: string;
  color: string;
}

function StatCard({ label, value, icon, color }: StatCardProps) {
  return (
    <div className={`glass rounded-xl p-4 flex items-center gap-4 border border-white/5 hover:border-white/10 transition-all duration-200`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
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
    } catch (e) {
      setError('Could not reach backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass rounded-xl p-4 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
        <span>⚠️</span> {error} — make sure the backend is running on port 3001
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div>
      <p className="text-xs text-gray-500 mb-3 uppercase tracking-widest">Queue Statistics (live · refreshes every 5s)</p>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Delayed" value={stats.delayed} icon="⏳" color="bg-blue-500/10 text-blue-400" />
        <StatCard label="Waiting" value={stats.waiting} icon="📥" color="bg-yellow-500/10 text-yellow-400" />
        <StatCard label="Active" value={stats.active} icon="⚙️" color="bg-purple-500/10 text-purple-400" />
        <StatCard label="Completed" value={stats.completed} icon="✅" color="bg-emerald-500/10 text-emerald-400" />
        <StatCard label="Failed" value={stats.failed} icon="❌" color="bg-red-500/10 text-red-400" />
      </div>
    </div>
  );
}
