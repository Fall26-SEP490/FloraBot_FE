'use client';

import IconActionButton from '@/shared/components/IconActionButton';
import RefreshRegion from '@/shared/components/RefreshRegion';
import './styles/seller-messaging.css';
import './chat.css';
import Link from 'next/link';

import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, MessageSquare, Search } from '@florabot/ui';
import { queryClient, request, type Session } from '@/shared/lib/api';
import type { AccountDirectoryItem } from '@/features/account-management/account-management.types';
import type { ChatMessageReceivedEvent, ChatMessagesReadEvent, SellerStaffChatItem } from './types';
import { formatChatError } from './api';
import {
  getStaffChats,
  openStaffChatForSeller,
  openStaffChatForStaff,
  staffChatTransport,
} from './staffChatApi';
import { useChatRealtime } from './useChatRealtime';
import { ChatList } from './ChatList';
import { ConversationView } from './ConversationView';

function subscribeViewport(callback: () => void) {
  const media = window.matchMedia('(min-width: 769px)');
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}
const desktopSnapshot = () => window.matchMedia('(min-width: 769px)').matches;
const serverSnapshot = () => false;

export const staffChatScope = (session: Session) =>
  `${session.role}:${session.id}:${session.sellerId ?? ''}`;

export function StaffChatSection({ session }: { session: Session }) {
  const params = useSearchParams();
  const seller = session.role === 'SELLER';
  const authorized =
    (seller || session.role === 'SELLER_STAFF') &&
    !!session.sellerId &&
    session.sellerId !== '00000000-0000-0000-0000-000000000000';
  const scope = staffChatScope(session);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<SellerStaffChatItem | null>(null);
  const [directorySearch, setDirectorySearch] = useState('');
  const [mode, setMode] = useState<'list' | 'conversation'>('list');
  const desktop = useSyncExternalStore(subscribeViewport, desktopSnapshot, serverSnapshot);
  const messageHandler = useRef<((event: ChatMessageReceivedEvent) => void) | null>(null);
  const readHandler = useRef<((event: ChatMessagesReadEvent) => void) | null>(null);
  const chats = useQuery({
    queryKey: ['staff-chats', scope, page],
    queryFn: () => getStaffChats(page),
    enabled: authorized,
    refetchInterval: 30_000,
  });
  const directory = useQuery({
    queryKey: [
      'account-directory',
      'SELLER_STAFF',
      session.sellerId,
      `/sellers/${session.sellerId}/staff/accounts`,
    ],
    queryFn: () =>
      request<AccountDirectoryItem[]>(
        `/sellers/${encodeURIComponent(session.sellerId!)}/staff/accounts`,
      ),
    enabled: authorized && seller,
  });
  const activeStaff = (directory.data ?? []).filter((item) => item.status === 'ACTIVE');
  const matchingStaff = activeStaff.filter((person) =>
    `${person.fullName} ${person.email}`
      .toLocaleLowerCase('vi-VN')
      .includes(directorySearch.trim().toLocaleLowerCase('vi-VN')),
  );
  const items = chats.data?.items ?? [];
  const active = selected ? (items.find((item) => item.id === selected.id) ?? selected) : null;
  const visible = desktop || mode === 'conversation';
  const invalidateList = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['staff-chats', scope] });
  }, [scope]);
  const refreshMessages = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['staff-chats', scope] }),
      queryClient.invalidateQueries({ queryKey: ['staff-chat-messages', scope] }),
      ...(seller
        ? [
            queryClient.invalidateQueries({
              queryKey: ['account-directory', 'SELLER_STAFF', session.sellerId],
            }),
          ]
        : []),
    ]);
  }, [scope, seller, session.sellerId]);
  const opening = useMutation({
    mutationFn: (personId?: string) =>
      seller ? openStaffChatForSeller(session.sellerId!, personId!) : openStaffChatForStaff(),
    onSuccess: (chat) => {
      setSelected(chat);
      setMode('conversation');
      invalidateList();
    },
  });
  useChatRealtime({
    enabled: authorized,
    onMessageReceived: (event) => {
      if (event.chatId === active?.id && visible) messageHandler.current?.(event);
      invalidateList();
    },
    onMessagesRead: (event) => {
      if (event.chatId === active?.id) readHandler.current?.(event);
      invalidateList();
    },
    onReconnect: refreshMessages,
  });
  if (!authorized)
    return (
      <p role="alert">Tài khoản chưa được liên kết với shop hoặc không có quyền chat nội bộ.</p>
    );

  return (
    <section className="staff-chat-section seller-messaging" aria-labelledby="staff-chat-title">
      <RefreshRegion>
        <h2 id="staff-chat-title" className="sr-only">
          {seller ? 'Trao đổi với đội ngũ của shop' : 'Trao đổi với chủ shop'}
        </h2>
        <div className={`chat-layout staff-chat-layout mode-${mode}`}>
          <div className="chat-layout-sidebar">
            {!seller && chats.isSuccess && items.length === 0 && (
              <div className="chat-sidebar-header">
                <Button
                  className="staff-chat-open-shop"
                  disabled={opening.isPending}
                  onClick={() => opening.mutate()}
                >
                  <MessageSquare size={16} aria-hidden="true" />
                  {opening.isPending ? 'Đang mở…' : 'Nhắn với chủ shop'}
                </Button>
                {opening.isError && <p role="alert">{formatChatError(opening.error)}</p>}
              </div>
            )}
            {seller ? (
              <div className="chat-list-container">
                <div className="chat-list-toolbar">
                  <div className="chat-list-search-row">
                    <div className="chat-list-search-wrapper">
                      <Search size={15} className="chat-list-search-icon" aria-hidden="true" />
                      <input
                        type="search"
                        className="chat-list-search-input"
                        aria-label="Tìm nhân viên"
                        placeholder="Tìm nhân viên…"
                        value={directorySearch}
                        onChange={(event) => setDirectorySearch(event.target.value)}
                      />
                    </div>
                    <IconActionButton
                      action="reload"
                      label="Làm mới hội thoại"
                      disabled={directory.isFetching || chats.isFetching}
                      onClick={refreshMessages}
                    />
                  </div>
                </div>
                {opening.isError && (
                  <p className="chat-list-error" role="alert">
                    {formatChatError(opening.error)}
                  </p>
                )}
                {directory.isPending && (
                  <p className="chat-list-empty" role="status">
                    Đang tải nhân viên…
                  </p>
                )}
                {directory.isError && (
                  <div className="chat-list-error" role="alert">
                    <p>{formatChatError(directory.error)}</p>
                    <IconActionButton
                      action="reload"
                      label="Tải lại nhân viên"
                      onClick={() => void directory.refetch()}
                    />
                  </div>
                )}
                {directory.isSuccess && matchingStaff.length === 0 && (
                  <div className="chat-list-empty">
                    <p>
                      {activeStaff.length
                        ? 'Không tìm thấy nhân viên.'
                        : 'Chưa có nhân viên đang hoạt động.'}
                    </p>
                    {!activeStaff.length && <Link href="/seller/staff">Quản lý nhân viên</Link>}
                  </div>
                )}
                <ul className="chat-list" aria-label="Danh sách nhân viên">
                  {matchingStaff.map((person) => (
                    <li key={person.id} className="chat-list-row">
                      <button
                        type="button"
                        className="chat-list-item"
                        aria-label={`Nhắn tin ${person.fullName}`}
                        aria-current={
                          opening.variables === person.id ||
                          (!selected && params.get('staff') === person.id)
                            ? 'true'
                            : undefined
                        }
                        disabled={opening.isPending}
                        onClick={() => opening.mutate(person.id)}
                      >
                        <span className="chat-list-item-avatar" aria-hidden="true">
                          {person.fullName.slice(0, 1).toLocaleUpperCase('vi-VN')}
                        </span>
                        <span className="chat-list-item-content">
                          <span className="chat-list-item-name">{person.fullName}</span>
                          <span className="chat-list-item-preview">
                            {opening.isPending && opening.variables === person.id
                              ? 'Đang mở…'
                              : person.email}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <ChatList
                internal
                items={items.map((item) => ({ ...item, productContext: null }))}
                activeChatId={active?.id ?? null}
                onSelectChat={(item) => {
                  const chat = items.find((entry) => entry.id === item.id);
                  if (chat) {
                    setSelected(chat);
                    setMode('conversation');
                  }
                }}
                page={page}
                hasMore={!!chats.data?.hasMore}
                onPageChange={setPage}
                isLoading={chats.isPending}
                isError={chats.isError}
                error={chats.error}
                onRetry={() => void chats.refetch()}
                userRole="SELLER"
                toolbarAction={
                  <IconActionButton
                    action="reload"
                    label="Làm mới hội thoại"
                    disabled={chats.isFetching}
                    onClick={refreshMessages}
                  />
                }
              />
            )}
          </div>
          <div className="chat-layout-main">
            {active ? (
              <div className="staff-chat-active">
                {!active.otherPartyActive && (
                  <p role="status" className="staff-chat-readonly">
                    Tài khoản {active.otherPartyName} hiện không hoạt động. Bạn có thể đọc lịch sử,
                    chưa thể gửi thêm tin nhắn.
                  </p>
                )}
                <ConversationView
                  key={`${scope}:${active.id}`}
                  chatId={active.id}
                  otherPartyName={active.otherPartyName}
                  transport={staffChatTransport}
                  staffRole={seller ? 'SELLER' : 'SELLER_STAFF'}
                  cacheScope={scope}
                  disabled={!active.otherPartyActive}
                  isActive={visible}
                  onBack={() => setMode('list')}
                  onMessagesReadLocally={invalidateList}
                  registerRealtimeHandlers={(onMessage, onRead) => {
                    messageHandler.current = onMessage;
                    readHandler.current = onRead;
                  }}
                />
              </div>
            ) : (
              <div className="chat-empty-selection">
                <MessageSquare size={36} aria-hidden="true" />
                <h2 className="chat-empty-selection-title">
                  {seller ? 'Chọn nhân viên để nhắn tin' : 'Chọn cuộc trò chuyện'}
                </h2>
              </div>
            )}
          </div>
        </div>
      </RefreshRegion>
    </section>
  );
}
