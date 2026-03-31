"use client";

import { useEffect, useRef, useState } from "react";
import { SWRConfig, type Cache, type State } from "swr";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = body?.error ?? `API error: ${res.status}`;
    throw new Error(message);
  }
  return res.json();
};

const STORAGE_KEY = "f1-swr-cache";

type SWRCacheMap = Map<string, State<unknown, unknown>>;

function loadCache(): SWRCacheMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    return new Map(JSON.parse(raw) as [string, State<unknown, unknown>][]);
  } catch {
    return new Map();
  }
}

function saveCache(map: SWRCacheMap) {
  try {
    const entries = [...map.entries()].slice(-200);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }
}

export function SWRProvider({ children }: { children: React.ReactNode }) {
  const mapRef = useRef<SWRCacheMap>(new Map());
  const [ready, setReady] = useState(false);

  // Load localStorage cache AFTER hydration to avoid mismatch
  useEffect(() => {
    const stored = loadCache();
    for (const [key, value] of stored) {
      mapRef.current.set(key, value);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration flag after loading localStorage
    setReady(true);
  }, []);

  // Periodic save + save on unload
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    const onUnload = () => saveCache(map);
    window.addEventListener("beforeunload", onUnload);
    const interval = setInterval(() => saveCache(map), 30_000);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      clearInterval(interval);
      saveCache(map);
    };
  }, [ready]);

  return (
    <SWRConfig
      value={{
        fetcher,
        provider: () => mapRef.current as Cache,
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        dedupingInterval: 5000,
        errorRetryCount: 3,
        errorRetryInterval: 2000,
      }}
    >
      {children}
    </SWRConfig>
  );
}
