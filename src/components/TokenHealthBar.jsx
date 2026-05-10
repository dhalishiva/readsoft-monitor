import { Bell, Info } from 'lucide-react';

export default function TokenHealthBar({ mailbox }) {
  const TOTAL_DAYS = 90;
  let expiryDate;
  let isManual = false;

  if (mailbox.token_expiry_type === 'manual' && mailbox.token_expires_at) {
    isManual = true;
    expiryDate = new Date(mailbox.token_expires_at);
  } else {
    const generated = new Date(mailbox.token_generated_at);
    expiryDate = new Date(generated.getTime() + TOTAL_DAYS * 24 * 60 * 60 * 1000);
  }

  const msRemaining = expiryDate - new Date();
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
  const percentage = Math.min(100, Math.max(0, (daysRemaining / TOTAL_DAYS) * 100));

  let colorClass = 'bg-emerald-500';
  if (percentage < 50) colorClass = 'bg-yellow-500';
  if (percentage < 20) colorClass = 'bg-red-500';

  const isUrgent = daysRemaining <= 7;

  return (
    <div className="mt-4 space-y-2">
      <div className="flex justify-between text-xs font-medium">
        <span className="text-slate-500 flex items-center gap-1">
          Token Health {isManual && <Info size={12} className="text-slate-400" />}
        </span>
        <span className={isUrgent ? 'text-red-600 animate-pulse' : 'text-slate-700'}>
          {daysRemaining} days remaining
        </span>
      </div>
      <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${colorClass}`} style={{ width: `${percentage}%` }} />
      </div>
      {isUrgent && (
        <div className="flex items-center gap-2 text-xs text-red-600 mt-1">
          <Bell size={12} />
          <span>Expiring soon — regenerate now.</span>
        </div>
      )}
    </div>
  );
}