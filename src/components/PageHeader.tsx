import type { ReactNode } from 'react';

export function PageHeader({ eyebrow, title, actions }: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return <div className="page-header">
    <div>
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h1>{title}</h1>
    </div>
    {actions && <div className="page-actions">{actions}</div>}
  </div>;
}
