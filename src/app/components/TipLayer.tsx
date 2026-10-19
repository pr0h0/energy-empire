import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * App-wide styled tooltip for any element with `data-tip` (replaces native `title`).
 * One delegated listener; `data-tip-side="right"` places it beside the element instead of below.
 */
export function TipLayer() {
  const [tip, setTip] = useState<{ text: string; r: DOMRect; side: string } | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const show = (e: Event) => {
      const el = (e.target as Element | null)?.closest?.('[data-tip]');
      const text = el?.getAttribute('data-tip');
      setTip(el && text ? { text, r: el.getBoundingClientRect(), side: el.getAttribute('data-tip-side') ?? 'below' } : null);
    };
    const hide = () => setTip(null);
    document.addEventListener('pointerover', show);
    document.addEventListener('focusin', show);
    document.addEventListener('pointerdown', hide);
    document.addEventListener('keydown', hide);
    window.addEventListener('scroll', hide, true);
    return () => {
      document.removeEventListener('pointerover', show);
      document.removeEventListener('focusin', show);
      document.removeEventListener('pointerdown', hide);
      document.removeEventListener('keydown', hide);
      window.removeEventListener('scroll', hide, true);
    };
  }, []);
  useLayoutEffect(() => {
    if (!tip || !ref.current) return setPos(null);
    const w = ref.current.offsetWidth, h = ref.current.offsetHeight, vw = window.innerWidth, vh = window.innerHeight, r = tip.r;
    let left = tip.side === 'right' ? r.right + 8 : r.left + r.width / 2 - w / 2;
    let top = tip.side === 'right' ? r.top + r.height / 2 - h / 2 : r.bottom + 6;
    if (top + h > vh - 8) top = r.top - h - 6; // flip above near the bottom edge
    left = Math.max(8, Math.min(left, vw - w - 8));
    top = Math.max(8, top);
    setPos({ left, top });
  }, [tip]);
  if (!tip) return null;
  return (
    <div
      ref={ref}
      role="tooltip"
      data-testid="tip"
      className="fixed z-[100] panel px-2 py-1 shadow-xl text-[0.85em] max-w-xs whitespace-pre-line leading-snug pointer-events-none"
      style={pos ?? { left: -9999, top: -9999 }}
    >
      {tip.text}
    </div>
  );
}
