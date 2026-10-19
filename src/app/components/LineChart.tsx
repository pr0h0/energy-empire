import { useState } from 'react';
import { formatClock } from '../../engine/core/GameClock';

export interface Series {
  name: string;
  color: string;
  points: [number, number][];
}

/** Small dependency-free SVG line chart over real recorded/forecast data. */
export function LineChart({ series, height = 160, format = (v: number) => v.toPrecision(3), log = false }: { series: Series[]; height?: number; format?: (v: number) => string; log?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const all = series.flatMap((s) => s.points);
  if (all.length < 2) return <div className="muted text-center py-6 text-[0.9em]">Not enough data yet — history is sampled every game hour.</div>;
  const W = 600, H = height, P = 6, L = 54;
  const tx = all.map((p) => p[0]);
  const t0 = Math.min(...tx), t1 = Math.max(...tx);
  const tr = (v: number) => (log ? Math.log10(Math.max(1e-30, Math.abs(v))) * Math.sign(v || 1) : v);
  const ys = all.map((p) => tr(p[1]));
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (y1 - y0 < 1e-12) {
    y0 -= 1;
    y1 += 1;
  }
  const X = (t: number) => L + ((t - t0) / Math.max(1e-9, t1 - t0)) * (W - L - P);
  const Y = (v: number) => H - P - ((tr(v) - y0) / (y1 - y0)) * (H - 2 * P);
  const inv = (yy: number) => y0 + ((H - P - yy) / (H - 2 * P)) * (y1 - y0);
  const ticks = [0, 0.5, 1].map((k) => P + k * (H - 2 * P));
  const hv = hover !== null ? t0 + ((hover - L) / (W - L - P)) * (t1 - t0) : null;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} role="img" aria-label={`Chart: ${series.map((s) => s.name).join(', ')}`}
        onMouseMove={(e) => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); setHover(((e.clientX - r.left) / r.width) * W); }} onMouseLeave={() => setHover(null)}>
        {ticks.map((yy) => (
          <g key={yy}>
            <line x1={L} x2={W - P} y1={yy} y2={yy} stroke="var(--border)" strokeDasharray="3 3" />
            <text x={L - 4} y={yy + 3} textAnchor="end" fontSize="10" fill="var(--muted)">{format(log ? Math.sign(inv(yy)) * 10 ** Math.abs(inv(yy)) : inv(yy))}</text>
          </g>
        ))}
        {series.map((s) => (
          <polyline key={s.name} fill="none" stroke={s.color} strokeWidth="1.8" points={s.points.map((p) => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ')} />
        ))}
        {hv !== null && hover! >= L && <line x1={hover!} x2={hover!} y1={P} y2={H - P} stroke="var(--muted)" />}
      </svg>
      <div className="flex flex-wrap gap-3 text-[0.82em] mt-0.5">
        {series.map((s) => {
          const near = hv !== null ? s.points.reduce((a, p) => (Math.abs(p[0] - hv) < Math.abs(a[0] - hv) ? p : a), s.points[0]) : s.points[s.points.length - 1];
          return <span key={s.name}><span style={{ color: s.color }}>■</span> {s.name}: <span className="num">{near ? format(near[1]) : '—'}</span></span>;
        })}
        {hv !== null && <span className="muted num">{formatClock(hv)}</span>}
      </div>
    </div>
  );
}
