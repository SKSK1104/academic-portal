export function DistributionBars({ items, max }: { items: Array<{ label: string; count: number; pct: number }>; max?: number }) {
  const peak = max || Math.max(1, ...items.map((x) => x.count));
  return <div className="distribution-list">
    {items.map((item) => <div className="distribution-row" key={item.label}>
      <div className="distribution-label">{item.label}</div>
      <div className="distribution-track"><div className="distribution-fill" style={{ width: `${(item.count / peak) * 100}%` }} /></div>
      <div className="distribution-value"><strong>{item.count}</strong><span>{item.pct.toFixed(1)}%</span></div>
    </div>)}
  </div>;
}
