import { CheckCircle, RefreshCw, XCircle } from 'lucide-react';

export default function Badge({ status }) {
  const styles = {
    active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    syncing: 'bg-blue-100 text-blue-700 border-blue-200',
    error: 'bg-rose-100 text-rose-700 border-rose-200',
    inactive: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  const icons = { active: CheckCircle, syncing: RefreshCw, error: XCircle, inactive: XCircle };
  const Icon = icons[status] || icons.inactive;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] || styles.inactive}`}>
      <Icon size={12} className={`mr-1.5 ${status === 'syncing' ? 'animate-spin' : ''}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}