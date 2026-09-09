import type { LucideIcon } from 'lucide-react';

export function StatCard({ label, value, hint, icon: Icon, tone = 'blue' }: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: 'blue' | 'green' | 'red' | 'amber' | 'purple';
}) {
  return <div className={`stat-card tone-${tone}`}>
    <div className="stat-head"><span>{label}</span><Icon size={18} /></div>
    <div className="stat-value">{value}</div>
    {hint && <div className="stat-hint">{hint}</div>}
  </div>;
}
