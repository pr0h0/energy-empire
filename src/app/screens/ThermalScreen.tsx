import { FUELS } from '../../engine/data/fuels';
import { STAGE_LIST, STAGES } from '../../engine/data/stages';
import { defOf, ratedKW } from '../../engine/core/Helpers';
import { hasFeature } from '../../engine/core/Modifiers';
import { thermalLimits } from '../../engine/systems/ThermalSystem';
import { cmd } from '../game';
import { useFmt } from '../hooks/useFmt';
import { useGame } from '../hooks/useGame';
import { useUI } from '../stores/uiStore';
import { Card, Empty, Select } from '../components/ui';

/** Heat production, conversion, cooling and limits for every thermal plant. */
export function ThermalScreen() {
  const f = useFmt();
  const s = useGame((s) => s);
  const ui = useUI();
  const adv = hasFeature(s, 'thermal.advanced');
  const rows = STAGE_LIST.flatMap((st) => Object.values(s.maps[st.id]?.buildings ?? {}).filter((b) => defOf(b).thermal).map((b) => ({ st, b })));
  return (
    <div className="p-3 flex flex-col gap-3" data-testid="thermal-screen">
      <p className="muted">Fuel → heat → electricity. Waste heat (heat − electricity) must be rejected by cooling; when cooling is insufficient plants <b>throttle automatically</b> — nothing explodes. Water next to a plant improves cooling. {adv ? 'Advanced management is unlocked: targets up to 110% and optimised margins.' : 'Research Advanced Thermal Management for operating targets above 100% and optimised cooling margins.'}</p>
      <Card title="Thermal plants">
        {rows.length === 0 ? <Empty>No thermal plants yet. Fuel-burning, nuclear and fusion plants appear here.</Empty> : (
          <div className="scroll">
            <table className="tbl text-[0.9em]">
              <thead>
                <tr><th>Plant</th><th>Map</th><th>Heat</th><th>Electric</th><th>Efficiency</th><th>Waste heat</th><th>Cooling cap.</th><th>Limited by</th><th>Fuel</th><th>Mode</th><th>Target</th><th>Cooling</th></tr>
              </thead>
              <tbody>
                {rows.map(({ st, b }) => {
                  const m = s.maps[st.id]!;
                  const d = defOf(b);
                  const L = thermalLimits(s, m, b, d, 1 / 24);
                  return (
                    <tr key={b.id}>
                      <td><button className="underline decoration-dotted text-left" onClick={() => { ui.setMap(st.id); ui.setScreen('map'); ui.select({ kind: 'building', id: b.id }); }}>{d.name}</button></td>
                      <td>{STAGES[st.id].name}</td>
                      <td className="num">{f.kw(b.heat ?? 0)}</td>
                      <td className="num">{f.kw(b.output)} / {f.kw(ratedKW(b, d))}</td>
                      <td className="num">{f.pct(b.eta ?? L.eta, 1)}</td>
                      <td className="num">{f.kw(b.waste ?? 0)}</td>
                      <td className="num">{f.kw(L.coolingCap)}</td>
                      <td>{L.limitedBy}</td>
                      <td className="num">{FUELS[d.thermal!.fuel].name}</td>
                      <td>
                        <Select value={b.mode ?? 'follow'} label="Mode" onChange={(v) => cmd({ type: 'configure', map: st.id, id: b.id, patch: { mode: v as 'baseload' } })} options={[{ value: 'baseload', label: 'Baseload' }, { value: 'follow', label: 'Follow' }, { value: 'economic', label: 'Economic' }, { value: 'off', label: 'Off' }]} />
                      </td>
                      <td>
                        <input type="number" className="input w-20 num" min={20} max={adv ? 110 : 100} step={5} value={Math.round((b.target ?? 1) * 100)} onChange={(e) => cmd({ type: 'configure', map: st.id, id: b.id, patch: { target: Number(e.target.value) / 100 } })} aria-label="Operating target %" />
                      </td>
                      <td>
                        <Select value={b.coolingMode ?? 'safe'} label="Cooling" onChange={(v) => cmd({ type: 'configure', map: st.id, id: b.id, patch: { coolingMode: v as 'safe' } })} options={[{ value: 'safe', label: 'Safe' }, { value: 'optimized', label: 'Optimised', disabled: !adv }]} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
