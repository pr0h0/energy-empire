import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

export function Card({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel p-3 ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-2 mb-2">
          <h3 className="font-semibold text-[1.02em]">{title}</h3>
          <div className="flex gap-1 flex-wrap justify-end">{actions}</div>
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, tone }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: 'good' | 'bad' | 'warn' }) {
  const c = tone === 'good' ? 'text-green-400' : tone === 'bad' ? 'text-red-400' : tone === 'warn' ? 'text-yellow-400' : '';
  return (
    <div className="panel2 px-2.5 py-1.5 min-w-0">
      <div className="muted text-[0.78em] uppercase tracking-wide truncate">{label}</div>
      <div className={`num font-semibold truncate ${c}`}>{value}</div>
      {sub && <div className="muted text-[0.78em] truncate">{sub}</div>}
    </div>
  );
}

export function Progress({ value, color, label }: { value: number; color?: string; label?: string }) {
  return (
    <div className="bar" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; disabled?: boolean }) {
  return (
    <label className={`flex items-center justify-between gap-3 py-1 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <span>{label}</span>
      <input type="checkbox" className="w-4 h-4 accent-amber-500" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function Slider({ value, min, max, step = 0.01, onChange, label, format, disabled }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; label: ReactNode; format?: (v: number) => string; disabled?: boolean }) {
  return (
    <label className="block py-1">
      <div className="flex justify-between gap-2">
        <span>{label}</span>
        <span className="num muted">{format ? format(value) : value}</span>
      </div>
      <input type="range" className="w-full" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} aria-label={typeof label === 'string' ? label : undefined} />
    </label>
  );
}

export function Select<T extends string>({ value, options, onChange, label, disabled }: { value: T; options: { value: T; label: string; disabled?: boolean }[]; onChange: (v: T) => void; label?: string; disabled?: boolean }) {
  return (
    <select className="input" value={value} aria-label={label} disabled={disabled} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Chip({ children, tone }: { children: ReactNode; tone?: 'good' | 'bad' | 'warn' | 'info' }) {
  return <span className={`chip ${tone ? `chip-${tone}` : ''}`}>{children}</span>;
}

export function Modal({ title, onClose, children, wide, footer }: { title: ReactNode; onClose?: () => void; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3" role="dialog" aria-modal="true">
      <div ref={ref} tabIndex={-1} className={`panel w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] flex flex-col shadow-2xl outline-none`}>
        <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <h2 className="font-bold text-[1.1em]">{title}</h2>
          {onClose && (
            <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          )}
        </header>
        <div className="p-4 scroll">{children}</div>
        {footer && <footer className="px-4 py-3 border-t border-[var(--border)] flex justify-end gap-2 flex-wrap">{footer}</footer>}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ value, tabs, onChange }: { value: T; tabs: { id: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 flex-wrap" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} className={`btn btn-sm ${value === t.id ? 'active' : ''}`} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Row({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="muted">{k}</span>
      <span className="num text-right">{v}</span>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="muted text-center py-6">{children}</div>;
}
