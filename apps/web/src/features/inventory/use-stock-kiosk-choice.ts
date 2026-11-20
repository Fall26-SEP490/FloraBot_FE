import { useCallback, useSyncExternalStore } from 'react';

const changed = 'florabot:stock-kiosk-choice';
const fallback = new Map<string, string>();
const serverSnapshot = () => null;
const subscribe = (notify: () => void) => {
  window.addEventListener(changed, notify);
  window.addEventListener('storage', notify);
  return () => {
    window.removeEventListener(changed, notify);
    window.removeEventListener('storage', notify);
  };
};

export function useStockKioskChoice(actorId: string, sellerId: string | null | undefined) {
  const key = `florabot:stock-kiosk:${actorId}:${sellerId ?? ''}`;
  const read = useCallback(() => {
    try {
      return window.localStorage.getItem(key) ?? fallback.get(key) ?? '';
    } catch {
      return fallback.get(key) ?? '';
    }
  }, [key]);
  const choice = useSyncExternalStore<string | null>(subscribe, read, serverSnapshot);
  const save = useCallback(
    (id: string) => {
      fallback.set(key, id);
      try {
        window.localStorage.setItem(key, id);
      } catch {
        /* Keep the choice in this browser session. */
      }
      window.dispatchEvent(new Event(changed));
    },
    [key],
  );
  return [choice, save] as const;
}
