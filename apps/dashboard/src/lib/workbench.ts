/* Cross-tree opener for the global "For the Geeks" Workbench drawer. The drawer
   owns its own open/tab state; anywhere in the app can ask it to open on a
   given tab via a window CustomEvent (same pattern as lib/sidebarMode). */

export type WbTabName = 'Integration' | 'Logs' | 'Health' | 'Shell';

const EVT = 'veralith:open-workbench';

export function openWorkbench(tab: WbTabName = 'Integration'): void {
  window.dispatchEvent(new CustomEvent<WbTabName>(EVT, { detail: tab }));
}

export function onOpenWorkbench(cb: (tab: WbTabName) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<WbTabName>).detail);
  window.addEventListener(EVT, handler);
  return () => window.removeEventListener(EVT, handler);
}
