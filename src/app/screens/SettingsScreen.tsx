import { useEffect, useRef, useState } from 'react';
import type { Settings } from '../../engine/core/State';
import { newGame } from '../../engine/core/NewGame';
import { exportSave, importSave } from '../../engine/persistence/SaveManager';
import { cmd, engine, saveNow, saves } from '../game';
import { useGame } from '../hooks/useGame';
import { useUI } from '../stores/uiStore';
import { toggleFullscreen } from '../layouts/TopBar';
import { Card, Modal, Select, Toggle } from '../components/ui';

export function SettingsScreen() {
  const s = useGame((s) => s);
  const ui = useUI();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [slots, setSlots] = useState<{ slot: string; savedAt: number; ok: boolean }[]>([]);
  const set = (p: Partial<Settings>) => cmd({ type: 'settings', patch: p });
  useEffect(() => {
    saves.listSlots().then(setSlots).catch(() => setSlots([]));
  }, [ui.version]);
  const doExport = () => {
    const blob = new Blob([exportSave(engine.state)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `energy-empire-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    ui.toast('Save exported.', 'success');
  };
  const doImport = async (file: File) => {
    try {
      const st = importSave(await file.text());
      engine.replaceState(st);
      await saveNow();
      ui.toast('Save imported.', 'success');
    } catch (e) {
      ui.toast(`Import failed: ${(e as Error).message}`, 'error');
    }
  };
  return (
    <div className="p-3 grid gap-3 grid-cols-1 xl:grid-cols-3" data-testid="settings-screen">
      <Card title="Map display">
        <Toggle label="Grid lines" checked={s.settings.gridLines} onChange={(v) => set({ gridLines: v })} />
        <Toggle label="Terrain labels" checked={s.settings.terrainLabels} onChange={(v) => set({ terrainLabels: v })} />
        <Toggle label="Building names" checked={s.settings.buildingNames} onChange={(v) => set({ buildingNames: v })} />
        <Toggle label="Production values" checked={s.settings.productionValues} onChange={(v) => set({ productionValues: v })} />
        <Toggle label="Maintenance indicators" checked={s.settings.maintenanceIndicators} onChange={(v) => set({ maintenanceIndicators: v })} />
        <Toggle label="Electrical overlay" checked={s.settings.electricalOverlay} onChange={(v) => set({ electricalOverlay: v })} />
        <Toggle label="Animations (day/night, pulses)" checked={s.settings.animations} onChange={(v) => set({ animations: v })} />
        <Toggle label="Reduced motion" checked={s.settings.reducedMotion} onChange={(v) => set({ reducedMotion: v })} />
      </Card>
      <Card title="Interface">
        <Toggle label="Compact building inspector" checked={s.settings.compactInspector} onChange={(v) => set({ compactInspector: v })} />
        <Toggle label="Compact financial dashboard" checked={s.settings.compactFinance} onChange={(v) => set({ compactFinance: v })} />
        <Toggle label="Confirm expensive construction (> 50% of cash)" checked={s.settings.confirmExpensive} onChange={(v) => set({ confirmExpensive: v })} />
        <Toggle label="Carbon pricing (emissions cost money)" checked={s.settings.carbonPricing} onChange={(v) => set({ carbonPricing: v })} />
        <div className="flex justify-between items-center py-1"><span>Notifications</span><Select value={s.settings.notifications} label="Notification verbosity" onChange={(v) => set({ notifications: v })} options={[{ value: 'all', label: 'All' }, { value: 'important', label: 'Important' }, { value: 'critical', label: 'Critical only' }]} /></div>
        <div className="flex justify-between items-center py-1"><span>Number format</span><Select value={s.settings.numberFormat} label="Number format" onChange={(v) => set({ numberFormat: v })} options={[{ value: 'short', label: 'Short (12.3M · 12.3 MW)' }, { value: 'scientific', label: 'Scientific (1.23e7 · 1.23e7 W)' }, { value: 'engineering', label: 'Engineering (12.3e6 · 12.3e6 W)' }]} /></div>
        <div className="flex justify-between items-center py-1"><span>Theme</span><Select value={s.settings.theme} label="Theme" onChange={(v) => set({ theme: v })} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]} /></div>
        <button className="btn mt-2" onClick={toggleFullscreen}>{ui.fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}</button>
      </Card>
      <Card title="Saves">
        <p className="muted text-[0.88em] mb-2">Autosaves to IndexedDB every 20 s and when the tab is hidden, with rolling backups.</p>
        <div className="flex gap-1 flex-wrap mb-2">
          <button className="btn btn-primary" onClick={() => saveNow(true)} data-testid="save-now">Save now</button>
          <button className="btn" onClick={doExport} data-testid="export-save">Export save file</button>
          <button className="btn" onClick={() => fileRef.current?.click()} data-testid="import-save">Import save file</button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = ''; }} data-testid="import-input" />
        </div>
        <h4 className="font-semibold">Backups</h4>
        {slots.map((x) => (
          <div key={x.slot} className="flex justify-between items-center py-0.5">
            <span>{x.slot} · {new Date(x.savedAt).toLocaleString()} {x.ok ? '' : '(corrupted)'}</span>
            {x.slot !== 'primary' && x.ok && <button className="btn btn-sm" onClick={async () => { engine.replaceState(await saves.restore(x.slot)); ui.toast(`Restored ${x.slot}.`, 'success'); }}>Restore</button>}
          </div>
        ))}
        <button className="btn btn-danger mt-3" onClick={() => setConfirmReset(true)} data-testid="reset-game">Reset game…</button>
      </Card>
      {confirmReset && (
        <Modal title="Reset all progress?" onClose={() => setConfirmReset(false)} footer={
          <>
            <button className="btn" onClick={() => setConfirmReset(false)}>Cancel</button>
            <button className="btn btn-danger" data-testid="confirm-reset" onClick={async () => { await saves.reset(); engine.replaceState(newGame()); await saveNow(); setConfirmReset(false); ui.setMap('backyard'); ui.setScreen('map'); ui.toast('New game started.'); }}>Delete everything</button>
          </>
        }>
          <p>This deletes the save and all backups, including prestige, achievements and blueprints. Export a save first if you might want it back.</p>
        </Modal>
      )}
    </div>
  );
}
