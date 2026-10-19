import { Card } from '../components/ui';

const GROUPS: { title: string; keys: [string, string][] }[] = [
  {
    title: 'Anywhere',
    keys: [
      ['Space', 'Pause / resume'],
      ['T', 'Cycle game speed (2× unlocks on winning, 3× with every achievement)'],
      ['1 – 9', 'Open Map, Research, Workforce, Operations, Automation, Fuel, Market, Thermal, Finances'],
      ['← / →', 'Previous / next screen tab (wraps from Map to Shortcuts and back)'],
      ['↑ / ↓', 'Previous / next unlocked map; past either end opens Progression (what the next map needs)'],
      ['Esc', 'Close the open dialog'],
    ],
  },
  {
    title: 'Map screen',
    keys: [
      ['W A S D', 'Pan the map'],
      ['+ / -', 'Zoom in / out'],
      ['F', 'Fit the whole map in view'],
      ['C', 'Centre the map'],
      ['L', 'Toggle land-purchase mode'],
      ['R', 'Rotate the building being placed'],
      ['Esc', 'Cancel build / land mode'],
      ['Q', 'Cycle side panel: Build → Inspect → Map (Inspect only with a selection)'],
    ],
  },
  {
    title: 'Mouse & touch',
    keys: [
      ['Drag', 'Pan (a 5 px threshold stops accidental builds or purchases)'],
      ['Wheel', 'Zoom towards the cursor'],
      ['Click', 'Select a tile/building, place a building (build mode), buy land (land mode)'],
      ['Shift + drag', 'Build mode: place a straight row of the selected building (skips blocked spots)'],
    ],
  },
];

export function ShortcutsScreen() {
  return (
    <div className="p-3 flex flex-col gap-3 max-w-3xl" data-testid="shortcuts-screen">
      <p className="muted">Shortcuts are ignored while typing in a field, while a dialog is open, or when Ctrl / Alt / ⌘ is held.</p>
      {GROUPS.map((g) => (
        <Card key={g.title} title={g.title}>
          <table className="w-full text-left">
            <tbody>
              {g.keys.map(([k, v]) => (
                <tr key={g.title + k} className="border-t border-[var(--border)] first:border-0">
                  <td className="py-1.5 pr-4 whitespace-nowrap align-top w-32"><span className="kbd">{k}</span></td>
                  <td className="py-1.5">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}
