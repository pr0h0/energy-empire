import { CloudSun, Crosshair, Eye, Grid3x3, LandPlot, Layers, Maximize2, MousePointer2, RotateCw, Scan, ZoomIn, ZoomOut, X } from 'lucide-react';
import { envAt, WEATHER } from '../../engine/systems/WeatherSystem';
import { hydroHead } from '../../engine/systems/ElectricitySystem';
import type { WeatherLayer } from '../stores/uiStore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BUILDINGS } from '../../engine/data/buildings';
import { STAGES } from '../../engine/data/stages';
import { TERRAIN } from '../../engine/data/terrain';
import type { TerrainId } from '../../engine/data/types';
import { defOf, effectiveTerrain, gridLimits, storageCapacityKWh } from '../../engine/core/Helpers';
import { hasFeature } from '../../engine/core/Modifiers';
import type { Settings } from '../../engine/core/State';
import { previewPlacement, type PlacementPreview } from '../../engine/systems/ConstructionSystem';
import { bulkLandQuote, landBlockReason, landPrice } from '../../engine/systems/LandSystem';
import { analyzeBlueprint } from '../../engine/systems/BlueprintSystem';
import { tankCapacity } from '../../engine/systems/ThermalSystem';
import { FUELS } from '../../engine/data/fuels';
import { canRotate, footprint } from '../../engine/world/BuildingFootprints';
import { MapRenderer, type PlacementGhost } from '../../rendering/MapRenderer';
import { terrainSVG } from '../../rendering/SVGAssets';
import { cmd, engine } from '../game';
import { useFmt } from '../hooks/useFmt';
import { useGame, useMapState } from '../hooks/useGame';
import { useUI } from '../stores/uiStore';
import { BlueprintApplyDialog } from '../components/BlueprintApplyDialog';
import { Modal } from '../components/ui';
import { Onboarding } from '../components/Overlays';
import { BuildingFuelInfo } from '../components/FuelInfo';

const cameras = new Map<string, { cx: number; cy: number; zoom: number }>();

export function MapScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendRef = useRef<MapRenderer | null>(null);
  const ui = useUI();
  const f = useFmt();
  const s = useGame((s) => s);
  const m = s.maps[ui.map] ?? s.maps.backyard!;
  const [hover, setHover] = useState(-1);
  const [mouse, setMouse] = useState<[number, number]>([0, 0]);
  const [confirm, setConfirm] = useState<{ preview: PlacementPreview; def: string; x: number; y: number; rot: 0 | 1 } | null>(null);
  const [bpApply, setBpApply] = useState<{ id: string; x: number; y: number } | null>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean; id: number } | null>(null);
  // Shift+drag in build mode: place a straight row of the selected building
  const [rowFrom, setRowFrom] = useState(-1);
  const dirty = useRef(true);
  const inputRef = useRef<{ hover: number }>({ hover: -1 });
  inputRef.current.hover = hover;

  // renderer lifecycle
  useEffect(() => {
    const c = canvasRef.current!;
    const r = new MapRenderer(c);
    rendRef.current = r;
    (window as unknown as { __eeRenderer?: MapRenderer }).__eeRenderer = r;
    const ro = new ResizeObserver(() => {
      r.resize();
      dirty.current = true;
    });
    ro.observe(c);
    r.resize();
    return () => {
      ro.disconnect();
      rendRef.current = null;
    };
  }, []);

  // per-map camera memory
  useEffect(() => {
    const r = rendRef.current!;
    r.camera.setMap(m.w, m.h);
    const saved = cameras.get(m.id);
    if (saved) r.camera.cam = { ...saved };
    else r.camera.fit();
    dirty.current = true;
    return () => {
      cameras.set(m.id, { ...r.camera.cam });
    };
  }, [m.id, m.w, m.h]);

  // placement preview for build / blueprint modes
  const mode = ui.mode;
  const preview = useMemo(() => {
    if (mode.kind !== 'build' || hover < 0) return null;
    return previewPlacement(engine.state, m, mode.def, hover % m.w, Math.floor(hover / m.w), mode.rot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, hover, m, s.money, ui.version]);
  const purchasable = useMemo(() => {
    if (mode.kind !== 'land') return undefined;
    const set = new Set<number>();
    for (let i = 0; i < m.w * m.h; i++) if (!landBlockReason(engine.state, m, i)) set.add(i);
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, m, ui.version]);
  const eligible = useMemo(() => {
    if (mode.kind !== 'build') return undefined;
    const d = BUILDINGS[mode.def];
    // unowned land that can be bought right away counts too: the build confirm buys it
    return (i: number) => (!!m.owned[i] || !landBlockReason(engine.state, m, i)) && !m.occ[i] && d.terrain.includes(effectiveTerrain(m, i));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, m, ui.version]);
  const bpGhosts = useMemo((): PlacementGhost[] | undefined => {
    if (mode.kind !== 'blueprint' || hover < 0) return undefined;
    const bp = engine.state.blueprints.find((b) => b.id === mode.id);
    if (!bp) return undefined;
    const a = analyzeBlueprint(engine.state, bp, m, hover % m.w, Math.floor(hover / m.w));
    return a.items.filter((it) => BUILDINGS[it.item.def]).map((it) => {
      const [w, h] = footprint(BUILDINGS[it.item.def], it.item.rot);
      return { def: it.item.def, x: hover % m.w + it.item.dx, y: Math.floor(hover / m.w) + it.item.dy, w, h, ok: it.status === 'ok' };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, hover, m, ui.version]);

  const rowSpots = useMemo(() => {
    if (mode.kind !== 'build' || rowFrom < 0 || hover < 0) return null;
    const st = engine.state;
    const [fw, fh] = footprint(BUILDINGS[mode.def], mode.rot);
    const x0 = rowFrom % m.w, y0 = Math.floor(rowFrom / m.w), dx = (hover % m.w) - x0, dy = Math.floor(hover / m.w) - y0;
    const horiz = Math.abs(dx) >= Math.abs(dy), step = horiz ? fw : fh, delta = horiz ? dx : dy;
    const n = Math.min(60, Math.floor(Math.abs(delta) / step) + 1);
    let budget = st.money;
    const out: (PlacementGhost & { cost: number })[] = [];
    for (let k = 0; k < n; k++) {
      const x = horiz ? x0 + Math.sign(delta) * k * step : x0, y = horiz ? y0 : y0 + Math.sign(delta) * k * step;
      const p = previewPlacement(st, m, mode.def, x, y, mode.rot);
      // rows skip spots that would need a confirmation (land purchase, flooding)
      const ok = p.ok && !p.land && !p.flood && p.cost <= budget;
      if (ok) budget -= p.cost;
      out.push({ def: mode.def, x, y, w: fw, h: fh, ok, cost: p.cost });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, rowFrom, hover, m, ui.version]);

  const ghost: PlacementGhost | null = useMemo(() => {
    if (mode.kind !== 'build' || hover < 0 || !preview || rowSpots) return null;
    return { def: mode.def, x: hover % m.w, y: Math.floor(hover / m.w), w: preview.w, h: preview.h, ok: preview.ok, flood: preview.flood?.tiles };
  }, [mode, hover, preview, m.w, rowSpots]);

  // draw loop (continuous when animations are on, otherwise on demand)
  const ghosts = bpGhosts ?? rowSpots ?? undefined;
  const renderInput = useRef({ ghost, purchasable, eligible, bpGhosts: ghosts });
  renderInput.current = { ghost, purchasable, eligible, bpGhosts: ghosts };
  useEffect(() => {
    dirty.current = true;
  }, [ui.version, ghost, purchasable, eligible, ghosts, ui.selected, hover, s.settings, ui.weatherLayer]);
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      const r = rendRef.current;
      const st = engine.state;
      const mm = st.maps[useUI.getState().map] ?? st.maps.backyard!;
      if (r && (dirty.current || (st.settings.animations && !st.settings.reducedMotion))) {
        dirty.current = false;
        const sel = useUI.getState().selected;
        const ri = renderInput.current;
        r.render({
          state: st, map: mm, hover: inputRef.current.hover, selectedBuilding: sel?.kind === 'building' ? sel.id : null, selectedTile: sel?.kind === 'tile' ? sel.i : -1,
          ghost: ri.ghost, ghosts: ri.bpGhosts, landMode: !!ri.purchasable, purchasable: ri.purchasable, eligible: ri.eligible, weather: useUI.getState().weatherLayer, now: performance.now(),
        });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const local = (e: { clientX: number; clientY: number }): [number, number] => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };

  const act = useCallback(
    (i: number) => {
      const st = engine.state;
      const x = i % m.w, y = Math.floor(i / m.w);
      const md = useUI.getState().mode;
      if (md.kind === 'build') {
        const p = previewPlacement(st, m, md.def, x, y, md.rot);
        if (!p.ok) return useUI.getState().toast(`Cannot build here: ${p.reasons.join(' ')}`, 'error');
        if (p.flood || p.land || (st.settings.confirmExpensive && p.cost > st.money * 0.5 && p.cost > 0)) return setConfirm({ preview: p, def: md.def, x, y, rot: md.rot });
        const r = cmd({ type: 'place', map: m.id, def: md.def, x, y, rot: md.rot });
        if (r.ok) useUI.getState().toast(`Built ${BUILDINGS[md.def].name} for ${f.money(p.cost)}`, 'success');
        return;
      }
      if (md.kind === 'land') {
        const why = landBlockReason(st, m, i);
        if (why) return useUI.getState().toast(why, 'error');
        const price = landPrice(st, m, i);
        const r = cmd({ type: 'buyLand', map: m.id, x, y });
        if (r.ok) useUI.getState().toast(`Bought land for ${f.money(price)}`, 'success');
        return;
      }
      if (md.kind === 'blueprint') return setBpApply({ id: md.id, x, y });
      const occ = m.occ[i];
      useUI.getState().select(occ ? { kind: 'building', id: occ } : { kind: 'tile', i });
      if (!useUI.getState().sidebar) useUI.getState().set({ sidebar: true });
    },
    [m, f],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const [x, y] = local(e);
    if (e.shiftKey && useUI.getState().mode.kind === 'build') {
      setRowFrom(rendRef.current!.tileAt(x, y, m));
      return;
    }
    drag.current = { x, y, moved: false, id: e.pointerId };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const [x, y] = local(e);
    const r = rendRef.current!;
    if (drag.current) {
      const dx = x - drag.current.x, dy = y - drag.current.y;
      // movement threshold prevents accidental purchases/builds while panning
      if (drag.current.moved || Math.hypot(dx, dy) > 5) {
        drag.current.moved = true;
        r.camera.pan(dx, dy);
        drag.current.x = x;
        drag.current.y = y;
        dirty.current = true;
      }
    }
    const t = r.tileAt(x, y, m);
    if (t !== hover) setHover(t);
    setMouse([x, y]);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (rowFrom >= 0) {
      const md = useUI.getState().mode;
      const spots = (rowSpots ?? []).filter((g) => g.ok);
      setRowFrom(-1);
      if (md.kind !== 'build' || !spots.length) return useUI.getState().toast('Nothing to build in that row (blocked, needs land, or not enough money).', 'error');
      const money0 = engine.state.money;
      let n = 0;
      for (const g of spots) if (cmd({ type: 'place', map: m.id, def: md.def, x: g.x, y: g.y, rot: md.rot }).ok) n++;
      useUI.getState().toast(`Built ${n} × ${BUILDINGS[md.def].name} for ${f.money(money0 - engine.state.money)}`, 'success');
      return;
    }
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    const [x, y] = local(e);
    const t = rendRef.current!.tileAt(x, y, m);
    if (t >= 0) act(t);
  };
  const onWheel = (e: React.WheelEvent) => {
    const [x, y] = local(e);
    rendRef.current!.camera.zoomAt(Math.exp(-e.deltaY * 0.0015), x, y);
    dirty.current = true;
  };
  const cam = (fn: (c: MapRenderer['camera']) => void) => {
    fn(rendRef.current!.camera);
    dirty.current = true;
  };

  // keyboard shortcuts on the map
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,textarea,select,[role=dialog]')) return;
      const u = useUI.getState();
      const c = rendRef.current?.camera;
      if (!c) return;
      const step = 60;
      if (e.key === 'Escape') u.setMode({ kind: 'select' });
      else if ((e.key === 'r' || e.key === 'R') && u.mode.kind === 'build') u.setMode({ ...u.mode, rot: u.mode.rot ? 0 : 1 });
      else if (e.key === '+' || e.key === '=') c.zoomAt(1.2, c.vw / 2, c.vh / 2);
      else if (e.key === '-') c.zoomAt(1 / 1.2, c.vw / 2, c.vh / 2);
      else if (e.key === 'a') c.pan(step, 0);
      else if (e.key === 'd') c.pan(-step, 0);
      else if (e.key === 'w') c.pan(0, step);
      else if (e.key === 's') c.pan(0, -step);
      else if (e.key === 'f') c.fit();
      else if (e.key === 'c') c.center();
      else if (e.key === 'l') u.setMode(u.mode.kind === 'land' ? { kind: 'select' } : { kind: 'land' });
      else return;
      dirty.current = true;
      e.preventDefault();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  // test/debug hook: tile centre in client coordinates
  useEffect(() => {
    (window as unknown as { __eeTile?: (x: number, y: number) => [number, number] }).__eeTile = (x, y) => {
      const r = rendRef.current!;
      const rect = canvasRef.current!.getBoundingClientRect();
      const [sx, sy] = r.camera.toScreen(x + 0.5, y + 0.5);
      return [rect.left + sx, rect.top + sy];
    };
  }, []);

  const set = (p: Partial<Settings>) => cmd({ type: 'settings', patch: p });
  const lim = gridLimits(s, m);
  const bulk = mode.kind === 'land' && hasFeature(s, 'land.bulk') ? bulkLandQuote(s, m) : null;
  const cursor = mode.kind === 'build' ? (preview?.ok ? 'copy' : 'not-allowed') : mode.kind === 'land' ? 'cell' : drag.current?.moved ? 'grabbing' : 'pointer';

  return (
    <div className="relative flex-1 min-h-0 min-w-0" data-testid="map-screen">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full touch-none"
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setHover(-1)}
        onWheel={onWheel}
        onContextMenu={(e) => {
          e.preventDefault();
          ui.setMode({ kind: 'select' });
        }}
        aria-label={`${STAGES[m.id].name} map. Use W A S D to pan, plus and minus to zoom.`}
        data-testid="map-canvas"
      />
      {/* toolbar */}
      <div className="absolute top-2 left-2 flex flex-wrap gap-1 max-w-[calc(100%-1rem)]">
        <div className="panel flex gap-0.5 p-0.5">
          <button className="btn btn-ghost btn-sm" onClick={() => cam((c) => c.zoomAt(1.25, c.vw / 2, c.vh / 2))} aria-label="Zoom in" data-tip="Zoom in (+)"><ZoomIn size={15} /></button>
          <button className="btn btn-ghost btn-sm" onClick={() => cam((c) => c.zoomAt(0.8, c.vw / 2, c.vh / 2))} aria-label="Zoom out" data-tip="Zoom out (−)"><ZoomOut size={15} /></button>
          <button className="btn btn-ghost btn-sm" onClick={() => cam((c) => c.fit())} aria-label="Fit map to view" data-tip="Fit map (F)"><Maximize2 size={15} /></button>
          <button className="btn btn-ghost btn-sm" onClick={() => cam((c) => c.center())} aria-label="Center map" data-tip="Center (C)"><Crosshair size={15} /></button>
          <button className="btn btn-ghost btn-sm" onClick={() => cam((c) => c.reset())} aria-label="Reset zoom" data-tip="Reset zoom"><Scan size={15} /></button>
        </div>
        <div className="panel flex gap-0.5 p-0.5">
          <button className={`btn btn-sm ${mode.kind === 'select' ? 'active' : 'btn-ghost'}`} onClick={() => ui.setMode({ kind: 'select' })} aria-label="Select mode" data-tip="Select / inspect (Esc)" data-testid="mode-select"><MousePointer2 size={15} /></button>
          <button className={`btn btn-sm ${mode.kind === 'land' ? 'active' : 'btn-ghost'}`} onClick={() => ui.setMode(mode.kind === 'land' ? { kind: 'select' } : { kind: 'land' })} aria-label="Buy land mode" data-tip="Buy adjacent land (L)" data-testid="mode-land"><LandPlot size={15} /><span className="hidden md:inline">Land</span></button>
          {mode.kind === 'build' && canRotate(BUILDINGS[mode.def]) && (
            <button className="btn btn-sm btn-ghost" onClick={() => ui.setMode({ ...mode, rot: mode.rot ? 0 : 1 })} aria-label="Rotate footprint" data-tip="Rotate (R)" data-testid="rotate"><RotateCw size={15} /></button>
          )}
          {mode.kind !== 'select' && (
            <button className="btn btn-sm btn-ghost" onClick={() => ui.setMode({ kind: 'select' })} aria-label="Cancel mode"><X size={15} /></button>
          )}
        </div>
        <div className="panel flex gap-0.5 p-0.5" role="group" aria-label="Overlays">
          <button className={`btn btn-sm ${s.settings.gridLines ? 'active' : 'btn-ghost'}`} onClick={() => set({ gridLines: !s.settings.gridLines })} aria-pressed={s.settings.gridLines} data-tip="Grid lines" aria-label="Toggle grid lines"><Grid3x3 size={15} /></button>
          <button className={`btn btn-sm ${s.settings.electricalOverlay ? 'active' : 'btn-ghost'}`} onClick={() => set({ electricalOverlay: !s.settings.electricalOverlay })} aria-pressed={s.settings.electricalOverlay} data-tip="Electrical overlay (output vs available)" aria-label="Toggle electrical overlay" data-testid="overlay-electrical"><Layers size={15} /></button>
          <button className={`btn btn-sm ${s.settings.productionValues ? 'active' : 'btn-ghost'}`} onClick={() => set({ productionValues: !s.settings.productionValues })} aria-pressed={s.settings.productionValues} data-tip="Production values" aria-label="Toggle production values">kW</button>
          <button className={`btn btn-sm ${s.settings.buildingNames ? 'active' : 'btn-ghost'}`} onClick={() => set({ buildingNames: !s.settings.buildingNames })} aria-pressed={s.settings.buildingNames} data-tip="Building names" aria-label="Toggle building names">Aa</button>
          <button className={`btn btn-sm ${s.settings.terrainLabels ? 'active' : 'btn-ghost'}`} onClick={() => set({ terrainLabels: !s.settings.terrainLabels })} aria-pressed={s.settings.terrainLabels} data-tip="Terrain labels" aria-label="Toggle terrain labels">T</button>
          {!STAGES[m.id].space && (
            <button className={`btn btn-sm ${ui.weatherLayer !== 'off' ? 'active' : 'btn-ghost'}`} onClick={() => ui.set({ weatherLayer: NEXT_LAYER[ui.weatherLayer] })} aria-pressed={ui.weatherLayer !== 'off'}
              data-tip={`Weather layer: ${LAYER_NAME[ui.weatherLayer]} — click for ${LAYER_NAME[NEXT_LAYER[ui.weatherLayer]]}`} aria-label="Cycle weather layer" data-testid="overlay-weather">
              <CloudSun size={15} />{ui.weatherLayer !== 'off' && <span className="hidden md:inline">{LAYER_NAME[ui.weatherLayer]}</span>}
            </button>
          )}
          <button className={`btn btn-sm ${ui.legend ? 'active' : 'btn-ghost'}`} onClick={() => ui.set({ legend: !ui.legend })} aria-pressed={ui.legend} data-tip="Terrain legend" aria-label="Toggle legend" data-testid="legend-toggle"><Eye size={15} /></button>
        </div>
      </div>
      {bulk && (
        <div className="absolute top-14 left-2 panel px-2 py-1 flex items-center gap-2">
          <span>{bulk.tiles.length} adjacent tiles · {f.money(bulk.cost)}</span>
          <button className="btn btn-sm btn-primary" disabled={!bulk.tiles.length || s.money < bulk.cost} onClick={() => cmd({ type: 'buyLandBulk', map: m.id }, 'Bought all adjacent land.')}>Buy all</button>
        </div>
      )}
      {/* map status */}
      <div className="absolute bottom-2 left-2 panel px-2.5 py-1.5 text-[0.85em] num flex flex-wrap gap-x-3 gap-y-0.5 max-w-[calc(100%-1rem)] pointer-events-none" data-testid="map-status">
        <span>{STAGES[m.id].name} · {STAGES[m.id].cellLabel}</span>
        <span>Gen {f.kw(m.flow.generation)}</span>
        <span>Demand {f.kw(m.flow.demand)}</span>
        <span className="text-sky-300">Import {f.kw(m.flow.imported)}/{f.kw(lim.importKW)}</span>
        <span className="text-amber-300">Export {f.kw(m.flow.exported)}/{f.kw(lim.exportKW)}</span>
        {m.flow.curtailed > 0 && <span className="text-red-300">Curtailed {f.kw(m.flow.curtailed)}</span>}
      </div>
      {ui.weatherLayer !== 'off' && !STAGES[m.id].space && <WeatherLegend layer={ui.weatherLayer} />}
      {ui.legend && <Legend terrains={[...new Set(m.terrain.map((t, i) => (m.flooded[i] ? 'reservoir' : t)))]} />}
      {rowSpots ? (
        <div className="absolute z-20 panel px-2 py-1 text-[0.85em] pointer-events-none shadow-xl" style={{ left: mouse[0] + 16, top: mouse[1] + 16 }} data-testid="row-preview">
          Row: {rowSpots.filter((g) => g.ok).length} × {BUILDINGS[(mode as { def: string }).def]?.name} · {f.money(rowSpots.filter((g) => g.ok).reduce((a, g) => a + g.cost, 0))}
          {rowSpots.some((g) => !g.ok) && <span className="muted"> · {rowSpots.filter((g) => !g.ok).length} skipped</span>}
        </div>
      ) : hover >= 0 && <TileTooltip i={hover} x={mouse[0]} y={mouse[1]} preview={preview} />}
      {confirm && (
        <Modal
          title={confirm.preview.flood ? 'Confirm dam construction' : confirm.preview.land ? 'Buy land and build' : 'Confirm construction'}
          onClose={() => setConfirm(null)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirm(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                data-testid="confirm-build"
                onClick={() => {
                  const r = cmd({ type: 'place', map: m.id, def: confirm.def, x: confirm.x, y: confirm.y, rot: confirm.rot, acceptFlood: true, buyLand: true });
                  if (r.ok) useUI.getState().toast(`Built ${BUILDINGS[confirm.def].name}`, 'success');
                  setConfirm(null);
                }}
              >
                Build for {f.money(confirm.preview.cost)}
              </button>
            </>
          }
        >
          <p className="mb-2"><b>{BUILDINGS[confirm.def].name}</b> — {f.kw(confirm.preview.kw)} capacity, {confirm.preview.units.toLocaleString()} unit(s).</p>
          {confirm.preview.land && (
            <div className="panel2 p-2 mb-2">
              <p>{confirm.preview.land.tiles.length} tile{confirm.preview.land.tiles.length === 1 ? '' : 's'} of the footprint {confirm.preview.land.tiles.length === 1 ? "isn't" : "aren't"} yours yet and will be bought with the building.</p>
            </div>
          )}
          {!!(confirm.preview.land || confirm.preview.flood?.unowned) && <p className="mb-2" data-testid="build-cost-breakdown">{costBreakdown(confirm.preview, f.money)}</p>}
          {confirm.preview.flood && (
            <div className="panel2 p-2 mb-2">
              <p>Reservoir will flood <b>{confirm.preview.flood.tiles.length}</b> tiles (shown in blue on the map) and store {confirm.preview.flood.volume.toExponential(2)} m³.</p>
              {confirm.preview.flood.buildings.length > 0 && (
                <p className="text-red-300 mt-1">Warning: {confirm.preview.flood.buildings.map((id) => defOf(m.buildings[id]).name).join(', ')} will be removed (salvage credited).</p>
              )}
            </div>
          )}
          <ul className="muted list-disc pl-5">{confirm.preview.notes.map((n) => <li key={n}>{n}</li>)}</ul>
        </Modal>
      )}
      <Onboarding />
      {bpApply && <BlueprintApplyDialog {...bpApply} map={m.id} onClose={() => setBpApply(null)} />}
    </div>
  );
}

function Legend({ terrains }: { terrains: TerrainId[] }) {
  return (
    <div className="absolute top-14 right-2 panel p-2 w-64 max-h-[60%] scroll" data-testid="legend">
      <h4 className="font-semibold mb-1">Terrain legend</h4>
      {terrains.map((t) => (
        <div key={t} className="flex gap-2 items-start py-1">
          <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(terrainSVG(t, TERRAIN[t].color))}`} alt="" className="w-7 h-7 rounded border border-[var(--border)] shrink-0" />
          <div>
            <div className="font-medium">{TERRAIN[t].name}</div>
            <div className="muted text-[0.82em] leading-snug">{TERRAIN[t].desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TipLine({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="muted">{k}</span>
      <span className="num">{v}</span>
    </div>
  );
}

/** "Building $X + N land tiles $Y + M flooded tiles $Z = $T": land bought together with the building. */
function costBreakdown(p: PlacementPreview, money: (v: number) => string) {
  const tiles = (n: number) => `${n} tile${n === 1 ? '' : 's'}`;
  const land = p.land?.cost ?? 0, flood = p.flood?.landCost ?? 0;
  const parts = [`${p.flood ? 'Dam' : 'Building'} ${money(p.cost - land - flood)}`];
  if (p.land) parts.push(`${tiles(p.land.tiles.length)} of land ${money(land)}`);
  if (p.flood?.unowned) parts.push(`${tiles(p.flood.unowned)} flooded ${money(flood)}`);
  return `${parts.join(' + ')} = ${money(p.cost)}`;
}

function TileTooltip({ i, x, y, preview }: { i: number; x: number; y: number; preview: PlacementPreview | null }) {
  const f = useFmt();
  const s = engine.state;
  const ui = useUI.getState();
  const m = s.maps[ui.map]!;
  const t = effectiveTerrain(m, i);
  const def = TERRAIN[t];
  const st = STAGES[m.id];
  const b = m.occ[i] ? m.buildings[m.occ[i]!] : null;
  const block = !m.owned[i] ? landBlockReason(s, m, i) : null;
  const left = Math.min(x + 16, (window.innerWidth || 1200) - 320);
  // hovering an installation (outside build mode): show the building, not the ground under it
  if (b && ui.mode.kind !== 'build') {
    const d = defOf(b);
    const net = b.rRevenue - b.rCost;
    const cap = d.storage ? storageCapacityKWh(s, b, d) : 0;
    return (
      <div className="absolute z-20 panel p-2 text-[0.85em] w-72 pointer-events-none shadow-xl" style={{ left, top: y + 16 }} role="tooltip" data-testid="tile-tooltip">
        <div className="font-semibold">{d.name}</div>
        <div className="muted leading-snug mb-1">{b.status}</div>
        {d.storage ? (
          <TipLine k="Stored" v={`${f.kwh(b.stored ?? 0)} / ${f.kwh(cap)} (${f.pct(cap > 0 ? (b.stored ?? 0) / cap : 0)})`} />
        ) : null}
        {(b.output !== 0 || b.available > 0) && <TipLine k={b.output < 0 ? 'Charging' : 'Output'} v={`${f.kw(Math.abs(b.output))}${!d.storage && b.available > 0 ? ` of ${f.kw(b.available)}` : ''}`} />}
        {d.thermal && <TipLine k="Fuel" v={`${f.pct((b.tank ?? 0) / Math.max(1e-9, tankCapacity(b, d)))} ${FUELS[d.thermal.fuel].name}`} />}
        {d.gen?.kind === 'hydro' && <TipLine k="Hydro head" v={`×${hydroHead(m, b.y * m.w + b.x).toFixed(2)} (terrain drop)`} />}
        {!d.fixed && <TipLine k="Condition" v={f.pct(b.condition)} />}
        {!d.fixed && (b.rRevenue !== 0 || b.rCost !== 0) && <TipLine k="Net" v={<span className={net >= 0 ? 'text-green-400' : 'text-red-400'}>{f.rate(net)}</span>} />}
        {(d.thermal || d.infra?.role === 'fuelStorage' || d.infra?.role === 'fuelProducer') && <div className="border-t border-[var(--border)] mt-1 pt-1"><BuildingFuelInfo s={s} m={m} b={b} /></div>}
        {!b.enabled && <div className="text-amber-300">Switched off</div>}
        <div className="muted mt-1">Click for details</div>
      </div>
    );
  }
  return (
    <div className="absolute z-20 panel p-2 text-[0.85em] w-72 pointer-events-none shadow-xl" style={{ left, top: y + 16 }} role="tooltip" data-testid="tile-tooltip">
      <div className="flex justify-between font-semibold">
        <span>{def.name}</span>
        <span className="muted num">({i % m.w}, {Math.floor(i / m.w)})</span>
      </div>
      <div className="muted leading-snug">{def.desc}</div>
      {!st.space && <div className="num">Elevation {(m.elev[i] * st.elevRangeM).toFixed(st.elevRangeM < 10 ? 1 : 0)} m</div>}
      {m.riverFlow[i] > 0 && <div className="num">River flow {m.riverFlow[i].toPrecision(3)} m³/s · hydro head ×{hydroHead(m, i).toFixed(2)}</div>}
      {(def.solar !== 1 || def.wind !== 1) && <div className="num">Solar ×{def.solar} · Wind ×{def.wind}{def.cooling ? ` · Cooling ×${def.cooling}` : ''}</div>}
      <div>{m.owned[i] ? <span className="text-amber-300">Owned</span> : block ? <span className="text-red-300">{block}</span> : <span>For sale: {f.money(landPrice(s, m, i))}</span>}</div>
      {b && (
        <div className="mt-1 border-t border-[var(--border)] pt-1">
          <b>{defOf(b).name}</b> · {f.kw(b.output)} · {Math.round(b.condition * 100)}%
          <div className="muted">{b.status}</div>
        </div>
      )}
      {preview && ui.mode.kind === 'build' && (
        <div className="mt-1 border-t border-[var(--border)] pt-1">
          <div className={preview.ok ? 'text-green-300' : 'text-red-300'}>
            {preview.ok ? `Build for ${f.money(preview.cost)} · ${f.kw(preview.kw)}` : preview.reasons.join(' ')}
          </div>
          {!!(preview.land || preview.flood?.unowned) && <div>{costBreakdown(preview, f.money)}</div>}
          {preview.notes.map((n) => <div key={n} className="muted">{n}</div>)}
        </div>
      )}
    </div>
  );
}

const NEXT_LAYER: Record<WeatherLayer, WeatherLayer> = { off: 'wind', wind: 'solar', solar: 'hydro', hydro: 'off' };
const LAYER_NAME: Record<WeatherLayer, string> = { off: 'off', wind: 'Wind', solar: 'Solar', hydro: 'Hydro' };

function WeatherLegend({ layer }: { layer: WeatherLayer }) {
  const s = useGame((s) => s);
  const m = useMapState();
  const env = envAt(m, s.time);
  const w = env.event ? WEATHER[env.event.kind] : null;
  const what = layer === 'wind' ? `Wind site quality per tile (terrain${w && w.wind !== 1 ? ` × ${w.name} ${w.wind}` : ''}) · label: multiplier · turbine output now. Blowing ${env.wind.toFixed(1)} m/s.`
    : layer === 'solar' ? `Solar site quality per tile (terrain${w && w.solar !== 1 ? ` × ${w.name} ${w.solar}` : ''}) — the sun itself follows the day`
    : `River flow per tile, relative to the strongest river${w && w.river !== 1 ? ` (${w.name} ×${w.river})` : ''}`;
  return (
    <div className="absolute bottom-12 left-2 panel px-2.5 py-1.5 text-[0.85em] max-w-[22rem] pointer-events-none" data-testid="weather-legend">
      <div className="font-semibold">{LAYER_NAME[layer]} layer{w ? ` · ${w.name} active` : ''}</div>
      <div className="muted">{what}</div>
      <div className="h-2 rounded mt-1" style={{ background: 'linear-gradient(90deg, hsl(0,80%,45%), hsl(60,80%,45%), hsl(120,80%,45%))' }} />
      <div className="flex justify-between muted text-[0.85em]"><span>weak / degraded</span><span>strong / boosted</span></div>
    </div>
  );
}
