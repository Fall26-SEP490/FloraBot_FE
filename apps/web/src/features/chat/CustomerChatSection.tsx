import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  customerChatReturn,
  customerConversationHref,
  rememberOpenedCustomerChat,
} from './customer-chat.navigation';
import { Flower2, MessageSquare, RefreshCw, X } from '@florabot/ui';
import './chat.css';
import './styles/customer-chat.css';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/shared/lib/api';
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
  const params = useSearchParams();
  const [page, setPage] = useState(1);
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
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

  // Read opened chat metadata if passed via sessionStorage or URL search params
  const [cachedOpenedChat] = useState<CustomerSellerChatItem | null>(() => {
    if (!initialChatId || typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem('florabot_opened_chat');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.id === initialChatId) {
          return {
            id: parsed.id,
            otherPartyName: parsed.otherPartyName || 'Shop hoa',
            createdAt: parsed.createdAt || '',
            lastMessageAt: null,
            lastMessage: null,
            lastMessageHasImage: false,
            productContext: parsed.productContext || null,
            unreadCount: 0,
          };
        }
      }
    } catch {
      // ignore parsing error
    }
    const params = new URLSearchParams(window.location.search);
    const shopName = params.get('shopName');
    const productName = params.get('productName');
    if (shopName) {
      return {
        id: initialChatId,
        otherPartyName: shopName,
        createdAt: '',
        lastMessageAt: null,
        lastMessage: null,
        lastMessageHasImage: false,
        productContext: productName || null,
        unreadCount: 0,
      };
    }
    return null;
  });

  // Prepend newly opened conversation if it's not present on current page
  const chatInItems = selectedChatId ? items.find((item) => item.id === selectedChatId) : null;
  const missingChatStub: CustomerSellerChatItem | null =
    selectedChatId && !chatInItems
      ? cachedOpenedChat?.id === selectedChatId
        ? cachedOpenedChat
        : {
            id: selectedChatId,
            otherPartyName: 'Shop hoa',
            createdAt: '',
            lastMessageAt: null,
            lastMessage: null,
            lastMessageHasImage: false,
            productContext: null,
            unreadCount: 0,
          }
      : null;

  const displayedItems = missingChatStub ? [missingChatStub, ...items] : items;

  // Derive activeChat: strictly respect selectedChatId; never pick items[0] if selectedChatId is set
  const activeChat =
    chatInItems ||
    missingChatStub ||
    (!selectedChatId && typeof window !== 'undefined' && window.innerWidth >= 768
      ? items[0] || null
      : null);

  const activeChatId = activeChat?.id || selectedChatId;
  const origin =
    activeChatId === initialChatId ? customerChatReturn(params.get('chatReturn')) : null;

  // Realtime SignalR connection
  useChatRealtime({
    enabled: true,
    onMessageReceived: (event: ChatMessageReceivedEvent) => {
      if (event.chatId === activeChatId) {
        onRealtimeMessageRef.current?.(event);
      }
      void queryClient.invalidateQueries({ queryKey: ['member-chats'] });
      void queryClient.invalidateQueries({ queryKey: ['member-chats-unread-count'] });
    },
    onMessagesRead: (event: ChatMessagesReadEvent) => {
      if (event.chatId === activeChatId) {
        onRealtimeReadRef.current?.(event);
      }
      void queryClient.invalidateQueries({ queryKey: ['member-chats'] });
      void queryClient.invalidateQueries({ queryKey: ['member-chats-unread-count'] });
    },
    onReconnect: () => {
      void queryClient.invalidateQueries({ queryKey: ['member-chats'] });
      void queryClient.invalidateQueries({ queryKey: ['member-chats-unread-count'] });
    },
  });

  const handleSelectChat = (chat: CustomerSellerChatItem) => {
    setSelectedChatId(chat.id);
    setViewMode('conversation');
    if (chat.id !== activeChatId) {
      rememberOpenedCustomerChat(chat);
      window.history.replaceState(null, '', customerConversationHref(chat.id));
    }
  };

  const handleBackToList = () => {
    setViewMode('list');
    setShowDetailsPanel(false);
  };

  const handleRefreshAll = () => {
    void chatsQuery.refetch();
    void queryClient.invalidateQueries({ queryKey: ['member-chats-unread-count'] });
    if (activeChatId) {
      void queryClient.invalidateQueries({ queryKey: ['chat-messages', activeChatId] });
    }
  };

  const handleMessagesReadLocally = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['member-chats'] });
    void queryClient.invalidateQueries({ queryKey: ['member-chats-unread-count'] });
  }, []);

  if (chatsQuery.isSuccess && page === 1 && !hasMore && displayedItems.length === 0) {
    return (
      <div className="customer-inbox-empty">
        <MessageSquare size={30} aria-hidden="true" />
        <h2>Chưa có cuộc trò chuyện nào</h2>
        <p>
          Chọn một mẫu hoa bạn thích và nhắn tin với shop. Các cuộc trò chuyện sẽ được lưu tại đây.
        </p>
        <Link href="/dat-hoa" className="button button-primary">
          Khám phá hoa
        </Link>
      </div>
    );
  }

  return (
    <section className="staff-chat-section customer-chat-section" aria-label="Tin nhắn với shop">
      {origin && (
        <div className="customer-chat-origin">
          <Link href={origin.href}>{origin.label}</Link>
          {origin.kind === 'order' && <p>Xác nhận báo giá và thanh toán tại đơn đặt trước.</p>}
        </div>
      )}
      <div
        className={`chat-layout mode-${viewMode} ${showDetailsPanel && activeChat ? 'with-details' : ''}`}
      >
        <div className="chat-layout-sidebar">
          <div className="chat-sidebar-header">
            <div className="chat-sidebar-header-row">
              <h2 className="chat-sidebar-title">Shop đang trao đổi</h2>
              <button
                type="button"
                className="chat-sidebar-refresh-btn"
                disabled={chatsQuery.isFetching}
                onClick={handleRefreshAll}
                title="Làm mới danh sách tin nhắn"
                aria-label="Làm mới danh sách tin nhắn"
              >
                <RefreshCw
                  size={15}
                  aria-hidden="true"
                  className={chatsQuery.isFetching ? 'is-spinning' : ''}
                />
              </button>
            </div>
          </div>

          <ChatList
            items={displayedItems}
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
              onToggleDetails={() => setShowDetailsPanel((value) => !value)}
              showDetails={showDetailsPanel}
              detailsLabel="shop"
              customerMode
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
        {activeChat && showDetailsPanel && (
          <aside className="chat-details-panel" aria-label="Thông tin shop">
            <div className="chat-details-header">
              <h3>Thông tin shop</h3>
              <button
                type="button"
                className="chat-details-close-btn"
                aria-label="Thu gọn bảng thông tin"
                onClick={() => setShowDetailsPanel(false)}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="chat-details-scroll">
              <div className="chat-details-profile">
                <div className="chat-details-avatar" aria-hidden="true">
                  {activeChat.otherPartyName.slice(0, 1).toLocaleUpperCase('vi-VN')}
                </div>
                <h4 className="chat-details-name">{activeChat.otherPartyName}</h4>
              </div>
              {activeChat.productContext && (
                <section className="chat-details-section">
                  <h5 className="chat-details-section-title">MẪU HOA ĐANG TRAO ĐỔI</h5>
                  <div className="chat-details-product-card">
                    <span className="chat-details-product-icon">
                      <Flower2 size={18} aria-hidden="true" />
                    </span>
                    <div className="chat-details-product-info">
                      <strong>{activeChat.productContext}</strong>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </aside>
        )}
      </div>
    </section>
  );
}
