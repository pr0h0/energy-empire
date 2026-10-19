import { BUILDINGS } from '../../engine/data/buildings';
import type { StageId } from '../../engine/data/types';
import { analyzeBlueprint } from '../../engine/systems/BlueprintSystem';
import { cmd, engine } from '../game';
import { useFmt } from '../hooks/useFmt';
import { useGame } from '../hooks/useGame';
import { useUI } from '../stores/uiStore';
import { Chip, Modal, Row } from './ui';

/** Pre-application report; reconstruction is always an explicit, normally-priced player action. */
export function BlueprintApplyDialog({ id, map, x, y, onClose }: { id: string; map: StageId; x: number; y: number; onClose: () => void }) {
  const f = useFmt();
  const s = useGame((s) => s);
  const bp = s.blueprints.find((b) => b.id === id);
  const m = s.maps[map];
  if (!bp || !m) return null;
  const a = analyzeBlueprint(engine.state, bp, m, x, y);
  const unavailableUpgrades = a.items.reduce((n, i) => n + i.upgradesUnavailable.length, 0);
  const apply = (mode: 'all' | 'subset') => {
    const r = cmd({ type: 'applyBlueprint', id, map, x, y, mode });
    if (r.ok) {
      useUI.getState().toast(`Blueprint applied: ${r.data} installation(s) built.`, 'success');
      useUI.getState().setMode({ kind: 'select' });
      onClose();
    }
  };
  return (
    <Modal
      title={`Apply blueprint “${bp.name}” at (${x}, ${y})`}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={a.buildable === 0} onClick={() => apply('subset')} data-testid="bp-apply-subset">Build valid subset</button>
          <button className="btn btn-primary" disabled={a.buildable < a.items.length || s.money < a.total} onClick={() => apply('all')} data-testid="bp-apply-all">Build all · {f.money(a.total)}</button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-x-6">
        <Row k="Items" v={`${a.buildable} / ${a.items.length} buildable`} />
        <Row k="Required land" v={`${a.landTiles.length} tiles · ${f.money(a.landCost)}`} />
        <Row k="Construction cost" v={f.money(a.buildCost)} />
        <Row k="Total estimate" v={f.money(a.total)} />
        <Row k="Locked technologies" v={a.locked} />
        <Row k="Conflicting terrain" v={a.conflictsTerrain} />
        <Row k="Occupied tiles" v={a.conflictsOccupied} />
        <Row k="Unavailable upgrades" v={unavailableUpgrades} />
        <Row k="Money" v={f.money(s.money)} />
      </div>
      <div className="mt-3 max-h-64 scroll">
        <table className="tbl">
          <thead><tr><th>Building</th><th>Offset</th><th>Status</th><th>Cost</th></tr></thead>
          <tbody>
            {a.items.map((it, k) => (
              <tr key={k}>
                <td>{BUILDINGS[it.item.def]?.name ?? it.item.def}</td>
                <td className="num">+{it.item.dx},+{it.item.dy}</td>
                <td>{it.status === 'ok' ? <Chip tone="good">ok</Chip> : <span className="text-red-300 text-[0.85em]">{it.reason}</span>}</td>
                <td className="num">{it.status === 'ok' ? f.money(it.cost) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
