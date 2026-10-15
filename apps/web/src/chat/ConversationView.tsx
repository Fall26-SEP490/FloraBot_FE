import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Button, RefreshCw } from '@florabot/ui';
import { formatChatError, getChatMessages, markChatAsRead } from './api';
import type {
  ChatMessageReceivedEvent,
  ChatMessagesReadEvent,
  CustomerSellerChatMessage,
} from './types';
import { MessageItem } from './MessageItem';
import { MessageComposer } from './MessageComposer';

export function ConversationView({
  chatId,
  otherPartyName,
  productContext,
  onBack,
  onMessagesReadLocally,
  registerRealtimeHandlers,
}: {
  chatId: string;
  otherPartyName: string;
  productContext?: string | null;
  onBack?: () => void;
  onMessagesReadLocally?: () => void;
  registerRealtimeHandlers?: (
    onMessage: (msg: ChatMessageReceivedEvent) => void,
    onRead: (event: ChatMessagesReadEvent) => void,
  ) => void;
}) {
  const initialQuery = useQuery({
    queryKey: ['chat-messages', chatId],
    queryFn: () => getChatMessages(chatId, 1),
  });

  const [olderPages, setOlderPages] = useState<CustomerSellerChatMessage[][]>([]);
  const [olderPageNumber, setOlderPageNumber] = useState(1);
  const [hasMoreFromPagination, setHasMoreFromPagination] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [realtimeMessages, setRealtimeMessages] = useState<CustomerSellerChatMessage[]>([]);
  const [readReceipts, setReadReceipts] = useState<Record<string, string>>({});

  const hasMoreOlder =
    olderPageNumber > 1 ? hasMoreFromPagination : Boolean(initialQuery.data?.hasMore);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const prevScrollHeightRef = useRef(0);
  const prevScrollTopRef = useRef(0);
  const shouldRestoreScrollRef = useRef(false);

  // Trigger mark read after messages arrive
  useEffect(() => {
    if (initialQuery.data) {
      void markChatAsRead(chatId)
        .then(() => onMessagesReadLocally?.())
        .catch(() => undefined);
    }
  }, [chatId, initialQuery.data, onMessagesReadLocally]);

  // Auto-scroll helper
  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });
  }, []);

  // Track if user is scrolled near bottom
  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceToBottom < 120;
  };

  // Combine and deduplicate all messages
  const baseMessages = useMemo(() => initialQuery.data?.items || [], [initialQuery.data]);

  const allMessages = useMemo(() => {
    const map = new Map<string, CustomerSellerChatMessage>();

    for (const pageItems of olderPages) {
      for (const m of pageItems) map.set(m.id, m);
    }
    for (const m of baseMessages) {
      map.set(m.id, m);
    }
    for (const m of realtimeMessages) {
      map.set(m.id, m);
    }

    const list = Array.from(map.values()).map((msg) => {
      if (readReceipts[msg.id]) {
        return { ...msg, readAt: readReceipts[msg.id] };
      }
      return msg;
    });

    list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return list;
  }, [olderPages, baseMessages, realtimeMessages, readReceipts]);

  // Initial scroll to bottom once messages load
  const hasLoadedInitial = Boolean(initialQuery.data && !initialQuery.isPending);
  useLayoutEffect(() => {
    if (hasLoadedInitial && allMessages.length > 0) {
      scrollToBottom(false);
    }
  }, [hasLoadedInitial, allMessages.length, scrollToBottom]);

  // Restore scroll position after prepending older messages
  useLayoutEffect(() => {
    if (shouldRestoreScrollRef.current && scrollContainerRef.current) {
      const el = scrollContainerRef.current;
      const heightDiff = el.scrollHeight - prevScrollHeightRef.current;
      el.scrollTop = prevScrollTopRef.current + heightDiff;
      shouldRestoreScrollRef.current = false;
    }
  }, [olderPages]);

  // Register realtime handlers
  useEffect(() => {
    if (!registerRealtimeHandlers) return;

    const handleMessage = (event: ChatMessageReceivedEvent) => {
      setRealtimeMessages((prev) => {
        if (prev.some((m) => m.id === event.id)) return prev;
        const newMsg: CustomerSellerChatMessage = {
          id: event.id,
          senderName: event.senderName,
          isMine: false,
          content: event.content,
          createdAt: event.createdAt,
          imageUrl: event.imageUrl,
          readAt: null,
        };
        return [...prev, newMsg];
      });

      // Mark as read immediately when viewed in active chat
      void markChatAsRead(chatId)
        .then(() => onMessagesReadLocally?.())
        .catch(() => undefined);

      if (isNearBottomRef.current) {
        setTimeout(() => scrollToBottom(true), 50);
      }
    };

    const handleRead = (event: ChatMessagesReadEvent) => {
      const readTime = new Date(event.readThroughCreatedAt).getTime();
      setReadReceipts((prev) => {
        const next = { ...prev };
        for (const msg of allMessages) {
          if (msg.isMine && !msg.readAt) {
            const msgTime = new Date(msg.createdAt).getTime();
            if (msgTime <= readTime || msg.id === event.readThroughMessageId) {
              next[msg.id] = event.readAt;
            }
          }
        }
        return next;
      });
    };

    registerRealtimeHandlers(handleMessage, handleRead);
  }, [chatId, registerRealtimeHandlers, allMessages, onMessagesReadLocally, scrollToBottom]);

  // Load older messages (page + 1)
  const handleLoadOlder = async () => {
    if (isLoadingOlder || !hasMoreOlder) return;
    setIsLoadingOlder(true);

    const el = scrollContainerRef.current;
    if (el) {
      prevScrollHeightRef.current = el.scrollHeight;
      prevScrollTopRef.current = el.scrollTop;
      shouldRestoreScrollRef.current = true;
    }

    try {
      const nextPage = olderPageNumber + 1;
      const data = await getChatMessages(chatId, nextPage);
      setOlderPageNumber(nextPage);
      setHasMoreFromPagination(data.hasMore);
      setOlderPages((prev) => [data.items, ...prev]);
    } catch {
      shouldRestoreScrollRef.current = false;
    } finally {
      setIsLoadingOlder(false);
    }
  };

  const handleMessageSent = (sent: CustomerSellerChatMessage) => {
    setRealtimeMessages((prev) => [...prev, sent]);
    setTimeout(() => scrollToBottom(true), 50);
  };

  return (
    <section className="chat-conversation" aria-label={`Cuộc trò chuyện với ${otherPartyName}`}>
      <header className="chat-conversation-header">
        {onBack && (
          <button
            type="button"
            className="chat-back-button"
            onClick={onBack}
            aria-label="Quay lại danh sách cuộc trò chuyện"
          >
            <ArrowLeft size={20} aria-hidden="true" />
            <span>Quay lại</span>
          </button>
        )}

        <div className="chat-conversation-title-area">
          <h2 className="chat-conversation-name">{otherPartyName}</h2>
          {productContext && (
            <p className="chat-conversation-context" title={productContext}>
              <strong>Mẫu hoa quan tâm:</strong> {productContext}
            </p>
          )}
        </div>
      </header>

      <div
        ref={scrollContainerRef}
        className="chat-messages-scroll-area"
        onScroll={handleScroll}
        aria-label="Lịch sử tin nhắn"
      >
        {initialQuery.isPending ? (
          <div className="chat-conversation-loading" role="status">
            <p>Đang tải lịch sử tin nhắn…</p>
          </div>
        ) : initialQuery.isError ? (
          <div className="chat-conversation-error" role="alert">
            <p>{formatChatError(initialQuery.error)}</p>
            <Button variant="outline" type="button" onClick={() => void initialQuery.refetch()}>
              <RefreshCw size={14} aria-hidden="true" />
              Tải lại tin nhắn
            </Button>
          </div>
        ) : (
          <>
            {hasMoreOlder && (
              <div className="chat-load-older-container">
                <Button
                  type="button"
                  variant="outline"
                  className="chat-load-older-btn"
                  onClick={() => void handleLoadOlder()}
                  disabled={isLoadingOlder}
                >
                  {isLoadingOlder ? 'Đang tải tin nhắn cũ…' : 'Tải thêm tin nhắn cũ hơn'}
                </Button>
              </div>
            )}

            {allMessages.length === 0 ? (
              <div className="chat-conversation-empty">
                <p>Chưa có tin nhắn nào trong cuộc trò chuyện này.</p>
                <p className="quiet">Gửi tin nhắn hoặc ảnh để bắt đầu trao đổi ngay.</p>
              </div>
            ) : (
              <ul className="chat-messages-list">
                {allMessages.map((message) => (
                  <MessageItem key={message.id} message={message} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <footer className="chat-conversation-footer">
        <MessageComposer
          chatId={chatId}
          onMessageSent={handleMessageSent}
          disabled={initialQuery.isPending}
        />
      </footer>
    </section>
  );
}
