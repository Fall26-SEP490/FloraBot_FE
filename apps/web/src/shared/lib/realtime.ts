import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { queryClient } from './api';

export function startPortalUpdates(): () => void {
  const connection = new HubConnectionBuilder()
    .withUrl('/hub/portal', { withCredentials: true })
    .withAutomaticReconnect([0, 2_000, 10_000, 30_000])
    .configureLogging(LogLevel.None)
    .build();
  let disposed = false;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  const refresh = () => {
    if (disposed || refreshTimer) return;
    // Coalesce bursts; refresh query data without resetting in-progress forms or focus.
    refreshTimer = setTimeout(() => {
      refreshTimer = undefined;
      if (!disposed) void queryClient.invalidateQueries();
    }, 150);
  };
  const connect = async () => {
    if (disposed || connection.state !== HubConnectionState.Disconnected) return;
    try {
      await connection.start();
      if (disposed) await connection.stop();
      else refresh();
    } catch {
      // The periodic API refresh remains available when realtime cannot connect.
    }
  };
  connection.on('Refresh', refresh);
  connection.onreconnected(refresh);
  const synchronize = async () => {
    if (disposed || document.visibilityState === 'hidden' || !navigator.onLine) return;
    // API requests renew expired cookies before the next connection attempt.
    await queryClient.invalidateQueries();
    await connect();
  };
  const resume = () => {
    void synchronize();
  };
  // Realtime events drive updates while connected; polling is a fallback only.
  const poll = setInterval(() => {
    if (connection.state !== HubConnectionState.Connected) resume();
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
