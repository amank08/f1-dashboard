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
    { zone: 1, name: "Back Straight", lengthMeters: 580, detection: [73.65, 41.78], start: [81.49, 40.29], end: [94.39, 26.5] },
    { zone: 2, name: "Main Straight", lengthMeters: 500, detection: [15.33, 46.64], start: [5.89, 50.95], end: [28.05, 70.81] },
  ],
  Sakhir: [
    { zone: 1, name: "Main Straight", lengthMeters: 650, detection: [20.86, 57.89], start: [19.37, 85.42], end: [20.96, 55.68] },
    { zone: 2, name: "Back Straight", lengthMeters: 580, detection: [29.54, 8.45], start: [36.58, 7.47], end: [80.21, 15.7] },
    { zone: 3, name: "Turn 11 Straight", lengthMeters: 310, detection: [50.51, 62.99], start: [52.1, 60.43], end: [72.17, 60.88] },
  ],
  Jeddah: [
    { zone: 1, name: "Main Straight", lengthMeters: 680, detection: [56.82, 80.88], start: [56.82, 80.88], end: [55.01, 75.19] },
    { zone: 2, name: "Sector 2 Straight", lengthMeters: 450, detection: [43.08, 33.5], start: [43.05, 30.26], end: [47.34, 6.66] },
    { zone: 3, name: "Sector 1 Straight", lengthMeters: 380, detection: [48.45, 56.88], start: [46.93, 54.17], end: [47.17, 46.28] },
  ],
  Melbourne: [
    { zone: 1, name: "Main Straight", lengthMeters: 550, detection: [63, 88.8], start: [59.64, 88.11], end: [41.77, 71.91] },
    { zone: 2, name: "Lakeside Straight", lengthMeters: 300, detection: [52.63, 34.43], start: [50.59, 41.12], end: [55.74, 55.72] },
  ],
  Suzuka: [
    { zone: 1, name: "Start/Finish Straight", lengthMeters: 700, detection: [72.15, 40.27], start: [74.94, 43.36], end: [76.64, 58.02] },
    { zone: 2, name: "Back Straight", lengthMeters: 400, detection: [80.02, 64.15], start: [77.13, 58.68], end: [69.49, 48.4] },
  ],
  Shanghai: [
    { zone: 1, name: "Main Straight", lengthMeters: 1170, detection: [43.47, 20.05], start: [57.36, 43.42], end: [76.15, 70.02] },
    { zone: 2, name: "Back Straight", lengthMeters: 520, detection: [54.9, 53.84], start: [58.86, 49.54], end: [57.36, 43.42] },
  ],
  Miami: [
    { zone: 1, name: "Main Straight", lengthMeters: 520, detection: [94.95, 36.79], start: [92.58, 34.94], end: [43.24, 33.39] },
    { zone: 2, name: "Back Straight", lengthMeters: 460, detection: [62.74, 66.64], start: [75.86, 62.19], end: [89.54, 54.37] },
  ],
  Imola: [
    { zone: 1, name: "Start/Finish Straight", lengthMeters: 590, detection: [93.99, 31.64], start: [88.95, 33.73], end: [60.96, 31.69] },
    { zone: 2, name: "Tamburello Straight", lengthMeters: 350, detection: [60.96, 31.69], start: [50.4, 29.58], end: [33.51, 30.68] },
  ],
  "Monte Carlo": [
    { zone: 1, name: "Tunnel/Start Straight", lengthMeters: 480, detection: [16.81, 49.54], start: [16.81, 49.54], end: [43.21, 42.48] },
  ],
  Montreal: [
    { zone: 1, name: "Start/Finish Straight", lengthMeters: 620, detection: [43.97, 14.56], start: [51.13, 25.26], end: [58.92, 57.77] },
    { zone: 2, name: "Back Straight", lengthMeters: 360, detection: [35.38, 57.29], start: [35.03, 49.66], end: [37.27, 35.76] },
  ],
  Catalunya: [
    { zone: 1, name: "Main Straight", lengthMeters: 600, detection: [87.19, 19.85], start: [86.43, 22.14], end: [74.97, 40.1] },
    { zone: 2, name: "Back Straight", lengthMeters: 475, detection: [38.73, 42.12], start: [39.5, 40.81], end: [75.48, 22.52] },
  ],
  Spielberg: [
    { zone: 1, name: "Main Straight", lengthMeters: 530, detection: [11.55, 30.84], start: [11.55, 30.84], end: [59.04, 34.95] },
    { zone: 2, name: "Straight to Turn 3", lengthMeters: 340, detection: [59.04, 34.95], start: [59.04, 34.95], end: [45.84, 37.51] },
  ],
  Silverstone: [
    { zone: 1, name: "Wellington Straight", lengthMeters: 600, detection: [33.34, 15.84], start: [36.96, 11.06], end: [63.08, 5] },
    { zone: 2, name: "Hangar Straight", lengthMeters: 520, detection: [74.45, 46.48], start: [76.08, 49.46], end: [74.95, 38.86] },
  ],
  Hungaroring: [
    { zone: 1, name: "Main Straight", lengthMeters: 590, detection: [56.02, 82.01], start: [56.02, 82.01], end: [25.57, 69.04] },
  ],
  "Spa-Francorchamps": [
    { zone: 1, name: "Kemmel Straight", lengthMeters: 750, detection: [43.58, 11.73], start: [57.11, 24.57], end: [58.66, 28.01] },
    { zone: 2, name: "Start/Finish Straight", lengthMeters: 390, detection: [43.42, 27.26], start: [43.56, 26.13], end: [31.55, 7.66] },
  ],
  Zandvoort: [
    { zone: 1, name: "Start/Finish Straight", lengthMeters: 510, detection: [5.67, 72.93], start: [20.46, 47.28], end: [20.54, 35.06] },
    { zone: 2, name: "Turn 11 Straight", lengthMeters: 270, detection: [86.76, 40.31], start: [93.03, 43.72], end: [93.91, 54.06] },
  ],
  Monza: [
    { zone: 1, name: "Main Straight", lengthMeters: 920, detection: [24.46, 73.43], start: [24.46, 73.43], end: [27.61, 37.58] },
    { zone: 2, name: "After Curva Grande", lengthMeters: 420, detection: [40.39, 11.96], start: [50.25, 10.98], end: [74.98, 7.06] },
  ],
  Baku: [
    { zone: 1, name: "Main Straight", lengthMeters: 2200, detection: [45.35, 51.86], start: [46.48, 51.36], end: [85.14, 35.61] },
    { zone: 2, name: "Straight to Turn 3", lengthMeters: 540, detection: [90.41, 19.4], start: [90.41, 19.4], end: [55.91, 36.52] },
  ],
  Singapore: [
    { zone: 1, name: "Pit Straight", lengthMeters: 480, detection: [89.88, 25.36], start: [90.53, 26.09], end: [92.74, 40.25] },
    { zone: 2, name: "Raffles Boulevard", lengthMeters: 410, detection: [71.83, 58.53], start: [70.72, 57.89], end: [45.64, 56.47] },
    { zone: 3, name: "Republic Boulevard", lengthMeters: 360, detection: [34.11, 34.91], start: [35.04, 34.24], end: [54.3, 44.02] },
  ],
  "Mexico City": [
    { zone: 1, name: "Main Straight", lengthMeters: 710, detection: [10.56, 18.18], start: [12.49, 17.87], end: [20.8, 18.55] },
    { zone: 2, name: "Peraltada Straight", lengthMeters: 380, detection: [5.24, 25.19], start: [5.64, 21.66], end: [10.56, 18.18] },
    { zone: 3, name: "Back Straight", lengthMeters: 310, detection: [92, 46.25], start: [83.19, 60.61], end: [75.76, 71.86] },
  ],
  Interlagos: [
    { zone: 1, name: "Reta Oposta", lengthMeters: 520, detection: [69.77, 27.13], start: [69.77, 27.13], end: [57.47, 32.3] },
    { zone: 2, name: "Main Straight", lengthMeters: 640, detection: [22.3, 51.17], start: [25.98, 67.92], end: [31.51, 88.24] },
  ],
  "Las Vegas": [
    { zone: 1, name: "Main Straight", lengthMeters: 1920, detection: [23.37, 47.41], start: [23.37, 47.41], end: [23.25, 90.64] },
    { zone: 2, name: "Koval Straight", lengthMeters: 610, detection: [63.31, 80.37], start: [62.03, 78.66], end: [61.49, 37.67] },
  ],
  Lusail: [
    { zone: 1, name: "Main Straight", lengthMeters: 1070, detection: [44.57, 94.14], start: [43.54, 93.09], end: [24.68, 59.01] },
    { zone: 2, name: "Back Straight", lengthMeters: 380, detection: [48.63, 26.76], start: [50.29, 26.25], end: [66.84, 20.3] },
  ],
  "Yas Marina Circuit": [
    { zone: 1, name: "Main Straight", lengthMeters: 620, detection: [34.77, 57.72], start: [34.77, 57.72], end: [49.28, 56.04] },
    { zone: 2, name: "Back Straight", lengthMeters: 540, detection: [51.8, 32.19], start: [34.21, 46.75], end: [29.03, 62.87] },
  ],
};

export function getDrsZones(circuitShortName: string): DrsZone[] | null {
  return DRS_ZONES[circuitShortName] ?? null;
}
