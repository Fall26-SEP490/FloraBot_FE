import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import './chat.css';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import IconActionButton from '@/shared/components/IconActionButton';
import RefreshRegion from '@/shared/components/RefreshRegion';
import './styles/seller-messaging.css';
import { queryClient, type Session } from '@/shared/lib/api';
import { getSellerChats } from './api';
import { useChatRealtime } from './useChatRealtime';
import { ChatList } from './ChatList';
import { ConversationView } from './ConversationView';
import { ChatCustomerDetails } from './ChatCustomerDetails';
import type {
  ChatMessageReceivedEvent,
  ChatMessagesReadEvent,
  CustomerSellerChatItem,
} from './types';

function subscribeViewport(callback: () => void) {
  const media = window.matchMedia('(min-width: 769px)');
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}
const desktopSnapshot = () => window.matchMedia('(min-width: 769px)').matches;
const serverSnapshot = () => false;
function subscribeInfoLayout(callback: () => void) {
  const media = window.matchMedia('(max-width: 1400px)');
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}
const compactInfoSnapshot = () => window.matchMedia('(max-width: 1400px)').matches;

export function SellerChatSection({ session }: { session: Session }) {
  const requestedChat = useSearchParams().get('chat');
  return (
    <SellerChatContent
      key={`${session.id}:${requestedChat ?? ''}`}
      session={session}
      requestedChat={requestedChat}
    />
  );
}

function SellerChatContent({
  session,
  requestedChat,
}: {
  session: Session;
  requestedChat: string | null;
}) {
  const sellerId = session.sellerId;
  const openedChat = useQuery({
    queryKey: ['seller-opened-chat', sellerId, requestedChat],
    enabled: Boolean(sellerId && requestedChat),
    queryFn: async () => {
      for (let number = 1; number <= 100000; number++) {
        const result = await getSellerChats(sellerId!, number);
        const match = result.items.find((chat) => chat.id === requestedChat);
        if (match) return match;
        if (!result.hasMore || !result.items.length) break;
      }
      throw new Error('Không tìm thấy hội thoại của đơn.');
    },
  });

  const [page, setPage] = useState(1);
  const [selectedChat, setSelectedChat] = useState<CustomerSellerChatItem | null>(null);
  const desktop = useSyncExternalStore(subscribeViewport, desktopSnapshot, serverSnapshot);
  const infoReplacesConversation = useSyncExternalStore(
    subscribeInfoLayout,
    compactInfoSnapshot,
    serverSnapshot,
  );
  const [viewMode, setViewMode] = useState<'list' | 'conversation'>(
    requestedChat ? 'conversation' : 'list',
  );
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);

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

  const activeChat = selectedChat
    ? (items.find((item) => item.id === selectedChat.id) ?? selectedChat)
    : requestedChat
      ? (openedChat.data ?? null)
      : desktop
        ? (items[0] ?? null)
        : null;
  const activeChatId = activeChat?.id ?? null;
  const conversationVisible =
    (desktop || viewMode === 'conversation') && (!showDetailsPanel || !infoReplacesConversation);

  // Realtime hook
  useChatRealtime({
    enabled: isValidSeller,
    onMessageReceived: (event: ChatMessageReceivedEvent) => {
      if (event.chatId === activeChatId && conversationVisible) {
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
    setSelectedChat(chat);
    setShowDetailsPanel(false);
    setViewMode('conversation');
  };

  const handleBackToList = () => {
    setViewMode('list');
    setShowDetailsPanel(false);
  };

  const handleRefreshAll = async () => {
    await Promise.all([
      chatsQuery.refetch(),
      activeChatId && queryClient.invalidateQueries({ queryKey: ['chat-messages', activeChatId] }),
    ]);
  };

  return (
    <section className="staff-chat-section seller-messaging" aria-label="Tin nhắn khách hàng">
      <RefreshRegion>
        <div
          className={`chat-layout mode-${viewMode} ${
            showDetailsPanel && activeChat ? 'with-details' : ''
          }`}
        >
          <div className="chat-layout-sidebar">
            <ChatList
              toolbarAction={
                <IconActionButton
                  action="reload"
                  label="Làm mới danh sách tin nhắn"
                  disabled={chatsQuery.isFetching}
                  onClick={handleRefreshAll}
                />
              }
              items={items}
              activeChatId={activeChatId}
              onSelectChat={handleSelectChat}
              page={page}
              hasMore={hasMore}
              onPageChange={(nextPage) => {
                if (activeChat) setSelectedChat(activeChat);
                setPage(nextPage);
              }}
              isLoading={chatsQuery.isPending}
              isError={chatsQuery.isError}
              error={chatsQuery.error}
              onRetry={() => void chatsQuery.refetch()}
              userRole="SELLER"
            />
          </div>

          <div
            className="chat-layout-main"
            onFocusCapture={() => {
              if (!selectedChat && activeChat) setSelectedChat(activeChat);
            }}
          >
            {requestedChat && !activeChat && openedChat.isError ? (
              <p role="alert">
                Không mở được hội thoại.{' '}
                <button type="button" onClick={() => void openedChat.refetch()}>
                  Thử lại
                </button>
              </p>
            ) : requestedChat && !activeChat && openedChat.isPending ? (
              <p role="status">Đang mở hội thoại…</p>
            ) : activeChat ? (
              <ConversationView
                key={`${session.id}:${activeChat.id}`}
                isActive={conversationVisible}
                chatId={activeChat.id}
                otherPartyName={activeChat.otherPartyName}
                productContext={activeChat.productContext}
                onBack={handleBackToList}
                onMessagesReadLocally={handleMessagesReadLocally}
                registerRealtimeHandlers={(handleMessage, handleRead) => {
                  onRealtimeMessageRef.current = handleMessage;
                  onRealtimeReadRef.current = handleRead;
                }}
                onToggleDetails={() => setShowDetailsPanel((prev) => !prev)}
                showDetails={showDetailsPanel}
              />
            ) : (
              <div className="chat-empty-selection">
                <p className="chat-empty-selection-title">Chưa chọn khách hàng</p>
              </div>
            )}
          </div>

          {activeChat && showDetailsPanel && (
            <ChatCustomerDetails
              key={activeChat.id}
              chat={activeChat}
              onClose={() => {
                setShowDetailsPanel(false);
                requestAnimationFrame(() =>
                  document.querySelector<HTMLButtonElement>('.chat-details-toggle-btn')?.focus(),
                );
              }}
            />
          )}
        </div>
      </RefreshRegion>
    </section>
  );
}
