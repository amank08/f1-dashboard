export interface DrsZone {
  zone: number;
  name: string;
  lengthMeters: number;
  /** Detection point on the SVG track path */
  detection: [number, number];
  /** Activation (zone start) point on the SVG track path */
  start: [number, number];
  /** Zone end point on the SVG track path */
  end: [number, number];
}

// DRS zone data per circuit (applicable through 2025; shown as
// straight-line mode zones for 2026+). Coordinates are actual points
// from the SVG path data in circuit-paths.ts.
// Keyed by circuit_short_name.

const DRS_ZONES: Record<string, DrsZone[]> = {
  Austin: [
    { zone: 1, name: "Back Straight", lengthMeters: 580, detection: [73.89, 43.25], start: [82.28, 41.64], end: [93.46, 27.8] },
    { zone: 2, name: "Main Straight", lengthMeters: 500, detection: [16.32, 46.62], start: [5.9, 50.55], end: [23.05, 64.12] },
  ],
  Sakhir: [
    { zone: 1, name: "Main Straight", lengthMeters: 650, detection: [16.9, 67.26], start: [16.26, 85.14], end: [18.38, 47.66] },
    { zone: 2, name: "Back Straight", lengthMeters: 580, detection: [28.34, 9.32], start: [34.95, 7.39], end: [81.32, 14.86] },
    { zone: 3, name: "Turn 11 Straight", lengthMeters: 310, detection: [50.45, 62.04], start: [51.63, 59.96], end: [72.45, 60.58] },
  ],
  Jeddah: [
    { zone: 1, name: "Main Straight", lengthMeters: 680, detection: [57.93, 83.05], start: [57.11, 80.35], end: [54.98, 74.3] },
    { zone: 2, name: "Sector 2 Straight", lengthMeters: 450, detection: [42.67, 33.92], start: [42.53, 30.02], end: [47.34, 6.49] },
    { zone: 3, name: "Sector 1 Straight", lengthMeters: 380, detection: [48.51, 56.65], start: [48.28, 53.69], end: [47.08, 46.43] },
  ],
  Melbourne: [
    { zone: 1, name: "Main Straight", lengthMeters: 550, detection: [62.5, 87.74], start: [60.89, 87.1], end: [40.59, 70.74] },
    { zone: 2, name: "Lakeside Straight", lengthMeters: 300, detection: [53.54, 32.64], start: [51.54, 40.67], end: [55.55, 53.7] },
  ],
  Suzuka: [
    { zone: 1, name: "Start/Finish Straight", lengthMeters: 700, detection: [72.86, 42.42], start: [74, 43.47], end: [81.86, 51.34] },
    { zone: 2, name: "Back Straight", lengthMeters: 400, detection: [80.92, 62.43], start: [77.54, 57.96], end: [69.51, 49.13] },
  ],
  Shanghai: [
    { zone: 1, name: "Main Straight", lengthMeters: 1170, detection: [45.93, 19.03], start: [63.07, 41.3], end: [77.49, 67.45] },
    { zone: 2, name: "Back Straight", lengthMeters: 520, detection: [54.69, 53.93], start: [58.53, 50.21], end: [51.22, 37.42] },
  ],
  Miami: [
    { zone: 1, name: "Main Straight", lengthMeters: 520, detection: [94.09, 36.81], start: [91.22, 36.57], end: [49.86, 35.26] },
    { zone: 2, name: "Back Straight", lengthMeters: 460, detection: [64.58, 64.35], start: [72.89, 61.62], end: [89.19, 54.36] },
  ],
  Imola: [
    { zone: 1, name: "Start/Finish Straight", lengthMeters: 590, detection: [92.12, 33.39], start: [90.92, 33.47], end: [62.1, 37.25] },
    { zone: 2, name: "Tamburello Straight", lengthMeters: 350, detection: [60.5, 37.24], start: [50.54, 35.71], end: [34.53, 36.09] },
  ],
  "Monte Carlo": [
    { zone: 1, name: "Tunnel/Start Straight", lengthMeters: 480, detection: [8.4, 47.72], start: [10.49, 47.35], end: [41, 43.1] },
  ],
  Montreal: [
    { zone: 1, name: "Start/Finish Straight", lengthMeters: 620, detection: [46.82, 14.55], start: [52.91, 25.58], end: [62.64, 57.27] },
    { zone: 2, name: "Back Straight", lengthMeters: 360, detection: [29.73, 58.63], start: [29.2, 50.7], end: [32.91, 35.2] },
  ],
  Catalunya: [
    { zone: 1, name: "Main Straight", lengthMeters: 600, detection: [94.73, 22.94], start: [93.4, 24.91], end: [75.9, 45.6] },
    { zone: 2, name: "Back Straight", lengthMeters: 475, detection: [37.75, 41.51], start: [38.91, 40.84], end: [79.4, 25.29] },
  ],
  Spielberg: [
    { zone: 1, name: "Main Straight", lengthMeters: 530, detection: [5.03, 31.51], start: [6.83, 31.13], end: [60.39, 34.22] },
    { zone: 2, name: "Straight to Turn 3", lengthMeters: 340, detection: [62.35, 36.15], start: [60.65, 38.01], end: [47.09, 41.62] },
  ],
  Silverstone: [
    { zone: 1, name: "Wellington Straight", lengthMeters: 600, detection: [27.69, 12.21], start: [33.18, 8.82], end: [58.32, 5.85] },
    { zone: 2, name: "Hangar Straight", lengthMeters: 520, detection: [74.28, 47.86], start: [79.88, 46.01], end: [79.91, 38.53] },
  ],
  Hungaroring: [
    { zone: 1, name: "Main Straight", lengthMeters: 590, detection: [58.41, 83.9], start: [57.26, 83.37], end: [27.44, 67.41] },
  ],
  "Spa-Francorchamps": [
    { zone: 1, name: "Kemmel Straight", lengthMeters: 750, detection: [44.37, 11.98], start: [58.45, 22.53], end: [65.34, 26.33] },
    { zone: 2, name: "Start/Finish Straight", lengthMeters: 390, detection: [43.76, 27.29], start: [43.59, 26.44], end: [32.71, 14.54] },
  ],
  Zandvoort: [
    { zone: 1, name: "Start/Finish Straight", lengthMeters: 510, detection: [5.82, 63.01], start: [15.47, 48.72], end: [26.08, 33.1] },
    { zone: 2, name: "Turn 11 Straight", lengthMeters: 270, detection: [86.68, 44.9], start: [91, 45.85], end: [93.11, 54.14] },
  ],
  Monza: [
    { zone: 1, name: "Main Straight", lengthMeters: 920, detection: [14.47, 66.01], start: [15.15, 62.16], end: [18.3, 36.91] },
    { zone: 2, name: "After Curva Grande", lengthMeters: 420, detection: [40.25, 11.59], start: [49.62, 11.03], end: [80.09, 5.15] },
  ],
  Baku: [
    { zone: 1, name: "Main Straight", lengthMeters: 2200, detection: [45.47, 51.87], start: [48.43, 50.72], end: [87.8, 37.78] },
    { zone: 2, name: "Straight to Turn 3", lengthMeters: 540, detection: [89.42, 25.15], start: [88.72, 24.94], end: [55.13, 35.91] },
  ],
  Singapore: [
    { zone: 1, name: "Pit Straight", lengthMeters: 480, detection: [90.86, 25.05], start: [91.1, 25.95], end: [93.03, 43.03] },
    { zone: 2, name: "Raffles Boulevard", lengthMeters: 410, detection: [72.45, 58.67], start: [71.02, 58.22], end: [45.39, 56.87] },
    { zone: 3, name: "Republic Boulevard", lengthMeters: 360, detection: [34.39, 34.47], start: [35.49, 33.44], end: [53.25, 43.59] },
  ],
  "Mexico City": [
    { zone: 1, name: "Main Straight", lengthMeters: 710, detection: [9.92, 19.73], start: [12.51, 19.36], end: [21.44, 20.56] },
    { zone: 2, name: "Peraltada Straight", lengthMeters: 380, detection: [5.23, 24.85], start: [6.39, 22.53], end: [9.92, 19.73] },
    { zone: 3, name: "Back Straight", lengthMeters: 310, detection: [92.29, 45.88], start: [84.7, 58.03], end: [75.6, 71.51] },
  ],
  Interlagos: [
    { zone: 1, name: "Reta Oposta", lengthMeters: 520, detection: [70.76, 27.55], start: [68.7, 27.34], end: [52.39, 40.09] },
    { zone: 2, name: "Main Straight", lengthMeters: 640, detection: [20.86, 53.95], start: [23.57, 64.36], end: [30.48, 89.09] },
  ],
  "Las Vegas": [
    { zone: 1, name: "Main Straight", lengthMeters: 1920, detection: [17.57, 47.21], start: [17.62, 53.84], end: [16.59, 91.68] },
    { zone: 2, name: "Koval Straight", lengthMeters: 610, detection: [64.07, 79.09], start: [63.49, 77.75], end: [63.09, 38.24] },
  ],
  Lusail: [
    { zone: 1, name: "Main Straight", lengthMeters: 1070, detection: [44.54, 94.46], start: [43.4, 93.56], end: [22.59, 59.47] },
    { zone: 2, name: "Back Straight", lengthMeters: 380, detection: [48.66, 26.82], start: [49.53, 26.46], end: [66.41, 20.36] },
  ],
  "Yas Marina Circuit": [
    { zone: 1, name: "Main Straight", lengthMeters: 620, detection: [33.29, 57.7], start: [34.67, 57.35], end: [49.42, 55.42] },
    { zone: 2, name: "Back Straight", lengthMeters: 540, detection: [38.39, 30.77], start: [35.7, 38], end: [27.14, 62.63] },
  ],
};

export function getDrsZones(circuitShortName: string): DrsZone[] | null {
  return DRS_ZONES[circuitShortName] ?? null;
}
