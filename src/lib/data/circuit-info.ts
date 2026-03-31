/** Circuit lap length in km, keyed by OpenF1 circuit_short_name */
export const CIRCUIT_LAP_LENGTH: Record<string, number> = {
  Austin: 5.513,
  Baku: 6.003,
  Catalunya: 4.657,
  Hungaroring: 4.381,
  Imola: 4.909,
  Interlagos: 4.309,
  Jeddah: 6.174,
  "Las Vegas": 6.201,
  Lusail: 5.419,
  Melbourne: 5.278,
  "Mexico City": 4.304,
  Miami: 5.412,
  "Monte Carlo": 3.337,
  Montreal: 4.361,
  Monza: 5.793,
  Sakhir: 5.412,
  Shanghai: 5.451,
  Silverstone: 5.891,
  Singapore: 4.940,
  "Spa-Francorchamps": 7.004,
  Spielberg: 4.318,
  Suzuka: 5.807,
  "Yas Marina Circuit": 5.281,
  Zandvoort: 4.259,
};

export function getCircuitLapLength(circuitShortName: string): number | null {
  return CIRCUIT_LAP_LENGTH[circuitShortName] ?? null;
}

/** Number of turns per circuit, keyed by OpenF1 circuit_short_name */
export const CIRCUIT_TURNS: Record<string, number> = {
  Austin: 20,
  Baku: 20,
  Catalunya: 16,
  Hungaroring: 14,
  Imola: 19,
  Interlagos: 15,
  Jeddah: 27,
  "Las Vegas": 17,
  Lusail: 16,
  Melbourne: 14,
  "Mexico City": 17,
  Miami: 19,
  "Monte Carlo": 19,
  Montreal: 14,
  Monza: 11,
  Sakhir: 15,
  Shanghai: 16,
  Silverstone: 18,
  Singapore: 19,
  "Spa-Francorchamps": 19,
  Spielberg: 10,
  Suzuka: 18,
  "Yas Marina Circuit": 16,
  Zandvoort: 14,
};

export function getCircuitTurns(circuitShortName: string): number | null {
  return CIRCUIT_TURNS[circuitShortName] ?? null;
}
