"use client";

import { useSyncExternalStore } from "react";
import type { AppData } from "./types";
import { seedData } from "./seed";
import { isAppData } from "./validation";
import { normalizeAppData } from "./migration";
export { isAppData } from "./validation";
export { normalizeAppData } from "./migration";

const KEY = "tippo.workspace.v1";
let snapshot: AppData | undefined;
const listeners = new Set<() => void>();


function getSnapshot(): AppData {
  if (snapshot) return snapshot;
  if (typeof window === "undefined") return seedData;
  try {
    const saved = window.localStorage.getItem(KEY);
    const parsed = saved ? JSON.parse(saved) : null;
    snapshot = normalizeAppData(parsed) ?? structuredClone(seedData);
  } catch {
    snapshot = structuredClone(seedData);
  }
  return snapshot;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) {
      snapshot = undefined;
      listeners.forEach((notify) => notify());
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useAppData() {
  return useSyncExternalStore(subscribe, getSnapshot, () => seedData);
}

/** Returns false if the browser cannot persist the otherwise valid update. */
export function saveAppData(next: AppData): boolean {
  if (!isAppData(next)) throw new Error("Data tidak valid. Perubahan belum disimpan.");
  snapshot = next;
  let persisted = true;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    persisted = false;
  }
  listeners.forEach((notify) => notify());
  return persisted;
}
