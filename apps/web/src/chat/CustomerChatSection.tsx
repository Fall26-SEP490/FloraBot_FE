import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '../api';
import { getCustomerChats } from './api';
import { useChatRealtime } from './useChatRealtime';
import { ChatList } from './ChatList';
import { ConversationView } from './ConversationView';
import type {
  ChatMessageReceivedEvent,
  ChatMessagesReadEvent,
  CustomerSellerChatItem,
} from './types';

export function CustomerChatSection({ initialChatId }: { initialChatId?: string | null }) {
  const [page, setPage] = useState(1);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(() => initialChatId || null);
  const [viewMode, setViewMode] = useState<'list' | 'conversation'>(() =>
    initialChatId ? 'conversation' : 'list',
  );

  const onRealtimeMessageRef = useRef<((msg: ChatMessageReceivedEvent) => void) | null>(null);
  const onRealtimeReadRef = useRef<((event: ChatMessagesReadEvent) => void) | null>(null);

  const chatsQuery = useQuery({
    queryKey: ['member-chats', page],
    queryFn: () => getCustomerChats(page),
  });

  const items = chatsQuery.data?.items || [];
  const hasMore = chatsQuery.data?.hasMore || false;

  // Derive activeChat from items and selectedChatId
  const activeChat =
    (selectedChatId ? items.find((item) => item.id === selectedChatId) : null) ||
    (typeof window !== 'undefined' && window.innerWidth >= 768 ? items[0] || null : null);

  const activeChatId = activeChat?.id || selectedChatId;

  // Realtime SignalR connection
  useChatRealtime({
    enabled: true,
    onMessageReceived: (event: ChatMessageReceivedEvent) => {
      if (event.chatId === activeChatId) {
        onRealtimeMessageRef.current?.(event);
      }
      void queryClient.invalidateQueries({ queryKey: ['member-chats'] });
    },
    onMessagesRead: (event: ChatMessagesReadEvent) => {
      if (event.chatId === activeChatId) {
        onRealtimeReadRef.current?.(event);
      }
      void queryClient.invalidateQueries({ queryKey: ['member-chats'] });
    },
    onReconnect: () => {
      void queryClient.invalidateQueries({ queryKey: ['member-chats'] });
    },
  });

  const handleSelectChat = (chat: CustomerSellerChatItem) => {
    setSelectedChatId(chat.id);
    setViewMode('conversation');
  };

  const handleBackToList = () => {
    setViewMode('list');
  };

  const handleMessagesReadLocally = () => {
    void queryClient.invalidateQueries({ queryKey: ['member-chats'] });
  };

  return (
    <div className={`chat-layout mode-${viewMode}`}>
      <div className="chat-layout-sidebar">
        <div className="chat-sidebar-header">
          <h2 className="chat-sidebar-title">Tin nhắn với các shop</h2>
          <p className="chat-sidebar-subtitle quiet">
            Trao đổi trực tiếp về yêu cầu cắm hoa và đơn hàng
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
          userRole="CUSTOMER"
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
            <p className="chat-empty-selection-title">Chưa chọn cuộc trò chuyện</p>
            <p className="quiet">
              Chọn một cuộc trò chuyện từ danh sách bên trái để xem lịch sử và gửi tin nhắn.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
