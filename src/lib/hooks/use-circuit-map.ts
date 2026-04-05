import useSWR from "swr";

export interface CircuitCorner {
  number: number;
  angle: number;
  length: number;
  trackPosition: { x: number; y: number };
}

export interface CircuitMapData {
  circuitKey: number;
  circuitName: string;
  countryName: string;
  location: string;
  rotation: number;
  year: number;
  x: number[];
  y: number[];
  corners: CircuitCorner[];
  marshalSectors: CircuitCorner[];
  marshalLights: CircuitCorner[];
}

const multiviewerFetcher = async (url: string): Promise<CircuitMapData> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MultiViewer API error: ${res.status}`);
  return res.json();
};

export function useCircuitMap(circuitKey: number | null, year: number) {
  return useSWR<CircuitMapData>(
    circuitKey
      ? `https://api.multiviewer.app/api/v1/circuits/${circuitKey}/${year}`
      : null,
    multiviewerFetcher,
    {
      // Circuit geometry is essentially static — don't re-fetch
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 1000 * 60 * 60 * 24, // 24h
    }
  );
}
