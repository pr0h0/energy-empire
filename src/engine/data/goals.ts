import type { StageDef } from './types';

/** Per-map objectives, scaled by each stage's base demand; rewards scale with its land price. */
export type GoalKind = 'capacity' | 'storage' | 'offgrid' | 'clean';
export interface GoalDef {
  kind: GoalKind;
  name: string;
  desc: (st: StageDef) => string;
  /** target in the goal's unit (kW, kWh or hours) */
  target: (st: StageDef) => number;
}
export const GOALS: GoalDef[] = [
  { kind: 'capacity', name: 'Overbuilt', desc: () => 'Install generation of at least 3× the base demand.', target: (st) => st.baseDemandKW * 3 },
  { kind: 'storage', name: 'Night shift', desc: () => 'Have storage for 4 hours of base demand.', target: (st) => st.baseDemandKW * 4 },
  { kind: 'offgrid', name: 'Self-reliant', desc: () => 'Run 24 hours in a row without importing any power.', target: () => 24 },
  { kind: 'clean', name: 'Clean streak', desc: () => 'Generate for 72 hours in a row without burning fossil fuel.', target: () => 72 },
];
export const goalReward = (st: StageDef) => st.landBase * 6;

/** Optional run modifiers chosen at prestige; harder runs pay extra prestige points. */
export type ChallengeId = 'no_fossil' | 'off_grid' | 'tight';
export const CHALLENGES: Record<ChallengeId, { name: string; desc: string; bonus: number }> = {
  no_fossil: { name: 'Fossil-free', desc: 'Diesel, gas and coal plants cannot be built.', bonus: 0.25 },
  off_grid: { name: 'Off-grid', desc: 'No grid imports on any map except the Backyard.', bonus: 0.4 },
  tight: { name: 'Tight margins', desc: 'Wages, grid fees and plant upkeep cost 50% more.', bonus: 0.3 },
};
export const CHALLENGE_IDS = Object.keys(CHALLENGES) as ChallengeId[];
