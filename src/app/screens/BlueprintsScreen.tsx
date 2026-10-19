import { useState } from 'react';
import { BUILDINGS } from '../../engine/data/buildings';
import { STAGES } from '../../engine/data/stages';
import { cmd } from '../game';
import { useGame } from '../hooks/useGame';
import { useUI } from '../stores/uiStore';
import { Card, Empty } from '../components/ui';

export function BlueprintsScreen() {
  const s = useGame((s) => s);
  const ui = useUI();
  const [name, setName] = useState('');
  const m = s.maps[ui.map];
  return (
    <div className="p-3 flex flex-col gap-3" data-testid="blueprints-screen">
      <p className="muted">Blueprints record relative positions, types, rotation, upgrades and policies of a map's installations. They survive prestige. Rebuilding is always manual and charged at normal prices.</p>
      <Card title={`Save current layout of ${STAGES[ui.map].name}`}>
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="Blueprint name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Blueprint name" data-testid="bp-name" />
          <button className="btn btn-primary" disabled={!m || Object.keys(m.buildings).length <= (ui.map === 'backyard' ? 1 : 0)} onClick={() => { if (cmd({ type: 'saveBlueprint', map: ui.map, name }, 'Blueprint saved.').ok) setName(''); }} data-testid="bp-save">Save blueprint</button>
        </div>
      </Card>
      <div className="grid gap-3 grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3">
        {s.blueprints.length === 0 && <Empty>No blueprints saved yet.</Empty>}
        {s.blueprints.map((bp) => {
          const counts: Record<string, number> = {};
          for (const i of bp.items) counts[i.def] = (counts[i.def] ?? 0) + 1;
          return (
            <Card key={bp.id} title={bp.name} actions={<button className="btn btn-sm btn-danger" onClick={() => cmd({ type: 'deleteBlueprint', id: bp.id })} aria-label={`Delete ${bp.name}`}>Delete</button>}>
              <div className="muted text-[0.88em]">{STAGES[bp.stage].name} · {bp.items.length} installations · {bp.w}×{bp.h} tiles · v{bp.version}</div>
              <ul className="text-[0.88em] my-1">{Object.entries(counts).map(([d, n]) => <li key={d}>{n} × {BUILDINGS[d]?.name ?? `${d} (unknown type)`}</li>)}</ul>
              <div className="flex gap-1 flex-wrap">
                <button className="btn btn-sm btn-primary" disabled={!s.maps[bp.stage]} onClick={() => { ui.setMap(bp.stage); ui.setScreen('map'); ui.setMode({ kind: 'blueprint', id: bp.id }); ui.toast('Click the map to choose the blueprint anchor (top-left).'); }} data-testid={`bp-place-${bp.id}`}>
                  Place on {STAGES[bp.stage].name}…
                </button>
                <button className="btn btn-sm" onClick={() => { const n = prompt('Rename blueprint', bp.name); if (n) cmd({ type: 'renameBlueprint', id: bp.id, name: n }); }}>Rename</button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
