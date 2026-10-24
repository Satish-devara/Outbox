export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'scheduled':
      return 'bg-blue-500/20 text-blue-300 border border-blue-500/30';
    case 'sent':
      return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
    case 'failed':
      return 'bg-red-500/20 text-red-300 border border-red-500/30';
    case 'cancelled':
      return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400';
  }
}

export function getStatusIcon(status: string): string {
  switch (status) {
    case 'scheduled': return '⏰';
    case 'sent': return '✅';
    case 'failed': return '❌';
    case 'cancelled': return '🚫';
    default: return '❓';
  }
}
