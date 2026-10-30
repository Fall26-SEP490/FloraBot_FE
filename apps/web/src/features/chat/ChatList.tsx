import { useState } from 'react';
import { Button, ImageIcon, RefreshCw, Search, X } from '@florabot/ui';
import type { CustomerSellerChatItem } from './types';
import { formatChatError } from './api';

export function ChatList({
  items,
  activeChatId,
  onSelectChat,
  page,
  hasMore,
  onPageChange,
  isLoading,
  isError,
  error,
  onRetry,
  userRole,
  internal = false,
}: {
  items: CustomerSellerChatItem[];
  activeChatId: string | null;
  onSelectChat: (chat: CustomerSellerChatItem) => void;
  page: number;
  hasMore: boolean;
  onPageChange: (newPage: number) => void;
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  onRetry: () => void;
  userRole: 'CUSTOMER' | 'SELLER';
  internal?: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'unread'>('all');

  const formatTime = (isoString?: string | null) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  };

  const totalUnreadCount = items.reduce(
    (acc, cur) => acc + (Number(cur.unreadCount) > 0 ? 1 : 0),
    0,
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    if (filterTab === 'unread' && Number(item.unreadCount) <= 0) {
      return false;
    }
    if (!normalizedQuery) return true;
    const matchName = item.otherPartyName.toLowerCase().includes(normalizedQuery);
    const matchContext = item.productContext?.toLowerCase().includes(normalizedQuery);
    const matchMsg = item.lastMessage?.toLowerCase().includes(normalizedQuery);
    return matchName || matchContext || matchMsg;
  });

  if (isLoading) {
    return (
      <div className="chat-list-loading" role="status">
        <p>Đang tải danh sách cuộc trò chuyện…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="chat-list-error" role="alert">
        <p>{formatChatError(error)}</p>
        <Button variant="outline" type="button" onClick={onRetry}>
          <RefreshCw size={14} aria-hidden="true" />
          Tải lại danh sách
        </Button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="chat-list-empty">
        <h3>Chưa có cuộc trò chuyện nào</h3>
        <p>
          {internal
            ? 'Mở cuộc trò chuyện để trao đổi công việc trong shop. Tin nhắn sẽ được lưu tại đây.'
            : userRole === 'CUSTOMER'
              ? 'Khi bạn nhắn tin với shop hoa từ các mẫu hoa đang xem, cuộc trò chuyện sẽ hiển thị tại đây.'
              : 'Hiện tại chưa có khách hàng nào gửi tin nhắn tới shop của bạn.'}
        </p>
      </div>
    );
  }

  return (
    <div className="chat-list-container">
      <div className="chat-list-toolbar">
        <div className="chat-list-search-wrapper">
          <Search size={15} className="chat-list-search-icon" aria-hidden="true" />
          <input
            type="search"
            className="chat-list-search-input"
            placeholder="Tìm theo tên khách, mẫu hoa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Tìm kiếm cuộc trò chuyện"
          />
          {searchQuery && (
            <button
              type="button"
              className="chat-list-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Xóa từ khóa tìm kiếm"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="chat-list-tabs" role="tablist" aria-label="Bộ lọc tin nhắn">
          <button
            type="button"
            role="tab"
            aria-selected={filterTab === 'all'}
            className={`chat-list-tab ${filterTab === 'all' ? 'is-active' : ''}`}
            onClick={() => setFilterTab('all')}
          >
            <span>Tất cả</span>
            <span className="chat-list-tab-count">{items.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filterTab === 'unread'}
            className={`chat-list-tab ${filterTab === 'unread' ? 'is-active' : ''}`}
            onClick={() => setFilterTab('unread')}
          >
            <span>Chưa đọc</span>
            {totalUnreadCount > 0 ? (
              <span className="chat-list-tab-badge">{totalUnreadCount}</span>
            ) : (
              <span className="chat-list-tab-count">0</span>
            )}
          </button>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="chat-list-empty-search">
          <p className="chat-list-empty-title">Không tìm thấy cuộc trò chuyện nào</p>
          <p className="quiet">
            {filterTab === 'unread'
              ? 'Bạn đã đọc hết tất cả các tin nhắn mới.'
              : 'Thử tìm với tên khách hoặc từ khóa khác.'}
          </p>
        </div>
      ) : (
        <ul className="chat-list" aria-label="Danh sách cuộc trò chuyện">
          {filteredItems.map((item) => {
            const isActive = item.id === activeChatId;
            const unread = Number(item.unreadCount) || 0;
            const displayTime = formatTime(item.lastMessageAt || item.createdAt);

            return (
              <li key={item.id} className="chat-list-row">
                <button
                  type="button"
                  className={`chat-list-item ${isActive ? 'is-active' : ''}`}
                  onClick={() => onSelectChat(item)}
                  aria-current={isActive ? 'true' : undefined}
                  aria-label={`Cuộc trò chuyện với ${item.otherPartyName}${
                    unread > 0 ? `, ${unread} tin chưa đọc` : ''
                  }`}
                >
                  <div className="chat-list-item-avatar" aria-hidden="true">
                    {item.otherPartyName.slice(0, 1).toLocaleUpperCase('vi-VN')}
                  </div>

                  <div className="chat-list-item-content">
                    <div className="chat-list-item-top">
                      <span className="chat-list-item-name">{item.otherPartyName}</span>
                      <span className="chat-list-item-time">{displayTime}</span>
                    </div>

                    {item.productContext && (
                      <span className="chat-list-item-context" title={item.productContext}>
                        Hoa: {item.productContext}
                      </span>
                    )}

                    <div className="chat-list-item-bottom">
                      <span className="chat-list-item-preview">
                        {item.lastMessageHasImage && (
                          <span className="chat-list-item-has-image">
                            <ImageIcon size={14} aria-hidden="true" />
                            <span>[Hình ảnh]</span>
                          </span>
                        )}
                        {item.lastMessage ? (
                          <span>{item.lastMessage}</span>
                        ) : !item.lastMessageHasImage ? (
                          <span className="chat-list-item-empty-preview">Chưa có tin nhắn nào</span>
                        ) : null}
                      </span>

                      {unread > 0 && (
                        <span
                          className="chat-unread-badge"
                          aria-label={`${unread} tin nhắn chưa đọc`}
                        >
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {(page > 1 || hasMore) && (
        <nav className="chat-list-pagination" aria-label="Phân trang cuộc trò chuyện">
          <Button
            type="button"
            variant="outline"
            className="chat-list-page-btn"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Trang trước
          </Button>
          <span className="chat-list-page-info">Trang {page}</span>
          <Button
            type="button"
            variant="outline"
            className="chat-list-page-btn"
            disabled={!hasMore}
            onClick={() => onPageChange(page + 1)}
          >
            Trang sau
          </Button>
        </nav>
      )}
    </div>
  );
}
