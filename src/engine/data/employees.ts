import type { EmployeeTier } from './types';

/**
 * Workforce tiers. Maintenance/logistics crews are hired per map and their hire cost and wages
 * scale with that map's stage scale. Researchers and traders are company-wide; their tiers
 * already encode cost growth.
 */
const e = (d: EmployeeTier): EmployeeTier => Object.freeze(d);

export const EMPLOYEES: Record<string, EmployeeTier> = Object.fromEntries(
  [
    e({ id: 'technician', group: 'maintenance', name: 'Technician', capacity: 2, hire: 15, wage: 0.06 }),
    e({ id: 'engineer', group: 'maintenance', name: 'Maintenance Engineer', capacity: 6, hire: 110, wage: 0.15, research: 'workforce_2' }),
    e({ id: 'robot', group: 'maintenance', name: 'Robotic Service Unit', capacity: 20, hire: 700, wage: 0.4, research: 'workforce_3' }),
    e({ id: 'driver', group: 'logistics', name: 'Logistics Coordinator', capacity: 1, hire: 20, wage: 0.07 }),
    e({ id: 'fleet_manager', group: 'logistics', name: 'Fleet Manager', capacity: 3, hire: 150, wage: 0.18, research: 'workforce_2' }),
    e({ id: 'autofreight', group: 'logistics', name: 'Autonomous Freight Fleet', capacity: 8, hire: 900, wage: 0.45, research: 'workforce_3' }),
    e({ id: 'assistant', group: 'research', name: 'Research Assistant', capacity: 3, hire: 25, wage: 0.08 }),
    e({ id: 'scientist', group: 'research', name: 'Scientist', capacity: 12, hire: 600, wage: 1 }),
    e({ id: 'research_team', group: 'research', name: 'Research Team', capacity: 60, hire: 4e4, wage: 40, research: 'research_2' }),
    e({ id: 'ai_cluster', group: 'research', name: 'AI Research Cluster', capacity: 500, hire: 6e6, wage: 5e3, research: 'research_3' }),
    e({ id: 'dist_mind', group: 'research', name: 'Distributed Mind', capacity: 5000, hire: 3e9, wage: 2e6, research: 'research_4' }),
    e({ id: 'analyst', group: 'trading', name: 'Energy Trader', capacity: 1, hire: 2000, wage: 6, research: 'markets_1' }),
    e({ id: 'desk_team', group: 'trading', name: 'Trading Desk Team', capacity: 4, hire: 2e5, wage: 300, research: 'markets_3' }),
    e({ id: 'ai_trader', group: 'trading', name: 'AI Trading Agent', capacity: 20, hire: 5e9, wage: 1e6, research: 'markets_4' }),
  ].map((x) => [x.id, x]),
);

export const EMPLOYEE_LIST = Object.values(EMPLOYEES);
export const MAP_GROUPS = ['maintenance', 'logistics'] as const;
