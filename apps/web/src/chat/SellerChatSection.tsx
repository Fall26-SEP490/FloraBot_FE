import { useCallback, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, RefreshCw } from '@florabot/ui';
import { queryClient, type Session } from '../api';
import { getSellerChats } from './api';
import { useChatRealtime } from './useChatRealtime';
import { ChatList } from './ChatList';
import { ConversationView } from './ConversationView';
import type {
  ChatMessageReceivedEvent,
  ChatMessagesReadEvent,
  CustomerSellerChatItem,
} from './types';

export function SellerChatSection({ session }: { session: Session }) {
  const sellerId = session.sellerId;

  const [page, setPage] = useState(1);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'conversation'>('list');

  const onRealtimeMessageRef = useRef<((msg: ChatMessageReceivedEvent) => void) | null>(null);
  const onRealtimeReadRef = useRef<((event: ChatMessagesReadEvent) => void) | null>(null);

  // If no valid sellerId, DO NOT call API with fake IDs
  const isValidSeller = Boolean(sellerId && sellerId !== '00000000-0000-0000-0000-000000000000');

  const chatsQuery = useQuery({
    queryKey: ['seller-chats', sellerId, page],
    queryFn: () => getSellerChats(sellerId!, page),
    enabled: isValidSeller,
  });

  const items = chatsQuery.data?.items || [];
  const hasMore = chatsQuery.data?.hasMore || false;

  // Derive activeChat from items and selectedChatId: never pick items[0] if selectedChatId is set
  const activeChat =
    (selectedChatId ? items.find((item) => item.id === selectedChatId) : null) ||
    (!selectedChatId && typeof window !== 'undefined' && window.innerWidth >= 768
      ? items[0] || null
      : null);

  const activeChatId = activeChat?.id || selectedChatId;

  // Realtime hook
  useChatRealtime({
    enabled: isValidSeller,
    onMessageReceived: (event: ChatMessageReceivedEvent) => {
      if (event.chatId === activeChatId) {
        onRealtimeMessageRef.current?.(event);
      }
      if (sellerId) {
        void queryClient.invalidateQueries({ queryKey: ['seller-chats', sellerId] });
      }
    },
    onMessagesRead: (event: ChatMessagesReadEvent) => {
      if (event.chatId === activeChatId) {
        onRealtimeReadRef.current?.(event);
      }
      if (sellerId) {
        void queryClient.invalidateQueries({ queryKey: ['seller-chats', sellerId] });
      }
    },
    onReconnect: () => {
      if (sellerId) {
        void queryClient.invalidateQueries({ queryKey: ['seller-chats', sellerId] });
      }
    },
  });

  const handleMessagesReadLocally = useCallback(() => {
    if (sellerId) {
      void queryClient.invalidateQueries({ queryKey: ['seller-chats', sellerId] });
    }
  }, [sellerId]);

  if (!isValidSeller) {
    return (
      <div className="chat-seller-safe-error" role="alert">
        <h2>Tài khoản chưa được liên kết với shop</h2>
        <p>
          Phiên làm việc của bạn chưa có mã định danh shop hoa hợp lệ. Vui lòng kiểm tra lại quyền
          truy cập hoặc đăng nhập đúng tài khoản chủ shop.
        </p>
      </div>
    );
  }

  const handleSelectChat = (chat: CustomerSellerChatItem) => {
    setSelectedChatId(chat.id);
    setViewMode('conversation');
  };

  const handleBackToList = () => {
    setViewMode('list');
  };

  const handleRefreshAll = () => {
    void chatsQuery.refetch();
    if (activeChatId) {
      void queryClient.invalidateQueries({ queryKey: ['chat-messages', activeChatId] });
    }
  };

  return (
    <section className="staff-chat-section" aria-label="Tin nhắn khách hàng">
      <div className="staff-chat-intro">
        <div>
          <h2>Trao đổi với khách hàng</h2>
          <p>Tư vấn mẫu hoa, gửi ảnh thực tế và phản hồi thắc mắc trực tiếp.</p>
        </div>
        <Button variant="outline" disabled={chatsQuery.isFetching} onClick={handleRefreshAll}>
          <RefreshCw size={16} aria-hidden="true" />
          Làm mới hội thoại
        </Button>
      </div>
      <div className={`chat-layout mode-${viewMode}`}>
        <div className="chat-layout-sidebar">
          <div className="chat-sidebar-header">
            <h2 className="chat-sidebar-title">Khách hàng nhắn tin</h2>
            <p className="chat-sidebar-subtitle quiet">
              Tư vấn sản phẩm và giải đáp thắc mắc từ khách hàng
            </p>
          </div>

          <ChatList
            items={items}
            activeChatId={activeChatId}
            onSelectChat={handleSelectChat}
            page={page}
            hasMore={hasMore}
            onPageChange={setPage}
            isLoading={chatsQuery.isPending}
            isError={chatsQuery.isError}
            error={chatsQuery.error}
            onRetry={() => void chatsQuery.refetch()}
            userRole="SELLER"
          />
        </div>

        <div className="chat-layout-main">
          {activeChat ? (
            <ConversationView
              key={activeChat.id}
              chatId={activeChat.id}
              otherPartyName={activeChat.otherPartyName}
              productContext={activeChat.productContext}
              onBack={handleBackToList}
              onMessagesReadLocally={handleMessagesReadLocally}
              registerRealtimeHandlers={(handleMessage, handleRead) => {
                onRealtimeMessageRef.current = handleMessage;
                onRealtimeReadRef.current = handleRead;
              }}
            />
          ) : (
            <div className="chat-empty-selection">
              <p className="chat-empty-selection-title">Chưa chọn khách hàng</p>
              <p className="quiet">
                Chọn một khách hàng từ danh sách bên trái để xem cuộc trò chuyện và gửi phản hồi.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
