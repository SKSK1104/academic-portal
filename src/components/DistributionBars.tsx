const BAR_COLORS = [
  ['#28cfa0', '#63efc2'],
  ['#23bfe8', '#53e1ff'],
  ['#4779ff', '#6ca1ff'],
  ['#825dff', '#b18cff'],
  ['#f28a32', '#ffb45f'],
  ['#f65379', '#ff809b'],
  ['#6f8196', '#9aabc0'],
];

export function DistributionBars({ items, max }: { items: Array<{ label: string; count: number; pct: number }>; max?: number }) {
  const peak = max || Math.max(1, ...items.map((x) => x.count));
  return <div className="distribution-list">
    {items.map((item, index) => {
      const [from, to] = BAR_COLORS[index % BAR_COLORS.length];
      return <div className="distribution-row" key={item.label}>
        <div className="distribution-label">{item.label}</div>
        <div className="distribution-track"><div className="distribution-fill" style={{ width: `${(item.count / peak) * 100}%`, background: `linear-gradient(90deg, ${from}, ${to})` }} /></div>
        <div className="distribution-value"><strong>{item.count}</strong><span>{item.pct.toFixed(1)}%</span></div>
      </div>;
    })}
  </div>;
}
