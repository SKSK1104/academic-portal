import { AlertTriangle } from 'lucide-react';

export function InterventionPanel({ title = 'Memerlukan Intervensi', count, percentage, rule, children }: {
  title?: string;
  count: number;
  percentage: number;
  rule: string;
  children?: React.ReactNode;
}) {
  return <section className="intervention-card">
    <div className="intervention-icon"><AlertTriangle /></div>
    <div className="intervention-body">
      <div className="intervention-title">{title}</div>
      <div className="intervention-number">{count} <small>murid</small></div>
      <div className="intervention-meta">{percentage.toFixed(1)}% • {rule}</div>
      {children}
    </div>
  </section>;
}
