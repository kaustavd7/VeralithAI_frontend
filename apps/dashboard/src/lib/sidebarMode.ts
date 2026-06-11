import { useEffect, useState } from 'react';

/* Sidebar display mode — a single workspace-wide preference shared by the
   sidebar (hover/width behaviour) and the shell (content padding). Persisted
   per-browser; changes broadcast via a window event so every mounted consumer
   (sidebar + shell) updates together. */
export type SidebarMode = 'expanded' | 'collapsed' | 'hover';

const KEY = 'veralith.sidebarMode';
const EVT = 'veralith:sidebar-mode';

export function getSidebarMode(): SidebarMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'expanded' || v === 'collapsed' || v === 'hover') return v;
  } catch {
    /* localStorage unavailable (privacy mode) — fall through */
  }
  return 'hover';
}

export function setSidebarMode(mode: SidebarMode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* ignore quota / privacy-mode errors */
  }
  window.dispatchEvent(new CustomEvent<SidebarMode>(EVT, { detail: mode }));
}

/** Subscribe to the shared sidebar mode. Returns [mode, setMode]. */
export function useSidebarMode(): [SidebarMode, (mode: SidebarMode) => void] {
  const [mode, setMode] = useState<SidebarMode>(() => getSidebarMode());

  useEffect(() => {
    const onEvt = (e: Event) => setMode((e as CustomEvent<SidebarMode>).detail);
    window.addEventListener(EVT, onEvt as EventListener);
    return () => window.removeEventListener(EVT, onEvt as EventListener);
  }, []);

  return [mode, setSidebarMode];
}
