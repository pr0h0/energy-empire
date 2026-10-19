import {
  Activity, Award, BarChart3, Bell, BookMarked, Building, Building2, Cog, Factory, Flame, FlaskConical, Fuel, Gauge, Globe2, Home, Infinity as InfinityIcon,
  CircleHelp, Keyboard, Landmark, LineChart, Map, Orbit, Sparkles, Star, Sun, Trophy, TrendingUp, Users, Wallet, Wrench, Zap, type LucideIcon,
} from 'lucide-react';
import type { StageId } from '../../engine/data/types';
import type { Screen } from '../stores/uiStore';

export const STAGE_ICON: Record<StageId, LucideIcon> = {
  backyard: Home, neighborhood: Users, city: Building2, country: Landmark, continent: Map, planet: Globe2, solar: Sun, galaxy: Sparkles, universe: InfinityIcon,
};

export const SCREENS: { id: Screen; label: string; icon: LucideIcon }[] = [
  { id: 'map', label: 'Map', icon: Map },
  { id: 'research', label: 'Research', icon: FlaskConical },
  { id: 'workforce', label: 'Workforce', icon: Users },
  { id: 'operations', label: 'Operations', icon: Wrench },
  { id: 'automation', label: 'Automation', icon: Cog },
  { id: 'fuel', label: 'Fuel', icon: Fuel },
  { id: 'market', label: 'Market', icon: TrendingUp },
  { id: 'thermal', label: 'Thermal', icon: Flame },
  { id: 'finance', label: 'Finances', icon: Wallet },
  { id: 'stats', label: 'Statistics', icon: LineChart },
  { id: 'progress', label: 'Progression', icon: Activity },
  { id: 'blueprints', label: 'Blueprints', icon: BookMarked },
  { id: 'prestige', label: 'Prestige', icon: Star },
  { id: 'achievements', label: 'Achievements', icon: Trophy },
  { id: 'settings', label: 'Settings', icon: Cog },
  { id: 'help', label: 'Help', icon: CircleHelp },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
];

export { Award, BarChart3, Bell, Building, Factory, Gauge, Orbit, Zap };
