import { useEffect } from 'react';
import { speedCap } from '../engine/core/Helpers';
import { STAGE_LIST } from '../engine/data/stages';
import { SCREENS as SCREEN_TABS } from './components/icons';
import { TopBar, useFullscreenSync } from './layouts/TopBar';
import { StageNav } from './navigation/StageNav';
import { ScreenTabs } from './navigation/ScreenTabs';
import { MapScreen } from './screens/MapScreen';
import { HelpScreen } from './screens/HelpScreen';
import { ShortcutsScreen } from './screens/ShortcutsScreen';
import { SidePanel } from './panels/SidePanel';
import { ResearchScreen } from './screens/ResearchScreen';
import { WorkforceScreen } from './screens/WorkforceScreen';
import { OperationsScreen } from './screens/OperationsScreen';
import { AutomationScreen } from './screens/AutomationScreen';
import { FuelScreen } from './screens/FuelScreen';
import { MarketScreen } from './screens/MarketScreen';
import { ThermalScreen } from './screens/ThermalScreen';
import { FinanceScreen } from './screens/FinanceScreen';
import { StatsScreen } from './screens/StatsScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { BlueprintsScreen } from './screens/BlueprintsScreen';
import { PrestigeScreen } from './screens/PrestigeScreen';
import { AchievementsScreen } from './screens/AchievementsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { EventsDrawer, IncidentPrompt, OfflineModal, Toasts, WinModal } from './components/Overlays';
import { TipLayer } from './components/TipLayer';
import { useUI, type Screen } from './stores/uiStore';
import { useGame } from './hooks/useGame';
import { cmd, engine } from './game';
import { PanelRightOpen } from 'lucide-react';

const SCREENS: Record<Exclude<Screen, 'map'>, () => React.ReactElement> = {
  research: ResearchScreen, workforce: WorkforceScreen, operations: OperationsScreen, automation: AutomationScreen, fuel: FuelScreen, market: MarketScreen,
  thermal: ThermalScreen, finance: FinanceScreen, stats: StatsScreen, progress: ProgressScreen, blueprints: BlueprintsScreen, prestige: PrestigeScreen,
  achievements: AchievementsScreen, settings: SettingsScreen, help: HelpScreen, shortcuts: ShortcutsScreen,
};

export function App() {
  const ui = useUI();
  const theme = useGame((s) => s.settings.theme);
  const reduced = useGame((s) => s.settings.reducedMotion);
  useFullscreenSync();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle('reduced-motion', reduced);
  }, [theme, reduced]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,textarea,select,[role=dialog]') || e.ctrlKey || e.metaKey || e.altKey) return;
      const s = engine.state;
      const u = useUI.getState();
      // 1-9 open the first nine tabs; ←/→ walk every tab and wrap
      const tabs = SCREEN_TABS.map((x) => x.id);
      const at = tabs.indexOf(u.screen);
      if (e.code === 'Space') cmd({ type: 'pause', paused: !s.paused });
      else if (e.key === 't' || e.key === 'T') cmd({ type: 'setSpeed', speed: (s.speed % speedCap(s)) + 1 });
      else if (e.key >= '1' && e.key <= '9') u.setScreen(tabs[Number(e.key) - 1]);
      else if (e.key === 'ArrowRight') u.setScreen(tabs[(at + 1) % tabs.length]);
      else if (e.key === 'ArrowLeft') u.setScreen(tabs[(at - 1 + tabs.length) % tabs.length]);
      else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        // ↑/↓ walk the unlocked maps in the stage list; stepping past either end shows what the next map needs
        const open = STAGE_LIST.filter((st) => s.maps[st.id]).map((st) => st.id);
        const next = open[open.indexOf(u.map) + (e.key === 'ArrowUp' ? -1 : 1)];
        if (next) {
          u.setMap(next);
          u.setScreen('map');
        } else u.setScreen('progress');
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  // a locked map (e.g. after prestige) falls back to the Backyard
  const mapOk = useGame((s) => !!s.maps[ui.map]);
  useEffect(() => {
    if (!mapOk) ui.setMap('backyard');
  }, [mapOk, ui]);
  const Screen = ui.screen === 'map' ? null : SCREENS[ui.screen];
  return (
    <div className="h-full flex flex-col" data-testid="app">
      <TopBar />
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <StageNav />
        <main className="flex-1 min-w-0 min-h-0 flex flex-col">
          <ScreenTabs />
          {Screen ? (
            <div className="flex-1 min-h-0 scroll"><Screen /></div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col md:flex-row relative">
              <MapScreen />
              {!ui.sidebar && (
                <button className="btn btn-sm absolute right-2 top-2 z-20" onClick={() => ui.set({ sidebar: true })} aria-label="Open side panel" data-testid="toggle-sidebar"><PanelRightOpen size={15} /></button>
              )}
              {ui.sidebar && (
                <div className="absolute md:static inset-y-0 right-0 z-30 w-[min(360px,100%)] md:w-auto flex shadow-2xl md:shadow-none">
                  <SidePanel />
                </div>
              )}
            </div>
          )}
        </main>
      </div>
      <EventsDrawer />
      <Toasts />
      <TipLayer />
      <OfflineModal />
      <WinModal />
      <IncidentPrompt />
    </div>
  );
}
