export function timeAgo(date) {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 0) return d.toLocaleString();

  const intervals = [
    { label: 'year', sec: 31536000 },
    { label: 'month', sec: 2592000 },
    { label: 'day', sec: 86400 },
    { label: 'hour', sec: 3600 },
    { label: 'minute', sec: 60 },
  ];

  for (const { label, sec } of intervals) {
    const v = Math.floor(seconds / sec);
    if (v >= 1) return `${v} ${label}${v > 1 ? 's' : ''} ago`;
  }
  return seconds < 10 ? 'just now' : `${seconds} seconds ago`;
}

export function formatFull(date) {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString();
}