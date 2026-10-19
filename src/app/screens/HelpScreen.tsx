import { Search } from 'lucide-react';
import { useState } from 'react';
import { Card } from '../components/ui';
import { useUI } from '../stores/uiStore';

/** In-game manual. Plain strings so the search box can filter everything. */
const SECTIONS: { id: string; title: string; items: string[] }[] = [
  {
    id: 'basics', title: 'Getting started',
    items: [
      'Goal: grow from powering one house to coordinating the universe, and finally build the Convergence Engine. Each of the nine scales is its own map that keeps simulating while you look elsewhere.',
      'Time: 1 real second = 10 game minutes (one game hour = 6 s at 1×). Speed 2× unlocks once you win the game and 3× once every achievement is unlocked; both stay unlocked through prestige. Faster speeds change nothing but the pace — every system scales together, so there is no penalty, only less reaction time.',
      'Loop: build generation → serve your demand and sell the surplus → reinvest in land, buildings, workers and research → meet the milestones for the next map → expand.',
      'You start in the Backyard with $60 and a small plot. Rooftop solar is the first build; the household tariff you avoid is your first income.',
    ],
  },
  {
    id: 'maps', title: 'Maps & expansion',
    items: [
      'Scales: Backyard → Neighborhood → City → Country → Continent → Planet → Solar System → Galaxy → Universe. Each has its own terrain, buildings, prices, workforce and fuel stock.',
      'To unlock the next map, meet every milestone listed on the Progression screen (energy sold, revenue, installed capacity, reliability, research count, workers, contracts or storage, depending on the scale) and pay the expansion cost.',
      'Prices deflate per scale: each tariff per kWh is far lower but installations are vastly larger, so money still grows tens of times per scale. Old technology gradually becomes uneconomic on newer maps.',
      'Switch maps with the list on the left or ↑/↓. Locked maps show their requirements on hover; clicking opens Progression.',
    ],
  },
  {
    id: 'land', title: 'Land & terrain',
    items: [
      'You can only build on land you own. Press L (or the land button) to see purchasable tiles: they must be adjacent to land you already own.',
      'Price = scale base × terrain multiplier × 1.03 per tile already bought. Bulk purchase (research) quotes many tiles at once with a discount.',
      'Terrain matters: each building lists allowed terrain. Hills and coasts are windy, water helps cooling, rivers allow hydro, forests suit biomass. Ocean and mountain tiles need research before they can be bought.',
      'Hover a tile for its terrain, ownership and price. Terrain labels and grid lines can be toggled in Settings.',
    ],
  },
  {
    id: 'building', title: 'Building, upgrading & demolishing',
    items: [
      'Pick a building in the Build tab, then click a tile. Green tint = valid, red hatching = invalid; the hover tooltip explains why. R rotates multi-tile buildings, Esc cancels.',
      'Large scales aggregate: one placed building represents many real units (shown as "units"). Cost and output scale with the number of units the footprint holds.',
      'Locked buildings show the research that unlocks them — click the name to open it.',
      'The Inspector (click a building) shows output, condition, finances and settings. Retrofits add permanent bonuses (with some downtime); fleet upgrades and repowering move older installations to newer technology; demolishing returns a salvage value capped below what you paid.',
    ],
  },
  {
    id: 'generation', title: 'Generation types',
    items: [
      'Solar: daylight only, follows the day/night cycle; panels slowly soil and age.',
      'Wind: runs day and night, depends on wind speed (smooth, forecastable cycles) and on terrain; stops above cut-out speed.',
      'Hydro: run-of-river and dams on rivers. Dams create reservoirs (see Dams). Upstream dams feed downstream ones.',
      'Thermal (diesel, gas, biomass, coal, nuclear, fusion…): run whenever they have fuel — see Thermal plants and Fuel.',
      'Late-game: orbital collectors, Dyson swarms, stellar and exotic generators follow the same rules at enormous scale.',
    ],
  },
  {
    id: 'dispatch', title: 'How power flows (dispatch)',
    items: [
      'Every tick each map balances supply and demand. When short: must-run generation → hydro / solar-thermal flexibility → batteries (by mode) → load-following thermal plants (cheapest first) → remaining storage → grid import → unserved demand (penalties).',
      'When in surplus: thermal plants back down to their minimum stable load (Baseload plants hold their output) → batteries charge → late-game energy sinks → export → curtailment.',
      'Economic-mode thermal plants additionally run to export when the export price beats their marginal cost.',
      'Energy is always conserved: generation + import + discharge = demand + export + charge + losses + curtailment.',
    ],
  },
  {
    id: 'grid', title: 'Grid connection, import & export',
    items: [
      'Each map has a grid connection tier with an import capacity, an export capacity and losses. The Backyard starts import-only.',
      'Upgrade the connection in the side panel (Map tab) for more export room; later tiers need research. Grid stations add capacity beyond the top tier.',
      'Import costs slightly less than retail; exports earn the (lower) export price. Spot markets (research) make prices vary through the day.',
    ],
  },
  {
    id: 'demand', title: 'Demand, customers & contracts',
    items: [
      'Demand only grows when you choose: Backyard home improvements (heat pump, EV…) add household income and load; on later maps you sign customer contracts (homes, shops, factories, data centres…) for a connection fee.',
      'Each contract has a daily load profile and a fixed price. Some require a minimum reliability on that map before you can sign.',
      'Unserved demand costs penalties and lowers reliability, which several milestones and contracts depend on.',
      'Power purchase agreements (Market screen, research) sell firm power at a premium; shortfalls are penalised. Energy traders raise prices and how many PPAs you can hold; algorithmic trading renews them automatically.',
    ],
  },
  {
    id: 'storage', title: 'Batteries & storage modes',
    items: [
      'Storage shifts energy in time: charge from surplus, discharge when short. Round-trip efficiency below 100% and cycle aging slowly reduce usable capacity (ordinary repairs do not restore it; cell replacement does).',
      'Modes: Self-consumption (default; cover your own demand), Sell surplus first (export before charging), Emergency reserve (only discharges when nothing else can cover demand).',
      'With research: Peak shaving (only discharge above a demand threshold), Smart dispatch, a minimum reserve %, and Market arbitrage (buy cheap, sell expensive on spot markets).',
    ],
  },
  {
    id: 'thermal', title: 'Thermal plants & cooling',
    items: [
      'Fuel → heat → electricity: output = heat × efficiency. The rest is waste heat that cooling must remove. If cooling is short the plant throttles itself safely — nothing explodes. Tiles next to water cool better.',
      'Each plant has a minimum stable load (it cannot run below it once on), a ramp rate (how fast output changes), and lower efficiency at part load. The Inspector shows what currently limits it and its marginal cost per kWh.',
      'Dispatch modes: Load-follow (default; covers demand that cheaper sources cannot), Baseload (runs flat out), Economic (also exports when profitable), Off.',
      'Advanced Thermal Management (research) allows operating targets up to 110% and an optimised cooling margin. Nuclear plants have refuelling outages; fusion needs ignition power and quenches if run too low.',
      'Rule of thumb (Neighborhood): gas ≈ $0.08/kWh beats importing; diesel ≈ $0.25/kWh is backup only; biomass is cheap and almost free with your own plantations.',
    ],
  },
  {
    id: 'fuel', title: 'Fuel & logistics',
    items: [
      'Fuels open at different scales (diesel, gas and biomass from the Neighborhood; coal from City; nuclear fuel from Country; fusion and beyond later).',
      'Buy fuel on the Fuel screen: it is delivered to the map\'s depot after a delivery time. Depot size grows with Fuel Storage Depots.',
      'Plants have their own tank; logistics jobs move fuel from the depot into it. Default policy refuels automatically when a tank falls below 40%. Logistics slots come from Logistics Coordinators (and better tiers) and Logistics Hubs.',
      'Delivery Routing research adds fully automatic purchasing with a price ceiling and daily budget. Fuel contracts and bulk discounts come from research too. Energy crop plantations grow biomass directly into the depot.',
    ],
  },
  {
    id: 'weather', title: 'Weather events',
    items: [
      'Earth-bound maps get occasional weather events, at most one every four days. They are announced 12 hours ahead (notification, top-bar chip, advisor) so you can prepare.',
      'Storm (6–14 h, mostly autumn/winter): turbines feather to ~50% output, solar halves, and wind/solar installations wear 2.5× faster. Charge storage beforehand.',
      'Heatwave (1–2 days, summer): demand rises ~12%, panels lose a little output and thermal cooling weakens.',
      'Drought (2–3 days, summer/autumn): rivers fall to ~60%, so hydro output drops, and thermal cooling weakens.',
      'Space maps have no weather.',
      'The cloud button on the map cycles a Wind / Solar / Hydro layer: tiles go red (poor) to green (strong) under the current weather; wind tiles also show live turbine output and moving streaks.',
      'The Map tab has a 48-hour forecast of solar and wind output against demand, including announced weather — use it to plan storage, fuel and imports.',
      'Run-of-river hydro depends on terrain: the steeper the river drops from a tile to the next, the higher the head (×0.75 on flat stretches up to ×1.5).',
      'Business events (recalls, fuel price spikes, demand booms) occasionally ask for a decision. You have 24 h; if you do nothing, the cautious default applies.',
    ],
  },
  {
    id: 'advisor', title: 'Advisor, bulk actions & indicators',
    items: [
      'The Map tab of the side panel opens with the Advisor: shortages, empty fuel tanks, overloaded crews, wasted surplus, idle research, upcoming weather and more, most urgent first.',
      'Quick actions under Maintenance: "Repair all" (shows count and cost) and "Refuel all" (tops up every fuel plant from the depot).',
      'Shift + drag in build mode places a straight row of the selected building; spots that are blocked, need land or exceed your money are skipped.',
      'Batteries show their charge level, coloured green while charging, red while discharging and grey when idle; other storage and the fuel depot have a level gauge.',
      'Fuel producers show how much of your plants\' full-load fuel use they cover ("75% of plants"); the depot shows how full it is. Hover them for details.',
    ],
  },
  {
    id: 'dams', title: 'Dams & flooding',
    items: [
      'A dam on a river floods the upstream tiles below its crest into a reservoir; the build preview shows the flooded area in blue and the land cost.',
      'Flooding removes any installations in the area (they are salvaged) — you must confirm first. Flooded tiles cannot be built on.',
      'Reservoirs store water: dams act as flexible generation, saving water when not needed. Dams further down the same river receive what upstream dams release.',
    ],
  },
  {
    id: 'maintenance', title: 'Wear, maintenance & repairs',
    items: [
      'Everything wears with use. Condition falls over time; low condition reduces output, and at very low condition a building stops. A small part of aging is irreversible.',
      'Each building has a maintenance load (work units, WU). Workers provide maintenance capacity; when load exceeds capacity, jobs queue. The queue is prioritised by urgency and ages so nothing starves.',
      'Buildings below their repair threshold (default per automation settings, or per building/type) get a repair job automatically. A manual repair from the Inspector is instant but costs a premium (minimum $1).',
      'Research adds preventive maintenance by idle crews and repair priority overrides. Maintenance Depots add work units on a map.',
    ],
  },
  {
    id: 'workforce', title: 'Workforce',
    items: [
      'Maintenance: Technician (2 WU), Maintenance Engineer (6), Robotic Service Unit (20).',
      'Logistics: Logistics Coordinator (1 slot), Fleet Manager (3), Autonomous Freight Fleet (8).',
      'Research: Research Assistant (3 RP/h), Scientist (12), Research Team (60), AI Research Cluster (500), Distributed Mind (5000).',
      'Trading: Energy Trader, Trading Desk Team, AI Trading Agent — raise contract prices and PPA slots.',
      'Workers cost a hiring fee and hourly wages. Better tiers need research. Training raises a group\'s capacity. If you stay overdrawn for 12 game hours, payroll protection lays staff off to stop a debt spiral.',
    ],
  },
  {
    id: 'research', title: 'Research',
    items: [
      'Research needs research points (RP) from researchers and labs, plus a one-off cost to start. Projects can need prerequisites, a specific map, or a milestone — click a requirement to jump to it.',
      'The Tree view groups projects into one area per map, with strings from each prerequisite to what it unlocks; hover a project to highlight its chain. Your view and filters are remembered.',
      'Each map also has a repeatable project (∞) costing 10× an average project there and 1.3× more per level. Every level gives a small permanent bonus for the run (reductions top out at −25%), so idle RP always has somewhere to go. More repeatables open in the Beyond area after Convergence Theory.',
      'Several projects can run at once. Allocation sliders are relative weights: RP is split between active projects in proportion to them, and when one finishes or is paused its share flows to the rest.',
      'Paused projects keep their progress and resume without paying again. Effects include unlocking buildings, retrofits, percentage bonuses and features such as automation or markets.',
    ],
  },
  {
    id: 'automation', title: 'Automation & operations',
    items: [
      'Automation screen: repair thresholds (global and per building type), automatic refuelling, fuel purchasing, PPA renewal, and a button to pause all automation.',
      'Operations screen: the repair queue, building condition overview and repair-all.',
      'Per building (Inspector): dispatch mode, operating target, cooling mode, storage mode, repair threshold and repair priority.',
    ],
  },
  {
    id: 'finance', title: 'Money & finances',
    items: [
      'Income: electricity sales to customers, exports, PPAs, and Backyard household income. Expenses: imports, fuel, wages, maintenance, repairs, operating costs, penalties and (optionally) carbon pricing.',
      'The Finances screen shows a ledger by category; each building shows its own revenue, cost, net and estimated payback in the Inspector.',
      'Carbon pricing can be enabled in Settings for a tougher, greener economy.',
    ],
  },
  {
    id: 'prestige', title: 'Prestige',
    items: [
      'Reset the run to earn prestige points = floor((lifetime sales / 100 000)^0.25). Points count against your best run so far (high-water mark): you only gain the increase.',
      'Spend points on permanent upgrades: revenue, cheaper maintenance, less wear, faster research, more workforce capacity, cheaper fuel and land, better storage, starting money, and quality-of-life perks (starting technician, automation from the start, keep Backyard land, keep early research, 48 h offline cap).',
      'Achievements, blueprints and prestige upgrades persist; maps, money, buildings and research reset.',
    ],
  },
  {
    id: 'blueprints', title: 'Blueprints',
    items: [
      'Save the layout of a map as a blueprint. After prestige (or on another map of the same scale), apply it: the dialog checks every item for terrain, land, research and money.',
      'Choose to build all items (only if every one is valid) or a valid subset while money lasts. Land is bought as needed when it is purchasable. Nothing is free — rebuilding uses normal prices.',
    ],
  },
  {
    id: 'offline', title: 'Offline progress & saves',
    items: [
      'The game autosaves every 20 seconds and whenever the tab is hidden or closed; four rotating save slots protect against corruption, and saves are checksummed and migrated between versions.',
      'While you are away the economy keeps running (up to 12 h, 48 h with Night Shift). On return a summary shows what happened. Automation keeps working offline.',
      'Settings: export a save to a file, import one, or start a new game.',
    ],
  },
  {
    id: 'ui', title: 'Interface & settings',
    items: [
      'Top bar: money, income, time, pause and speed, notifications, fullscreen. Left: maps. Tabs: management screens. Right: Build / Inspect / Map side panel (collapsible).',
      'Settings: theme, number format, animations and reduced motion, map overlays (names, values, maintenance, electrical), terrain labels and grid lines, carbon pricing.',
      'See the Shortcuts screen for every keyboard and mouse control.',
    ],
  },
];

export function HelpScreen() {
  const [q, setQ] = useState('');
  const ql = q.trim().toLowerCase();
  const list = SECTIONS.map((s) => ({ ...s, items: ql && !s.title.toLowerCase().includes(ql) ? s.items.filter((x) => x.toLowerCase().includes(ql)) : s.items })).filter((s) => s.items.length);
  return (
    <div className="p-3 flex flex-col gap-3" data-testid="help-screen">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-2 top-1.5 muted" />
          <input className="input pl-7 w-64" placeholder="Search the manual…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search help" />
        </div>
        <button className="btn btn-sm" onClick={() => useUI.getState().setScreen('shortcuts')}>Keyboard shortcuts</button>
      </div>
      <nav className="flex flex-wrap gap-1" aria-label="Help topics">
        {list.map((s) => <a key={s.id} href={`#help-${s.id}`} className="btn btn-sm btn-ghost">{s.title}</a>)}
      </nav>
      <div className="grid gap-3 grid-cols-1 xl:grid-cols-2">
        {list.map((s) => (
          <Card key={s.id} title={<span id={`help-${s.id}`}>{s.title}</span>}>
            <ul className="flex flex-col gap-1.5 list-disc pl-5">{s.items.map((x) => <li key={x}>{x}</li>)}</ul>
          </Card>
        ))}
        {!list.length && <p className="muted">Nothing matches “{q}”.</p>}
      </div>
    </div>
  );
}
