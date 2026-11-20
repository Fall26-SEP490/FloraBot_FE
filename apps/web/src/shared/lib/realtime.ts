import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { queryClient } from './api';
import { portalRefreshCandidate } from './portal-refresh-policy';

export function startPortalUpdates(): () => void {
  const connection = new HubConnectionBuilder()
    .withUrl('/hub/portal', { withCredentials: true })
    .withAutomaticReconnect([0, 2_000, 10_000, 30_000])
    .configureLogging(LogLevel.None)
    .build();
  let disposed = false;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  const pending = new Set<string>();
  const flush = () => {
    refreshTimer = undefined;
    if (disposed) return;
    const cached = new Set(
      queryClient
        .getQueryCache()
        .getAll()
        .map((query) => query.queryHash),
    );
    for (const hash of pending) if (!cached.has(hash)) pending.delete(hash);
    const hidden = document.visibilityState === 'hidden';
    const ready = new Set(
      queryClient
        .getQueryCache()
        .getAll()
        .filter(
          (query) => pending.has(query.queryHash) && (hidden || query.state.fetchStatus === 'idle'),
        )
        .map((query) => query.queryHash),
    );
    for (const hash of ready) pending.delete(hash);
    void queryClient.invalidateQueries(
      {
        predicate: (query) => ready.has(query.queryHash) && portalRefreshCandidate(query),
        refetchType: hidden ? 'none' : 'active',
      },
      { cancelRefetch: false },
    );
    if (pending.size) refreshTimer = setTimeout(flush, 500);
  };
  const refresh = () => {
    if (disposed) return;
    for (const query of queryClient.getQueryCache().getAll()) {
      if (portalRefreshCandidate(query)) pending.add(query.queryHash);
    }
    if (refreshTimer) return;
    // Coalesce bursts; refresh query data without resetting in-progress forms or focus.
    refreshTimer = setTimeout(flush, 500);
  };
  let connectedBefore = false;
  const connect = async () => {
    if (disposed || connection.state !== HubConnectionState.Disconnected) return;
    try {
      await connection.start();
      if (disposed) await connection.stop();
      else {
        if (connectedBefore) refresh();
        connectedBefore = true;
      }
    } catch {
      // The periodic API refresh remains available when realtime cannot connect.
    }
  };
  connection.on('Refresh', refresh);
  connection.onreconnected(refresh);
  const synchronize = async () => {
    if (disposed || document.visibilityState === 'hidden' || !navigator.onLine) return;
    await queryClient.refetchQueries(
      {
        type: 'active',
        stale: true,
        predicate: (query) => portalRefreshCandidate(query, true),
      },
      { cancelRefetch: false },
    );
    await connect();
  };
  const resume = () => {
    // React Query already refreshes stale reads on focus/network recovery.
    if (document.visibilityState !== 'hidden' && navigator.onLine) void connect();
  };
  // Realtime events drive updates while connected; polling is a fallback only.
  const poll = setInterval(() => {
    if (connection.state !== HubConnectionState.Connected) void synchronize();
  }, 30_000);
  window.addEventListener('online', resume);
  document.addEventListener('visibilitychange', resume);
  void connect();
  return () => {
    disposed = true;
    clearInterval(poll);
    clearTimeout(refreshTimer);
    window.removeEventListener('online', resume);
    document.removeEventListener('visibilitychange', resume);
    connection.off('Refresh', refresh);
    void connection.stop().catch(() => undefined);
  };
}
