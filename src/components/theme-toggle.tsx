"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

const key = "tippo.theme.v1";
function subscribe(listener: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === key) { document.documentElement.dataset.theme = event.newValue === "dark" ? "dark" : "light"; listener(); }
  };
  window.addEventListener("tippo-theme", listener);
  window.addEventListener("storage", storage);
  return () => { window.removeEventListener("tippo-theme", listener); window.removeEventListener("storage", storage); };
}
export function ThemeToggle({ menu = false }: { menu?: boolean }) {
  const dark = useSyncExternalStore(subscribe, () => document.documentElement.dataset.theme === "dark", () => false);
  const label = dark ? "Mode terang" : "Mode gelap";
  return <button type="button" className={menu ? "theme-menu-action" : "theme-toggle"} role={menu ? "menuitem" : undefined} tabIndex={menu ? -1 : undefined} aria-label={label} title={label} onClick={() => {
    const theme = dark ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(key, theme); } catch { /* Theme still works when browser storage is unavailable. */ }
    window.dispatchEvent(new Event("tippo-theme"));
  }}>{dark ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}{menu && label}</button>;
}
