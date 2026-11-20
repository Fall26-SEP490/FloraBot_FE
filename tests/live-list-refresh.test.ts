import { afterEach, describe, expect, it, vi } from 'vitest';
import { liveListOptions } from '../apps/web/src/shared/lib/live-list';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('visible list auto refresh', () => {
  it('refreshes visible lists, stops hidden requests, and pauses while editing', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    const { QueryClient, QueryObserver, focusManager } =
      await import('../apps/web/node_modules/@tanstack/react-query/build/modern/index.js');
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
    });
    client.mount();
    focusManager.setFocused(true);
    let reads = 0;
    const base = { queryKey: ['live-list-test'], queryFn: async () => ++reads };
    const observer = new QueryObserver(client, { ...base, ...liveListOptions() });
    const unsubscribe = observer.subscribe(() => {});
    try {
      await observer.refetch();
      expect(reads).toBe(1);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(reads).toBe(2);
      focusManager.setFocused(false);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(reads).toBe(2);
      focusManager.setFocused(true);
      await vi.advanceTimersByTimeAsync(0);
      expect(reads).toBe(3);
      observer.setOptions({ ...base, ...liveListOptions(false) });
      await vi.advanceTimersByTimeAsync(60_000);
      focusManager.setFocused(false);
      focusManager.setFocused(true);
      await vi.advanceTimersByTimeAsync(0);
      expect(reads).toBe(3);
      observer.setOptions({ ...base, ...liveListOptions() });
      await vi.advanceTimersByTimeAsync(30_000);
      expect(reads).toBe(4);
    } finally {
      unsubscribe();
      observer.destroy();
      client.unmount();
      client.clear();
      focusManager.setFocused(undefined);
    }
  });
});
