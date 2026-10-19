import type { FuelDef, FuelId } from './types';

const f = (d: FuelDef): FuelDef => Object.freeze(d);

/** Prices are per unit; per-kWh_th price = price / energyPerUnit. */
export const FUELS: Record<FuelId, FuelDef> = {
  diesel: f({ availableFrom: 'neighborhood', id: 'diesel', name: 'Diesel', unit: 'm³', energyPerUnit: 10_000, price: 900, volatility: 0.15, deliveryH: 4, emissions: 0.27 }),
  gas: f({ availableFrom: 'neighborhood', id: 'gas', name: 'Natural gas', unit: '1000 m³', energyPerUnit: 10_000, price: 250, volatility: 0.2, deliveryH: 3, emissions: 0.2 }),
  coal: f({ availableFrom: 'city', id: 'coal', name: 'Coal', unit: 't', energyPerUnit: 8_000, price: 110, volatility: 0.1, deliveryH: 8, emissions: 0.34 }),
  biomass: f({ availableFrom: 'neighborhood', id: 'biomass', name: 'Biomass', unit: 't', energyPerUnit: 4_500, price: 120, volatility: 0.08, deliveryH: 5, emissions: 0.02 }),
  uranium: f({ availableFrom: 'country', id: 'uranium', name: 'Nuclear fuel', unit: 'kg', energyPerUnit: 1_000_000, price: 900, volatility: 0.05, deliveryH: 24, emissions: 0 }),
  fusion: f({ availableFrom: 'planet', id: 'fusion', name: 'D-T fusion fuel', unit: 'g', energyPerUnit: 94_000, price: 6, volatility: 0.05, deliveryH: 12, emissions: 0 }),
  he3: f({ availableFrom: 'solar', id: 'he3', name: 'Helium-3', unit: 'kt', energyPerUnit: 1.6e14, price: 1.2e6, volatility: 0.05, deliveryH: 30, emissions: 0 }),
  stellar: f({ availableFrom: 'galaxy', id: 'stellar', name: 'Stellar matter', unit: 'Tt', energyPerUnit: 2.5e24, price: 1.1e7, volatility: 0.03, deliveryH: 40, emissions: 0 }),
  exotic: f({ availableFrom: 'universe', id: 'exotic', name: 'Exotic matter catalyst', unit: 'unit', energyPerUnit: 1e40, price: 1.5e16, volatility: 0.02, deliveryH: 48, emissions: 0 }),
};

export const FUEL_IDS = Object.keys(FUELS) as FuelId[];
