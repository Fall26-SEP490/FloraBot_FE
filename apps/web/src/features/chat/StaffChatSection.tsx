'use client';

import './chat.css';

import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, MessageSquare, RefreshCw } from '@florabot/ui';
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
  const [staffDraft, setStaffDraft] = useState<string>();
  const staffId = staffDraft ?? params.get('staff') ?? '';
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
  const items = chats.data?.items ?? [];
  const active = selected ? (items.find((item) => item.id === selected.id) ?? selected) : null;
  const visible = desktop || mode === 'conversation';
  const invalidateList = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['staff-chats', scope] });
  }, [scope]);
  const refreshMessages = useCallback(() => {
    invalidateList();
    void queryClient.invalidateQueries({ queryKey: ['staff-chat-messages', scope] });
  }, [invalidateList, scope]);
  const opening = useMutation({
    mutationFn: () =>
      seller ? openStaffChatForSeller(session.sellerId!, staffId) : openStaffChatForStaff(),
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
    <section className="staff-chat-section" aria-labelledby="staff-chat-title">
      <div className="staff-chat-intro">
        <div>
          <h2 id="staff-chat-title">
            {seller ? 'Trao đổi với đội ngũ của shop' : 'Trao đổi với chủ shop'}
          </h2>
          <p>Nhắn tin, gửi ảnh và theo dõi phản hồi trong cùng một cuộc trò chuyện.</p>
        </div>
        <Button variant="outline" disabled={chats.isFetching} onClick={refreshMessages}>
          <RefreshCw size={16} aria-hidden="true" />
          Làm mới hội thoại
        </Button>
      </div>
      <div className={`chat-layout staff-chat-layout mode-${mode}`}>
        <div className="chat-layout-sidebar">
          <div className="chat-sidebar-header">
            <h3 className="chat-sidebar-title">
              {seller ? 'Tin nhắn nhân viên' : 'Tin nhắn với shop'}
            </h3>
            {seller ? (
              <div className="staff-chat-start">
                <label htmlFor="staff-chat-person">Chọn nhân viên đang hoạt động</label>
                <select
                  id="staff-chat-person"
                  value={staffId}
                  onChange={(event) => {
                    setStaffDraft(event.target.value);
                    opening.reset();
                  }}
                  disabled={directory.isPending || opening.isPending}
                >
                  <option value="">Chọn nhân viên…</option>
                  {activeStaff.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.fullName}
                    </option>
                  ))}
                </select>
                {directory.isPending && <p role="status">Đang tải nhân viên…</p>}
                {directory.isError && (
                  <div role="alert">
                    <p>{formatChatError(directory.error)}</p>
                    <Button variant="outline" onClick={() => void directory.refetch()}>
                      Tải lại nhân viên
                    </Button>
                  </div>
                )}
                {directory.isSuccess && activeStaff.length === 0 && (
                  <p>
                    Shop chưa có nhân viên đang hoạt động. Bạn có thể thêm tại mục Nhân viên shop.
                  </p>
                )}
                <Button
                  disabled={
                    opening.isPending || !activeStaff.some((person) => person.id === staffId)
                  }
                  onClick={() => opening.mutate()}
                >
                  <MessageSquare size={16} aria-hidden="true" />
                  {opening.isPending ? 'Đang mở…' : 'Nhắn với nhân viên'}
                </Button>
              </div>
            ) : (
              <Button
                className="staff-chat-open-shop"
                disabled={opening.isPending}
                onClick={() => opening.mutate()}
              >
                <MessageSquare size={16} aria-hidden="true" />
                {opening.isPending ? 'Đang mở…' : 'Nhắn với chủ shop'}
              </Button>
            )}
            {opening.isError && <p role="alert">{formatChatError(opening.error)}</p>}
          </div>
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
          />
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
              <h3>Chọn người để bắt đầu trao đổi</h3>
              <p className="quiet">
                {seller
                  ? 'Chọn nhân viên hoặc một cuộc trò chuyện đã có.'
                  : 'Bấm Nhắn với chủ shop để mở cuộc trò chuyện của bạn.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
