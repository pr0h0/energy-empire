import type { TerrainId } from '../engine/data/types';

/**
 * Hand-authored SVG illustrations (64×64 viewBox) for every building family and a subtle pattern
 * symbol for every terrain type. Everything is local — no external assets. Shapes are simple so
 * they remain legible at small zoom levels; a shared palette keeps the art direction coherent.
 */
const O = '#0f172a'; // outline
const M = '#94a3b8'; // metal
const MD = '#64748b';
const C = '#cbd5e1'; // concrete
const W = '#e2e8f0';

/** Animation frames per animated art/terrain; frame 0 is the static pose used in icons. */
export const FRAMES = 4;

const svg = (body: string, bg = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${bg}${body}</svg>`;

function panel(x: number, y: number, w: number, h: number, color = '#2563eb', skew = 6) {
  const cols = 4, rows = 3;
  let lines = '';
  for (let i = 1; i < cols; i++) {
    const t = i / cols;
    lines += `<line x1="${x + skew + w * t}" y1="${y}" x2="${x + w * t}" y2="${y + h}" stroke="#93c5fd" stroke-width="0.8"/>`;
  }
  for (let j = 1; j < rows; j++) {
    const t = j / rows;
    lines += `<line x1="${x + skew * (1 - t)}" y1="${y + h * t}" x2="${x + w + skew * (1 - t)}" y2="${y + h * t}" stroke="#93c5fd" stroke-width="0.8"/>`;
  }
  return `<polygon points="${x + skew},${y} ${x + w + skew},${y} ${x + w},${y + h} ${x},${y + h}" fill="${color}" stroke="${O}" stroke-width="1.5"/>${lines}`;
}

function turbine(cx: number, base: number, top: number, r: number, color = W, rot = 0) {
  const hub = `<circle cx="${cx}" cy="${top}" r="${Math.max(1.6, r * 0.12)}" fill="${color}" stroke="${O}" stroke-width="1"/>`;
  const blade = (a: number) => {
    const rad = (a * Math.PI) / 180;
    const x2 = cx + Math.cos(rad) * r, y2 = top + Math.sin(rad) * r;
    return `<line x1="${cx}" y1="${top}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${O}" stroke-width="${Math.max(2.4, r * 0.18)}" stroke-linecap="round"/><line x1="${cx}" y1="${top}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="${Math.max(1.2, r * 0.1)}" stroke-linecap="round"/>`;
  };
  return `<path d="M${cx - 1.6} ${base} L${cx - 0.7} ${top} L${cx + 0.7} ${top} L${cx + 1.6} ${base}Z" fill="${color}" stroke="${O}" stroke-width="1"/>${blade(rot - 90)}${blade(rot + 30)}${blade(rot + 150)}${hub}`;
}

function puffs(x: number, y: number, f: number, n = 3, rise = 12, drift = 6, r0 = 2.5) {
  let out = '';
  for (let k = 0; k < n; k++) {
    const t = (k + f / FRAMES) / n;
    out += `<circle cx="${(x + t * drift).toFixed(1)}" cy="${(y - t * rise).toFixed(1)}" r="${(r0 + t * 3).toFixed(1)}" fill="#e2e8f0" opacity="${(0.85 * (1 - t)).toFixed(2)}"/>`;
  }
  return out;
}

function stack(x: number, y: number, w: number, h: number, smoke = true, f = 0) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${MD}" stroke="${O}" stroke-width="1.4"/><rect x="${x}" y="${y + 3}" width="${w}" height="2" fill="#ef4444"/>${smoke ? puffs(x + w / 2 + 1, y - 2, f) : ''}`;
}

function coolingTower(x: number, y: number, w: number, h: number, f = 0) {
  return `<path d="M${x} ${y + h} Q${x + w * 0.3} ${y + h * 0.45} ${x + w * 0.15} ${y} L${x + w * 0.85} ${y} Q${x + w * 0.7} ${y + h * 0.45} ${x + w} ${y + h}Z" fill="${C}" stroke="${O}" stroke-width="1.4"/><ellipse cx="${x + w / 2}" cy="${y}" rx="${w * 0.35}" ry="2" fill="#94a3b8" stroke="${O}" stroke-width="1"/>${puffs(x + w * 0.4, y - 2, f, 3, 10, 5, 3)}`;
}

function hall(x: number, y: number, w: number, h: number, color = C) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}" stroke="${O}" stroke-width="1.4"/><rect x="${x + 3}" y="${y + h - 7}" width="5" height="7" fill="${MD}"/>`;
}

function star(cx: number, cy: number, r: number, color = '#fbbf24') {
  return `<circle cx="${cx}" cy="${cy}" r="${r + 4}" fill="${color}" opacity="0.25"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" stroke="#f59e0b" stroke-width="1.2"/>`;
}

function collectorChip(x: number, y: number, s = 6, a = 0) {
  return `<rect x="${x - s / 2}" y="${y - s / 3}" width="${s}" height="${s / 1.5}" fill="#3b82f6" stroke="${O}" stroke-width="0.8" transform="rotate(${a} ${x} ${y})"/>`;
}

function battery(x: number, y: number, w: number, h: number, color = '#22c55e') {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#1f2937" stroke="${O}" stroke-width="1.5"/><rect x="${x + w * 0.35}" y="${y - 3}" width="${w * 0.3}" height="3" fill="${M}" stroke="${O}"/><rect x="${x + 3}" y="${y + h * 0.45}" width="${w - 6}" height="${h * 0.48}" rx="1.5" fill="${color}"/><path d="M${x + w / 2 + 2} ${y + 4} l-5 ${h * 0.35} h4 l-3 ${h * 0.3}" fill="none" stroke="#fde047" stroke-width="2"/>`;
}

const ART: Record<string, string> = {
  house: svg(`<polygon points="8,30 32,10 56,30" fill="#b45309" stroke="${O}" stroke-width="2"/><rect x="13" y="30" width="38" height="26" fill="#fde68a" stroke="${O}" stroke-width="2"/><rect x="28" y="40" width="9" height="16" fill="#78350f"/><rect x="16" y="35" width="8" height="7" fill="#93c5fd" stroke="${O}"/><rect x="41" y="35" width="8" height="7" fill="#93c5fd" stroke="${O}"/><rect x="42" y="14" width="5" height="10" fill="#7c2d12" stroke="${O}"/>`),
  pv: svg(`${panel(8, 18, 44, 26)}<line x1="20" y1="44" x2="20" y2="54" stroke="${O}" stroke-width="2"/><line x1="44" y1="44" x2="44" y2="54" stroke="${O}" stroke-width="2"/>`),
  pv2: svg(`${panel(7, 16, 46, 28, '#1e3a8a')}<path d="M11 18 l5 0" stroke="#fde047" stroke-width="2"/><line x1="20" y1="44" x2="20" y2="54" stroke="${O}" stroke-width="2"/><line x1="44" y1="44" x2="44" y2="54" stroke="${O}" stroke-width="2"/>`),
  pv_farm: svg(`${panel(4, 8, 24, 14)}${panel(34, 8, 24, 14)}${panel(4, 28, 24, 14)}${panel(34, 28, 24, 14)}${panel(4, 48, 24, 12)}${panel(34, 48, 24, 12)}`),
  pv_farm2: svg(`${panel(4, 8, 24, 14, '#1e3a8a')}${panel(34, 8, 24, 14, '#1e3a8a')}${panel(4, 28, 24, 14, '#1e3a8a')}${panel(34, 28, 24, 14, '#1e3a8a')}<rect x="24" y="48" width="16" height="12" fill="${M}" stroke="${O}" stroke-width="1.3"/><path d="M30 50 l-3 5 h4 l-2 4" stroke="#fde047" stroke-width="1.6" fill="none"/>`),
  pv_belt: svg(`<circle cx="32" cy="32" r="26" fill="#1e40af" stroke="${O}" stroke-width="2"/><path d="M6 32 Q32 20 58 32 Q32 44 6 32Z" fill="#60a5fa" stroke="${O}" stroke-width="1.2"/><path d="M10 32 H54" stroke="#bfdbfe" stroke-width="1.2" stroke-dasharray="3 2"/>`),
  csp: svg(`<rect x="29" y="8" width="6" height="40" fill="${C}" stroke="${O}" stroke-width="1.4"/><circle cx="32" cy="10" r="5" fill="#f97316" stroke="${O}" stroke-width="1.2"/><circle cx="32" cy="10" r="9" fill="#fb923c" opacity="0.3"/>${[10, 20, 44, 54].map((x) => `<rect x="${x - 4}" y="50" width="8" height="5" fill="#bae6fd" stroke="${O}" stroke-width="0.8"/>`).join('')}${[14, 50].map((x) => `<rect x="${x - 4}" y="40" width="8" height="5" fill="#bae6fd" stroke="${O}" stroke-width="0.8"/>`).join('')}<path d="M10 50 L31 12 M54 50 L33 12" stroke="#fde047" stroke-width="0.8" opacity="0.8"/>`),
  orbital_solar: svg(`<circle cx="32" cy="34" r="12" fill="none" stroke="#a5b4fc" stroke-width="1" stroke-dasharray="2 2"/>${panel(4, 10, 20, 12)}${panel(40, 10, 20, 12)}<rect x="24" y="12" width="16" height="8" fill="${M}" stroke="${O}"/><path d="M32 22 L26 56 H38 Z" fill="#fde047" opacity="0.35"/><rect x="18" y="54" width="28" height="6" fill="${MD}" stroke="${O}"/>`),
  collector: svg(`<circle cx="32" cy="32" r="24" fill="none" stroke="#a5b4fc" stroke-width="1" stroke-dasharray="3 3"/>${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => collectorChip(32 + 24 * Math.cos((a * Math.PI) / 180), 32 + 24 * Math.sin((a * Math.PI) / 180), 9, a + 90)).join('')}${panel(20, 24, 22, 14)}`),
  stellar_array: svg(`${star(10, 32, 9, '#f97316')}${[18, 30, 42].map((y, i) => `<rect x="${34 + i * 4}" y="${y - 6}" width="18" height="10" fill="#1d4ed8" stroke="${O}" stroke-width="1"/><rect x="${34 + i * 4}" y="${y - 6}" width="3" height="10" fill="#f8fafc"/>`).join('')}`),
  dyson: svg(`${star(32, 32, 10)}${[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a, i) => collectorChip(32 + (19 + (i % 2) * 6) * Math.cos((a * Math.PI) / 180), 32 + (19 + (i % 2) * 6) * Math.sin((a * Math.PI) / 180), 6, a)).join('')}<ellipse cx="32" cy="32" rx="22" ry="8" fill="none" stroke="#c4b5fd" stroke-width="0.8"/>`),
  swarm_net: svg(`${[[16, 18], [46, 20], [30, 44], [52, 48], [12, 50]].map(([x, y]) => `${star(x, y, 4)}<circle cx="${x}" cy="${y}" r="8" fill="none" stroke="#93c5fd" stroke-width="1.2" stroke-dasharray="2 1.5"/>`).join('')}<path d="M16 18 L46 20 L30 44 L52 48 M30 44 L12 50" stroke="#a78bfa" stroke-width="0.8"/>`),
  matrioshka: svg(`${star(32, 32, 6)}<circle cx="32" cy="32" r="13" fill="none" stroke="#60a5fa" stroke-width="3" stroke-dasharray="4 2"/><circle cx="32" cy="32" r="20" fill="none" stroke="#3b82f6" stroke-width="3" stroke-dasharray="5 2"/><circle cx="32" cy="32" r="27" fill="none" stroke="#1d4ed8" stroke-width="3" stroke-dasharray="6 2"/>`),
  galactic_node: svg(`<ellipse cx="32" cy="32" rx="26" ry="10" fill="#4338ca" opacity="0.5" stroke="#a5b4fc"/><path d="M8 32 Q32 12 56 32 Q32 52 8 32" fill="none" stroke="#c4b5fd" stroke-width="1.5"/>${star(32, 32, 5, '#fef3c7')}<rect x="24" y="44" width="16" height="10" fill="${M}" stroke="${O}"/><path d="M32 44 V36" stroke="#fde047" stroke-width="2"/>`),
  kite: svg(`<path d="M18 10 L46 16 L40 26 L12 20Z" fill="#f97316" stroke="${O}" stroke-width="1.4"/><path d="M30 22 Q34 40 28 58" stroke="${O}" stroke-width="1" fill="none" stroke-dasharray="2 1.5"/><rect x="22" y="56" width="12" height="6" fill="${M}" stroke="${O}"/><path d="M8 34 q8 -3 16 0" stroke="#bae6fd" fill="none" stroke-width="2"/>`),
  plantation: svg(`<rect x="2" y="2" width="60" height="60" fill="#3f6212" opacity="0.4"/>${[10, 22, 34, 46, 58].map((x) => [12, 28, 44, 58].map((y) => `<path d="M${x} ${y} l-4 6 h8 Z" fill="#65a30d" stroke="#1a2e05" stroke-width="0.8"/>`).join('')).join('')}`),
  smr: svg(`<rect x="14" y="26" width="36" height="30" rx="4" fill="${C}" stroke="${O}" stroke-width="1.6"/><path d="M14 30 Q32 14 50 30" fill="#e2e8f0" stroke="${O}" stroke-width="1.6"/><circle cx="32" cy="40" r="7" fill="#fde047" stroke="${O}"/><path d="M32 40 l0 -6 M32 40 l5 3 M32 40 l-5 3" stroke="${O}" stroke-width="2.4"/>`),
  msr: svg(`<rect x="8" y="22" width="48" height="34" rx="6" fill="${C}" stroke="${O}" stroke-width="1.6"/><path d="M14 40 q9 -10 18 0 t18 0" stroke="#f97316" stroke-width="4" fill="none"/><circle cx="32" cy="30" r="4" fill="#fde047" stroke="${O}"/><rect x="26" y="10" width="12" height="12" fill="${M}" stroke="${O}"/>`),
  fusion: svg(`<ellipse cx="32" cy="36" rx="26" ry="16" fill="#334155" stroke="${O}" stroke-width="2"/><ellipse cx="32" cy="36" rx="16" ry="8" fill="#0f172a" stroke="#a855f7" stroke-width="3"/><ellipse cx="32" cy="36" rx="16" ry="8" fill="none" stroke="#f0abfc" stroke-width="1"/>${[10, 22, 42, 54].map((x) => `<rect x="${x - 2}" y="18" width="4" height="36" fill="${M}" stroke="${O}" stroke-width="0.8"/>`).join('')}`),
  stellarator: svg(`<path d="M10 36 C10 18 30 18 32 30 C34 42 54 42 54 28 C54 50 34 50 32 38 C30 26 10 26 10 36Z" fill="none" stroke="#a855f7" stroke-width="5"/><path d="M10 36 C10 18 30 18 32 30 C34 42 54 42 54 28" fill="none" stroke="#f0abfc" stroke-width="1.5"/>${[14, 26, 38, 50].map((x) => `<circle cx="${x}" cy="33" r="5" fill="none" stroke="${M}" stroke-width="2.5"/>`).join('')}`),
  orbital_fusion: svg(`<circle cx="32" cy="32" r="12" fill="#334155" stroke="#a855f7" stroke-width="3"/><circle cx="32" cy="32" r="5" fill="#f0abfc"/><rect x="2" y="28" width="16" height="8" fill="#e5e7eb" stroke="${O}"/><rect x="46" y="28" width="16" height="8" fill="#e5e7eb" stroke="${O}"/><path d="M4 30 h12 M48 30 h12" stroke="#ef4444" stroke-width="1"/>`),
  lunar: svg(`<circle cx="32" cy="40" r="26" fill="#9ca3af" stroke="${O}" stroke-width="1.5"/><circle cx="22" cy="44" r="5" fill="#6b7280"/><circle cx="40" cy="52" r="4" fill="#6b7280"/>${panel(18, 10, 28, 14)}<path d="M32 24 V30" stroke="${O}" stroke-width="2"/>`),
  pulsar: svg(`<circle cx="32" cy="32" r="6" fill="#67e8f9" stroke="#0e7490" stroke-width="2"/><path d="M32 26 L22 2 L42 2Z M32 38 L22 62 L42 62Z" fill="#a5f3fc" opacity="0.5"/><circle cx="32" cy="32" r="16" fill="none" stroke="#22d3ee" stroke-width="2" stroke-dasharray="3 3"/><circle cx="32" cy="32" r="24" fill="none" stroke="#0891b2" stroke-width="2" stroke-dasharray="4 4"/>`),
  accretion: svg(`<ellipse cx="32" cy="32" rx="28" ry="10" fill="#f97316" opacity="0.6"/><ellipse cx="32" cy="32" rx="18" ry="6" fill="#fde047" opacity="0.8"/><circle cx="32" cy="32" r="7" fill="#020617" stroke="#f97316" stroke-width="1.5"/><path d="M32 22 V2 M32 42 V62" stroke="#c4b5fd" stroke-width="3" opacity="0.7"/>`),
  quasar: svg(`<circle cx="32" cy="32" r="9" fill="#fdf2f8" stroke="#db2777" stroke-width="2"/><path d="M28 24 L14 0 H50 L36 24Z M28 40 L14 64 H50 L36 40Z" fill="#f472b6" opacity="0.45"/><rect x="40" y="6" width="14" height="8" fill="${M}" stroke="${O}"/><path d="M40 10 H34" stroke="#fde047" stroke-width="2"/>`),
  penrose: svg(`<circle cx="32" cy="32" r="12" fill="#020617" stroke="#6366f1" stroke-width="2"/><ellipse cx="32" cy="32" rx="22" ry="22" fill="none" stroke="#818cf8" stroke-width="2" stroke-dasharray="5 3"/><path d="M50 14 A26 26 0 0 1 58 36" stroke="#fde047" stroke-width="3" fill="none"/><path d="M54 36 l4 0 l0 -4" stroke="#fde047" stroke-width="2" fill="none"/>`),
  vacuum: svg(`<rect x="10" y="10" width="44" height="44" fill="none" stroke="#6366f1" stroke-width="2" stroke-dasharray="3 2"/><circle cx="32" cy="32" r="10" fill="#0f172a" stroke="#e879f9" stroke-width="2"/>${[0, 60, 120, 180, 240, 300].map((a) => `<circle cx="${32 + 16 * Math.cos((a * Math.PI) / 180)}" cy="${32 + 16 * Math.sin((a * Math.PI) / 180)}" r="2.5" fill="#f0abfc"/>`).join('')}`),
  battery: svg(battery(16, 14, 32, 42)),
  battery_big: svg(`${battery(4, 14, 26, 40)}${battery(34, 14, 26, 40, '#16a34a')}`),
  pumped: svg(`<path d="M0 64 L24 18 L40 30 L64 12 V64Z" fill="#78716c" stroke="${O}" stroke-width="1.4"/><ellipse cx="50" cy="16" rx="10" ry="4" fill="#2563eb" stroke="${O}"/><rect x="0" y="52" width="26" height="12" fill="#1d4ed8" opacity="0.8"/><path d="M44 18 L20 54" stroke="${M}" stroke-width="4"/><path d="M44 18 L20 54" stroke="#93c5fd" stroke-width="1.5" stroke-dasharray="3 2"/>`),
  caes: svg(`<path d="M0 30 Q32 6 64 30 V64 H0Z" fill="#a16207" opacity="0.5" stroke="${O}"/><ellipse cx="32" cy="48" rx="20" ry="9" fill="#fef3c7" stroke="${O}" stroke-width="1.4"/>${hall(22, 18, 20, 12, M)}<path d="M32 30 V40" stroke="${O}" stroke-width="3"/>`),
  flow: svg(`<rect x="6" y="18" width="18" height="38" rx="3" fill="#7c3aed" stroke="${O}" stroke-width="1.4"/><rect x="40" y="18" width="18" height="38" rx="3" fill="#0891b2" stroke="${O}" stroke-width="1.4"/><rect x="26" y="30" width="12" height="18" fill="${M}" stroke="${O}"/><path d="M24 26 H40 M24 50 H40" stroke="${O}" stroke-width="2"/>`),
  smes: svg(`<circle cx="32" cy="32" r="24" fill="none" stroke="#38bdf8" stroke-width="7"/><circle cx="32" cy="32" r="24" fill="none" stroke="${O}" stroke-width="1"/><circle cx="32" cy="32" r="8" fill="${M}" stroke="${O}"/><path d="M33 26 l-4 7 h4 l-3 6" stroke="#fde047" stroke-width="2" fill="none"/>`),
  flywheel: svg(`<circle cx="32" cy="32" r="22" fill="#cbd5e1" stroke="${O}" stroke-width="2"/><circle cx="32" cy="32" r="14" fill="none" stroke="${MD}" stroke-width="4"/><circle cx="32" cy="32" r="4" fill="${O}"/><path d="M50 14 A25 25 0 0 1 56 30" stroke="#22c55e" stroke-width="3" fill="none"/>`),
  antimatter: svg(`<rect x="14" y="12" width="36" height="40" rx="8" fill="#1e1b4b" stroke="#a78bfa" stroke-width="2"/><circle cx="32" cy="32" r="6" fill="#f0abfc"/><ellipse cx="32" cy="32" rx="13" ry="5" fill="none" stroke="#c084fc" stroke-width="1.5"/><ellipse cx="32" cy="32" rx="5" ry="13" fill="none" stroke="#c084fc" stroke-width="1.5"/>`),
  vacuum_store: svg(`<circle cx="32" cy="32" r="22" fill="#0b1022" stroke="#818cf8" stroke-width="2"/><circle cx="26" cy="28" r="8" fill="none" stroke="#e879f9" stroke-width="1.5"/><circle cx="38" cy="38" r="6" fill="none" stroke="#e879f9" stroke-width="1.5"/>`),
  substation: svg(`<rect x="6" y="38" width="52" height="20" fill="#d4d4d8" stroke="${O}" stroke-width="1.3"/>${[14, 32, 50].map((x) => `<rect x="${x - 5}" y="26" width="10" height="16" fill="${M}" stroke="${O}"/><path d="M${x - 3} 26 V18 M${x + 3} 26 V18" stroke="${O}" stroke-width="1.5"/>`).join('')}<path d="M6 16 H58" stroke="${O}" stroke-width="1.5"/><path d="M30 46 l-4 6 h5 l-3 5" stroke="#eab308" stroke-width="2" fill="none"/>`),
  transmission: svg(`<path d="M32 4 L20 60 M32 4 L44 60 M24 40 H40 M22 50 H42 M27 22 H37" stroke="${O}" stroke-width="2.5" fill="none"/><path d="M8 16 H56" stroke="${O}" stroke-width="2"/><path d="M0 12 Q16 20 32 16 T64 12" stroke="#f59e0b" stroke-width="1.5" fill="none"/>`),
  relay: svg(`<circle cx="32" cy="32" r="10" fill="${M}" stroke="${O}" stroke-width="1.5"/><path d="M14 14 L50 50 M50 14 L14 50" stroke="#facc15" stroke-width="2" stroke-dasharray="4 3"/><path d="M20 32 a12 12 0 0 1 24 0" stroke="#fde047" stroke-width="2" fill="none"/>`),
  lab: svg(`${hall(8, 26, 48, 30, '#e0e7ff')}<path d="M26 10 V20 L18 34 H38 L30 20 V10Z" fill="#a5f3fc" stroke="${O}" stroke-width="1.4"/><circle cx="25" cy="30" r="2" fill="#0891b2"/><rect x="40" y="32" width="10" height="8" fill="#93c5fd" stroke="${O}"/>`),
  depot: svg(`${hall(6, 24, 52, 32, '#fde68a')}<rect x="20" y="36" width="24" height="20" fill="#78716c" stroke="${O}"/><path d="M14 18 l8 8 M18 14 a6 6 0 1 1 8 8" stroke="${O}" stroke-width="3" fill="none"/>`),
  logistics: svg(`<rect x="4" y="30" width="34" height="20" fill="#f97316" stroke="${O}" stroke-width="1.4"/><path d="M38 34 H50 L58 42 V50 H38Z" fill="#fb923c" stroke="${O}" stroke-width="1.4"/><circle cx="14" cy="52" r="5" fill="${O}"/><circle cx="48" cy="52" r="5" fill="${O}"/><rect x="42" y="37" width="7" height="5" fill="#bae6fd"/>`),
  tank: svg(`<ellipse cx="22" cy="20" rx="14" ry="4" fill="#d4d4d8" stroke="${O}"/><rect x="8" y="20" width="28" height="34" fill="#e4e4e7" stroke="${O}" stroke-width="1.4"/><ellipse cx="22" cy="54" rx="14" ry="4" fill="#a1a1aa" stroke="${O}"/><ellipse cx="48" cy="30" rx="10" ry="3" fill="#d4d4d8" stroke="${O}"/><rect x="38" y="30" width="20" height="24" fill="#e4e4e7" stroke="${O}" stroke-width="1.4"/><rect x="8" y="32" width="28" height="3" fill="#f59e0b"/>`),
  ops: svg(`${hall(4, 22, 56, 34, '#c7d2fe')}<rect x="10" y="28" width="16" height="12" fill="#0f172a" stroke="${O}"/><path d="M12 36 l4 -4 l4 3 l4 -5" stroke="#22c55e" stroke-width="1.5" fill="none"/><rect x="30" y="28" width="16" height="12" fill="#0f172a" stroke="${O}"/><path d="M32 34 h12" stroke="#38bdf8" stroke-width="1.5"/><path d="M50 12 V22 M46 14 a6 6 0 0 1 8 0" stroke="${O}" stroke-width="2" fill="none"/>`),
  trading: svg(`${hall(6, 20, 52, 36, '#e0f2fe')}<rect x="12" y="26" width="40" height="18" fill="#0f172a"/><path d="M14 40 l7 -6 l6 4 l8 -9 l6 5 l8 -8" stroke="#22c55e" stroke-width="2" fill="none"/>`),
  mine: svg(`<path d="M2 60 L20 26 L34 40 L46 20 L62 60Z" fill="#57534e" stroke="${O}" stroke-width="1.4"/><path d="M14 60 L30 46 L46 60" fill="#1c1917"/><path d="M38 14 l10 10 M40 24 l10 -10" stroke="${M}" stroke-width="3"/>`),
  gaswell: svg(`<path d="M24 58 L32 12 L40 58 M27 42 H37 M29 30 H35" stroke="${O}" stroke-width="2.5" fill="none"/><rect x="10" y="50" width="44" height="8" fill="${M}" stroke="${O}"/><circle cx="50" cy="44" r="5" fill="#fde047" stroke="${O}"/><path d="M50 38 q2 -4 0 -6" stroke="#f97316" stroke-width="2" fill="none"/>`),
  he3: svg(`<circle cx="40" cy="44" r="20" fill="#b45309" stroke="${O}" stroke-width="1.4"/><path d="M20 40 Q40 30 60 42" stroke="#fde68a" stroke-width="3" fill="none"/><path d="M8 10 L28 30" stroke="${M}" stroke-width="3"/><path d="M4 6 l8 0 l0 8 Z" fill="#e5e7eb" stroke="${O}"/>`),
  starlifter: svg(`${star(32, 44, 14, '#f97316')}<path d="M32 30 V6" stroke="#fde047" stroke-width="5" opacity="0.6"/><rect x="22" y="2" width="20" height="8" fill="${M}" stroke="${O}"/><circle cx="14" cy="18" r="4" fill="${M}" stroke="${O}"/><circle cx="50" cy="18" r="4" fill="${M}" stroke="${O}"/>`),
  forge: svg(`<polygon points="32,6 56,20 56,44 32,58 8,44 8,20" fill="#312e81" stroke="#e879f9" stroke-width="2"/><circle cx="32" cy="32" r="8" fill="#f0abfc"/><path d="M32 18 V24 M32 40 V46 M18 32 H24 M40 32 H46" stroke="#f0abfc" stroke-width="2"/>`),
  convergence: svg(`<circle cx="32" cy="32" r="28" fill="#020617" stroke="#fbbf24" stroke-width="2"/>${[0, 40, 80, 120, 160, 200, 240, 280, 320].map((a) => `<path d="M32 32 L${32 + 26 * Math.cos((a * Math.PI) / 180)} ${32 + 26 * Math.sin((a * Math.PI) / 180)}" stroke="#a78bfa" stroke-width="1.2"/>`).join('')}<circle cx="32" cy="32" r="16" fill="none" stroke="#f0abfc" stroke-width="2"/><circle cx="32" cy="32" r="7" fill="#fef3c7" stroke="#fbbf24" stroke-width="2"/>`),
};

const spokes = (f: number) => [0, 45, 90, 135].map((a0) => { const a = ((a0 + f * 11.25) * Math.PI) / 180; return `<line x1="${(32 + 20 * Math.cos(a)).toFixed(1)}" y1="${(34 + 20 * Math.sin(a)).toFixed(1)}" x2="${(32 - 20 * Math.cos(a)).toFixed(1)}" y2="${(34 - 20 * Math.sin(a)).toFixed(1)}" stroke="#92400e" stroke-width="2.5"/>`; }).join('');
/** Falling water: dashes scroll down one quarter of the dash period per frame. */
const fall = (d: string, f: number) => `<path d="${d}" stroke="#e0f2fe" fill="none" stroke-width="2" stroke-dasharray="4 3" stroke-dashoffset="${-f * 1.75}"/>`;
/** Waves: a path extended one period to the left, shifted right by period/FRAMES per frame. */
const waves = (x0: number, y: number, amp: number, period: number, n: number, f: number, stroke: string, sw = 1) => `<path d="M${x0 - period + (f * period) / FRAMES} ${y} q${period / 2} ${-amp} ${period} 0${` t${period} 0`.repeat(n)}" stroke="${stroke}" fill="none" stroke-width="${sw}"/>`;

/** Art that moves while the building produces (turbines spin, smoke rises, water flows). */
const ANIM: Record<string, (f: number) => string> = {
  wind_small: (f) => svg(turbine(32, 58, 22, 14, W, f * 30)),
  wind: (f) => svg(turbine(32, 60, 16, 18, W, f * 30)),
  wind_farm: (f) => svg(`${turbine(18, 58, 18, 12, W, f * 30)}${turbine(46, 58, 14, 13, W, f * 30 + 50)}${turbine(32, 62, 34, 9, W, f * 30 + 20)}`),
  wind_offshore: (f) => svg(`<rect x="0" y="50" width="64" height="14" fill="#1e40af" opacity="0.6"/>${waves(0, 52, 3, 16, 4, f, '#93c5fd')}${turbine(20, 52, 16, 12, W, f * 30)}${turbine(46, 52, 20, 11, W, f * 30 + 60)}<rect x="17" y="50" width="6" height="4" fill="#facc15" stroke="${O}"/><rect x="43" y="50" width="6" height="4" fill="#facc15" stroke="${O}"/>`),
  waterwheel: (f) => svg(`<rect x="0" y="44" width="64" height="20" fill="#2563eb" opacity="0.55"/><circle cx="32" cy="34" r="20" fill="none" stroke="#78350f" stroke-width="4"/>${spokes(f)}<circle cx="32" cy="34" r="4" fill="#451a03"/>${waves(4, 50, 3, 12, 5, f, '#bfdbfe', 1.5)}`),
  hydro_small: (f) => svg(`<rect x="0" y="40" width="64" height="24" fill="#2563eb" opacity="0.55"/>${hall(16, 18, 32, 26)}<rect x="10" y="38" width="44" height="6" fill="${C}" stroke="${O}"/>${fall('M40 46 q4 4 0 8 q-4 4 0 8', f)}<path d="M24 24 l-3 6 h4 l-2 5" stroke="#eab308" stroke-width="2" fill="none"/>`),
  dam: (f) => svg(`<rect x="0" y="0" width="64" height="28" fill="#1d4ed8" opacity="0.65"/><path d="M4 28 L60 28 L54 52 L10 52Z" fill="${C}" stroke="${O}" stroke-width="2"/>${[18, 28, 38, 46].map((x) => `<rect x="${x}" y="32" width="4" height="10" fill="${MD}"/>`).join('')}<rect x="10" y="52" width="44" height="12" fill="#3b82f6" opacity="0.7"/>${fall('M30 52 q2 5 -1 12', f)}${fall('M36 52 q2 5 -1 12', f)}`),
  tidal: (f) => svg(`<rect x="0" y="34" width="64" height="30" fill="#1e3a8a" opacity="0.7"/><rect x="2" y="26" width="60" height="12" fill="${C}" stroke="${O}" stroke-width="1.6"/>${[8, 20, 32, 44, 56].map((x) => `<circle cx="${x}" cy="32" r="3" fill="${MD}" stroke="${O}"/>`).join('')}${waves(2, 46, 4, 15, 5, f, '#93c5fd', 2)}${waves(2, 54, 4, 15, 5, (f + 2) % FRAMES, '#93c5fd', 2)}`),
  diesel: (f) => svg(`${hall(8, 26, 40, 28, '#a3a3a3')}${stack(44, 14, 6, 26, true, f)}<rect x="12" y="32" width="14" height="10" fill="#525252" stroke="${O}"/><circle cx="35" cy="40" r="5" fill="#f59e0b" stroke="${O}"/>`),
  gas: (f) => svg(`${hall(6, 28, 44, 26)}<rect x="10" y="34" width="30" height="10" rx="5" fill="${M}" stroke="${O}" stroke-width="1.3"/><circle cx="14" cy="39" r="3" fill="${MD}"/>${stack(46, 12, 7, 30, false)}<path d="M49 10 q${[3, 1.5, -1, 0.5][f]} -4 0 -${[8, 9, 7.5, 8.5][f]}" stroke="#f97316" stroke-width="2" fill="none"/>`),
  coal: (f) => svg(`${hall(4, 30, 34, 26, '#78716c')}${stack(40, 6, 8, 50, true, f)}${coolingTower(20, 18, 18, 14, f)}<rect x="6" y="50" width="12" height="6" fill="#1c1917"/><circle cx="10" cy="49" r="3" fill="#292524"/><circle cx="15" cy="49" r="3" fill="#292524"/>`),
  ccgt: (f) => svg(`${hall(4, 30, 30, 24)}<rect x="8" y="36" width="20" height="8" rx="4" fill="${M}" stroke="${O}"/>${coolingTower(34, 22, 26, 32, f)}${stack(28, 14, 5, 18, false)}`),
  biomass: (f) => svg(`${hall(6, 28, 34, 28, '#a8a29e')}${stack(42, 14, 7, 42, true, f)}<path d="M8 56 l5 -8 l5 8 Z M18 56 l5 -10 l5 10 Z" fill="#65a30d" stroke="${O}"/><circle cx="20" cy="38" r="5" fill="#4d7c0f" stroke="${O}"/>`),
  geo: (f) => svg(`${hall(8, 30, 30, 24)}<rect x="40" y="26" width="16" height="28" fill="${M}" stroke="${O}" stroke-width="1.3"/>${puffs(45, 22, f, 3, 18, 2, 2.5)}${puffs(52, 22, (f + 2) % FRAMES, 3, 16, 3, 2)}<path d="M8 58 H56" stroke="#b45309" stroke-width="3"/><path d="M14 58 V54 M26 58 V54" stroke="#ea580c" stroke-width="2"/>`),
  nuclear: (f) => svg(`${coolingTower(2, 20, 24, 38, f)}<rect x="30" y="34" width="30" height="24" fill="${C}" stroke="${O}" stroke-width="1.6"/><path d="M34 34 Q45 18 56 34" fill="#e2e8f0" stroke="${O}" stroke-width="1.6"/><circle cx="45" cy="46" r="6" fill="#fde047" stroke="${O}"/><path d="M45 46 l0 -5 M45 46 l4 3 M45 46 l-4 3" stroke="${O}" stroke-width="2"/>`),
};

const animCache = new Map<string, string>();
function frameOf(fn: (f: number) => string, key: string, f: number): string {
  const k = `${key}#${f}`;
  let v = animCache.get(k);
  if (v === undefined) animCache.set(k, (v = fn(f)));
  return v;
}

/** Small four-point sparkle (sun glint on panels). */
const glint = (x: number, y: number) => `<path d="M${x} ${y - 3.5} L${x + 0.9} ${y - 0.9} L${x + 3.5} ${y} L${x + 0.9} ${y + 0.9} L${x} ${y + 3.5} L${x - 0.9} ${y + 0.9} L${x - 3.5} ${y} L${x - 0.9} ${y - 0.9}Z" fill="#fff" opacity="0.9"/>`;
const glints = (pts: [number, number][]) => (f: number) => (f && pts[f - 1] ? glint(...pts[f - 1]) : '');
/** Pulsing halo (reactor cores, plasma, stars). */
const pulse = (x: number, y: number, r: number, color: string) => (f: number) => `<circle cx="${x}" cy="${y}" r="${r + [0, 2, 4, 1][f]}" fill="${color}" opacity="${[0, 0.25, 0.45, 0.15][f]}"/>`;

/** Static art with an animated layer on top (frame 0 = the plain art). */
const OVERLAY: Record<string, (f: number) => string> = {
  pv: glints([[22, 24], [38, 30], [30, 38]]),
  pv2: glints([[20, 22], [40, 28], [28, 38]]),
  pv_farm: glints([[12, 13], [46, 34], [20, 53]]),
  pv_farm2: glints([[44, 13], [14, 34], [46, 34]]),
  csp: pulse(32, 10, 7, '#fb923c'),
  smr: pulse(32, 40, 7, '#fde047'),
  nuclear: pulse(45, 46, 6, '#fde047'),
  msr: pulse(32, 30, 4, '#fb923c'),
  fusion: pulse(32, 36, 10, '#e879f9'),
  stellarator: pulse(32, 33, 9, '#e879f9'),
  orbital_fusion: pulse(32, 32, 6, '#f0abfc'),
  swarm_net: pulse(30, 44, 4, '#fbbf24'),
  galactic_node: pulse(32, 32, 5, '#fef3c7'),
  accretion: pulse(32, 32, 9, '#fde047'),
  quasar: pulse(32, 32, 9, '#f472b6'),
  forge: pulse(32, 32, 8, '#f0abfc'),
  stellar_array: pulse(10, 32, 9, '#f97316'),
  starlifter: pulse(32, 44, 14, '#f97316'),
  smes: pulse(32, 32, 8, '#38bdf8'),
  antimatter: pulse(32, 32, 6, '#f0abfc'),
};
/** Degrees per frame for art that rotates; chosen so 4 frames loop seamlessly with its symmetry. */
const SPIN: Record<string, number> = { collector: 11.25, dyson: 7.5, matrioshka: 5, pulsar: 45, vacuum: 15, penrose: 10, convergence: 10, flywheel: 22.5, vacuum_store: 15 };

function decorated(art: string, f: number): string {
  let out = ART[art] ?? ART.lab;
  const deg = SPIN[art];
  if (deg) out = out.replace(/^(<svg[^>]*>)/, `$1<g transform="rotate(${deg * f} 32 32)">`).replace(/<\/svg>$/, '</g></svg>');
  const ov = OVERLAY[art];
  return ov ? out.replace(/<\/svg>$/, `${ov(f)}</svg>`) : out;
}

/** Battery cells drawn at their real charge level, coloured by what they are doing. */
function batteryLevel(x: number, y: number, w: number, h: number, level: number, color: string) {
  const ih = (h - 6) * Math.max(0, Math.min(1, level));
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#1f2937" stroke="${O}" stroke-width="1.5"/><rect x="${x + w * 0.35}" y="${y - 3}" width="${w * 0.3}" height="3" fill="${M}" stroke="${O}"/>${ih > 0.2 ? `<rect x="${x + 3}" y="${(y + h - 3 - ih).toFixed(1)}" width="${w - 6}" height="${ih.toFixed(1)}" rx="1.5" fill="${color}"/>` : ''}<path d="M${x + w / 2 + 2} ${y + 4} l-5 ${h * 0.35} h4 l-3 ${h * 0.3}" fill="none" stroke="#fde047" stroke-width="2"/>`;
}
const BATTERY_ART: Record<string, (level: number, color: string) => string> = {
  battery: (l, c) => svg(batteryLevel(16, 14, 32, 42, l, c)),
  battery_big: (l, c) => svg(`${batteryLevel(4, 14, 26, 40, l, c)}${batteryLevel(34, 14, 26, 40, l, c)}`),
};
export const hasLevelArt = (art: string) => art in BATTERY_ART;
/** Level-aware battery art; `level` is quantised by the caller (it is part of the cache key). */
export function batterySVG(art: string, level: number, color: string): string {
  return frameOf(() => BATTERY_ART[art](level, color), `${art}:${level}:${color}`, 0);
}

export function buildingSVG(art: string, frame = 0): string {
  const a = ANIM[art];
  if (a) return frameOf(a, art, frame % FRAMES);
  if (frame % FRAMES && (art in OVERLAY || art in SPIN)) return frameOf((f) => decorated(art, f), `d:${art}`, frame % FRAMES);
  return ART[art] ?? ART.lab;
}

export const isAnimatedArt = (art: string) => art in ANIM || art in OVERLAY || art in SPIN;
export const ART_IDS = [...Object.keys(ART), ...Object.keys(ANIM)];

/** Terrain: base colour + restrained pattern (shapes, not only colour, distinguish types). */
const TERRAIN_SYMBOL: Partial<Record<TerrainId, string>> = {
  grass: `<path d="M14 44 l2 -5 l2 5 M40 22 l2 -5 l2 5 M48 50 l2 -5 l2 5" stroke="#86efac" stroke-width="1.5" fill="none" opacity="0.55"/>`,
  forest: `<path d="M16 40 l8 -16 l8 16Z M34 50 l8 -16 l8 16Z M30 26 l6 -12 l6 12Z" fill="#14532d" opacity="0.85"/><path d="M24 40 v4 M42 50 v4 M36 26 v3" stroke="#422006" stroke-width="2"/>`,
  hill: `<path d="M4 50 Q20 24 36 50 M28 50 Q44 30 60 50" stroke="#a3a35a" stroke-width="2.5" fill="none" opacity="0.8"/>`,
  mountain: `<path d="M6 54 L24 18 L36 38 L44 26 L60 54Z" fill="#a8a29e" opacity="0.7"/><path d="M24 18 L19 28 L29 28Z M44 26 L41 32 L47 32Z" fill="#f5f5f4" opacity="0.9"/>`,
  river: `<path d="M0 26 q16 -8 32 0 t32 0 M0 40 q16 -8 32 0 t32 0" stroke="#bfdbfe" stroke-width="2" fill="none" opacity="0.7"/>`,
  lake: `<path d="M12 30 h14 M30 40 h18 M18 48 h10" stroke="#93c5fd" stroke-width="2" stroke-linecap="round" opacity="0.6"/>`,
  coast: `<path d="M0 44 q16 -6 32 0 t32 0 V64 H0Z" fill="#3b82c4" opacity="0.55"/><circle cx="20" cy="24" r="1.5" fill="#a16207"/><circle cx="40" cy="30" r="1.5" fill="#a16207"/>`,
  ocean: `<path d="M4 22 q6 -4 12 0 t12 0 M30 42 q6 -4 12 0 t12 0 M8 54 q6 -4 12 0" stroke="#60a5fa" stroke-width="1.8" fill="none" opacity="0.7"/>`,
  desert: `<path d="M4 46 Q18 38 32 46 T60 46 M10 30 Q22 24 34 30" stroke="#b45309" stroke-width="1.5" fill="none" opacity="0.5"/>`,
  urban: `<rect x="12" y="24" width="12" height="28" fill="#4b5563" opacity="0.7"/><rect x="28" y="14" width="10" height="38" fill="#374151" opacity="0.7"/><rect x="42" y="30" width="12" height="22" fill="#4b5563" opacity="0.7"/>`,
  industrial: `<rect x="10" y="34" width="34" height="18" fill="#57534e" opacity="0.7"/><path d="M10 34 l8 -6 v6 l8 -6 v6 l8 -6 v6" fill="#57534e" opacity="0.7"/><rect x="46" y="16" width="6" height="36" fill="#44403c" opacity="0.7"/>`,
  geothermal: `<circle cx="22" cy="40" r="5" fill="#f97316" opacity="0.7"/><circle cx="42" cy="28" r="4" fill="#fb923c" opacity="0.7"/><path d="M22 34 q3 -6 0 -12 M42 23 q3 -5 0 -10" stroke="#fde68a" stroke-width="2" fill="none" opacity="0.8"/>`,
  reservoir: `<path d="M8 24 h20 M32 34 h22 M12 46 h26" stroke="#bfdbfe" stroke-width="2" stroke-linecap="round" opacity="0.6"/><path d="M0 0 L64 64" stroke="#1e40af" stroke-width="1" opacity="0.3"/>`,
  void: `<circle cx="12" cy="18" r="0.9" fill="#e2e8f0"/><circle cx="44" cy="12" r="0.7" fill="#e2e8f0"/><circle cx="52" cy="46" r="1" fill="#e2e8f0"/><circle cx="24" cy="50" r="0.6" fill="#e2e8f0"/>`,
  inner: `<path d="M-10 70 A60 60 0 0 1 70 -10" stroke="#a78bfa" stroke-width="1.5" fill="none" opacity="0.6"/><circle cx="30" cy="30" r="1" fill="#fde68a"/>`,
  corona: `<path d="M8 56 Q16 40 8 24 M24 60 Q34 40 24 18 M44 60 Q54 40 44 14" stroke="#fdba74" stroke-width="2.5" fill="none" opacity="0.6"/>`,
  orbit: `<ellipse cx="32" cy="32" rx="26" ry="10" stroke="#93c5fd" stroke-width="1.2" fill="none" opacity="0.6"/><circle cx="32" cy="32" r="5" fill="#2563eb" opacity="0.8"/>`,
  lunar: `<circle cx="32" cy="32" r="14" fill="#d1d5db" opacity="0.85"/><circle cx="27" cy="29" r="3" fill="#9ca3af"/><circle cx="37" cy="37" r="2" fill="#9ca3af"/>`,
  martian: `<circle cx="32" cy="32" r="14" fill="#dc6b3e" opacity="0.9"/><path d="M22 30 q10 -4 20 2" stroke="#7c2d12" stroke-width="2" fill="none"/>`,
  asteroid: `<path d="M12 20 l6 -3 l5 4 l-3 6 l-7 0Z M38 40 l8 -4 l6 6 l-4 7 l-8 -1Z M40 14 l4 -2 l3 3 l-3 3Z" fill="#a8a29e" opacity="0.8"/>`,
  gasgiant: `<circle cx="32" cy="32" r="16" fill="#d97706" opacity="0.9"/><path d="M17 27 h30 M16 34 h32 M19 40 h26" stroke="#fde68a" stroke-width="2" opacity="0.7"/>`,
  nebula: `<circle cx="24" cy="28" r="16" fill="#a855f7" opacity="0.25"/><circle cx="40" cy="38" r="14" fill="#ec4899" opacity="0.2"/>`,
  star_red: `<circle cx="22" cy="24" r="2.5" fill="#fca5a5"/><circle cx="42" cy="40" r="2" fill="#f87171"/><circle cx="30" cy="50" r="1.5" fill="#fca5a5"/>`,
  star_yellow: `<circle cx="22" cy="24" r="3" fill="#fde68a"/><circle cx="44" cy="38" r="2.5" fill="#fef3c7"/><circle cx="28" cy="50" r="1.8" fill="#fde68a"/>`,
  star_blue: `<circle cx="24" cy="26" r="3.5" fill="#bfdbfe"/><circle cx="44" cy="42" r="3" fill="#93c5fd"/><path d="M24 20 v12 M18 26 h12" stroke="#dbeafe" stroke-width="1"/>`,
  neutron: `<circle cx="32" cy="32" r="3" fill="#a5f3fc"/><path d="M32 29 L28 10 H36Z M32 35 L28 54 H36Z" fill="#67e8f9" opacity="0.5"/>`,
  galactic_core: `<circle cx="32" cy="32" r="14" fill="#f9a8d4" opacity="0.35"/><circle cx="32" cy="32" r="5" fill="#020617" stroke="#f472b6" stroke-width="1.5"/>`,
  galaxy_spiral: `<path d="M32 32 m-14 0 a14 6 30 1 0 28 0 a14 6 30 1 0 -28 0" stroke="#c7d2fe" stroke-width="1.5" fill="none" opacity="0.8"/><circle cx="32" cy="32" r="3" fill="#fef3c7"/>`,
  galaxy_elliptical: `<ellipse cx="32" cy="32" rx="14" ry="9" fill="#fcd34d" opacity="0.45"/><ellipse cx="32" cy="32" rx="6" ry="4" fill="#fef3c7" opacity="0.8"/>`,
  quasar: `<circle cx="32" cy="32" r="4" fill="#fdf2f8"/><path d="M30 28 L24 6 H40 L34 28Z M30 36 L24 58 H40 L34 36Z" fill="#f472b6" opacity="0.5"/>`,
  filament: `<path d="M0 50 Q20 30 32 34 T64 14" stroke="#60a5fa" stroke-width="4" fill="none" opacity="0.45"/>`,
  supervoid: `<circle cx="32" cy="32" r="18" fill="none" stroke="#1e293b" stroke-width="2" stroke-dasharray="2 3"/>`,
  smbh: `<circle cx="32" cy="32" r="8" fill="#000"/><ellipse cx="32" cy="32" rx="18" ry="5" fill="none" stroke="#fb923c" stroke-width="2"/>`,
};

/** Water terrain drifts; river waves shift by a quarter period so neighbouring tiles stay seamless. */
const BOB = [0, 1.5, 3, 1.5];
const TERRAIN_ANIM: Partial<Record<TerrainId, (f: number) => string>> = {
  river: (f) => `<g transform="translate(${f * 8} 0)"><path d="M-32 26 q16 -8 32 0 t32 0 t32 0 M-32 40 q16 -8 32 0 t32 0 t32 0" stroke="#bfdbfe" stroke-width="2" fill="none" opacity="0.7"/></g>`,
  lake: (f) => `<g transform="translate(${BOB[f]} 0)">${TERRAIN_SYMBOL.lake}</g>`,
  ocean: (f) => `<g transform="translate(${BOB[f] * 1.5} ${BOB[(f + 1) % FRAMES] * 0.5})">${TERRAIN_SYMBOL.ocean}</g>`,
  coast: (f) => `<g transform="translate(0 ${BOB[f] * 0.7})">${TERRAIN_SYMBOL.coast}</g>`,
  reservoir: (f) => `<g transform="translate(${BOB[f]} 0)"><path d="M8 24 h20 M32 34 h22 M12 46 h26" stroke="#bfdbfe" stroke-width="2" stroke-linecap="round" opacity="0.6"/></g><path d="M0 0 L64 64" stroke="#1e40af" stroke-width="1" opacity="0.3"/>`,
};

export const isAnimatedTerrain = (t: TerrainId) => t in TERRAIN_ANIM;

export function terrainSVG(t: TerrainId, color: string, frame = 0): string {
  const a = TERRAIN_ANIM[t];
  if (a) return frameOf((f) => svg(`<rect width="64" height="64" fill="${color}"/>${a(f)}`), `t:${t}:${color}`, frame % FRAMES);
  return svg(`<rect width="64" height="64" fill="${color}"/>${TERRAIN_SYMBOL[t] ?? ''}`);
}

const ICON_LAND = svg(`<rect x="10" y="10" width="44" height="44" fill="none" stroke="#fbbf24" stroke-width="4" stroke-dasharray="6 4"/><path d="M32 22 v20 M22 32 h20" stroke="#fbbf24" stroke-width="4"/>`);
const ICON_WRENCH = svg(`<circle cx="32" cy="32" r="28" fill="#f59e0b" stroke="${O}" stroke-width="3"/><path d="M22 42 l14 -14 M34 18 a8 8 0 1 0 12 12 l-6 -2 l-4 -4Z" stroke="${O}" stroke-width="5" fill="none" stroke-linecap="round"/>`);
const ICON_FUEL = svg(`<circle cx="32" cy="32" r="28" fill="#ef4444" stroke="${O}" stroke-width="3"/><path d="M24 46 V22 h12 v24Z M36 28 h6 v12" stroke="#fff" stroke-width="4" fill="none"/>`);
const ICON_OFF = svg(`<circle cx="32" cy="32" r="28" fill="#64748b" stroke="${O}" stroke-width="3"/><path d="M32 16 v16 M22 22 a14 14 0 1 0 20 0" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>`);
export const UI_ICONS = { land: ICON_LAND, wrench: ICON_WRENCH, fuel: ICON_FUEL, off: ICON_OFF };

/** Browser-only image cache: SVG → HTMLImageElement → rasterised canvases per pixel size. */
const imgCache = new Map<string, HTMLImageElement>();
const rasterCache = new Map<string, HTMLCanvasElement>();

export function svgImage(key: string, markup: string): HTMLImageElement {
  let img = imgCache.get(key);
  if (!img) {
    img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
    imgCache.set(key, img);
  }
  return img;
}

/**
 * Rasterise at the on-screen pixel size (rounded up to a bucket) so art stays sharp at any zoom
 * and device-pixel ratio without re-decoding SVG every frame.
 */
export function raster(key: string, markup: string, w: number, h: number): HTMLCanvasElement | HTMLImageElement {
  const img = svgImage(key, markup);
  if (!img.complete || !img.naturalWidth) return img;
  const bw = Math.min(1024, Math.max(8, Math.ceil(w / 16) * 16));
  const bh = Math.min(1024, Math.max(8, Math.ceil(h / 16) * 16));
  const k = `${key}@${bw}x${bh}`;
  let c = rasterCache.get(k);
  if (!c) {
    c = document.createElement('canvas');
    c.width = bw;
    c.height = bh;
    const ctx = c.getContext('2d')!;
    const s = Math.min(bw, bh);
    ctx.drawImage(img, (bw - s) / 2, (bh - s) / 2, s, s);
    if (rasterCache.size > 1500) rasterCache.clear();
    rasterCache.set(k, c);
  }
  return c;
}

export function terrainRaster(key: string, markup: string, size: number): HTMLCanvasElement | HTMLImageElement {
  const img = svgImage(key, markup);
  if (!img.complete || !img.naturalWidth) return img;
  const b = Math.min(512, Math.max(8, Math.ceil(size / 8) * 8));
  const k = `${key}@${b}`;
  let c = rasterCache.get(k);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = b;
    c.getContext('2d')!.drawImage(img, 0, 0, b, b);
    rasterCache.set(k, c);
  }
  return c;
}

/** Data URL for use in <img> tags (catalog, inspector). */
export function buildingIconURL(art: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildingSVG(art))}`;
}
