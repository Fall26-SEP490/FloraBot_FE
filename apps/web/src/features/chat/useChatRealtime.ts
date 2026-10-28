import { useEffect, useRef } from 'react';
import {
  type HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import type { ChatMessageReceivedEvent, ChatMessagesReadEvent } from './types';

export interface UseChatRealtimeOptions {
  enabled: boolean;
  onMessageReceived: (event: ChatMessageReceivedEvent) => void;
  onMessagesRead: (event: ChatMessagesReadEvent) => void;
  onReconnect?: () => void;
}

export function useChatRealtime({
  enabled,
  onMessageReceived,
  onMessagesRead,
  onReconnect,
}: UseChatRealtimeOptions): { isConnected: () => boolean } {
  const onMessageReceivedRef = useRef(onMessageReceived);
  const onMessagesReadRef = useRef(onMessagesRead);
  const onReconnectRef = useRef(onReconnect);

  useEffect(() => {
    onMessageReceivedRef.current = onMessageReceived;
    onMessagesReadRef.current = onMessagesRead;
    onReconnectRef.current = onReconnect;
  });

  const connectionRef = useRef<HubConnection | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let disposed = false;
    const connection = new HubConnectionBuilder()
      .withUrl('/hub/chat', { withCredentials: true })
      .withAutomaticReconnect([0, 2_000, 5_000, 10_000, 30_000])
      .configureLogging(LogLevel.None)
      .build();

    connectionRef.current = connection;

    // 1. Register event handlers BEFORE starting connection
    connection.on('ChatMessageReceived', (data: ChatMessageReceivedEvent) => {
      if (!disposed && onMessageReceivedRef.current) {
        onMessageReceivedRef.current(data);
      }
    });

    connection.on('ChatMessagesRead', (data: ChatMessagesReadEvent) => {
      if (!disposed && onMessagesReadRef.current) {
        onMessagesReadRef.current(data);
      }
    });

    connection.onreconnected(() => {
      if (!disposed && onReconnectRef.current) {
        onReconnectRef.current();
      }
    });

    let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = 1000;
    const maxRetryDelay = 30000;

    const connect = async () => {
      if (disposed || connection.state !== HubConnectionState.Disconnected) return;
      try {
        await connection.start();
        if (disposed) {
          await connection.stop();
        } else {
          retryDelay = 1000;
          onReconnectRef.current?.();
        }
      } catch {
        if (!disposed) {
          const nextDelay = retryDelay;
          retryDelay = Math.min(retryDelay * 1.5, maxRetryDelay);
          retryTimeoutId = setTimeout(() => {
            void connect();
          }, nextDelay);
        }
      }
    };

    const synchronize = async () => {
      if (disposed || document.visibilityState === 'hidden' || !navigator.onLine) return;
      if ((connection.state as HubConnectionState) === HubConnectionState.Connected) {
        onReconnectRef.current?.();
      } else {
        await connect();
      }
    };

    const handleOnline = () => {
      void synchronize();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void synchronize();
      }
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    void connect();

    return () => {
      disposed = true;
      if (retryTimeoutId) clearTimeout(retryTimeoutId);
      connectionRef.current = null;
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      connection.off('ChatMessageReceived');
      connection.off('ChatMessagesRead');
      void connection.stop().catch(() => undefined);
    };
  }, [enabled]);

  return {
    isConnected: () => connectionRef.current?.state === HubConnectionState.Connected,
  };
}
