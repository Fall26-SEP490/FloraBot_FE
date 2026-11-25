import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { Button, MessageSquare } from '@florabot/ui';
import { ApiError, queryClient, request } from '@/shared/lib/api';
import { formatChatError } from '../chat/api';
import type { CustomerSellerChatItem } from '../chat/types';
import { Modal } from '@/shared/components/Modal';
import { ConversationView } from '../chat/ConversationView';
import { useChatRealtime } from '../chat/useChatRealtime';
import type { ChatMessageReceivedEvent, ChatMessagesReadEvent } from '../chat/types';

function DraftChat({ chat, onClose }: { chat: CustomerSellerChatItem; onClose: () => void }) {
  const messageHandler = useRef<(event: ChatMessageReceivedEvent) => void>(() => {});
  const readHandler = useRef<(event: ChatMessagesReadEvent) => void>(() => {});
  useChatRealtime({
    enabled: true,
    onMessageReceived: (event) => {
      if (event.chatId === chat.id) messageHandler.current(event);
    },
    onMessagesRead: (event) => {
      if (event.chatId === chat.id) readHandler.current(event);
    },
    onReconnect: () => {
      void queryClient.invalidateQueries({ queryKey: ['chat-messages', chat.id] });
    },
  });
  return createPortal(
    <div onSubmit={(event) => event.stopPropagation()}>
      <Modal open title="Nhắn khách" onClose={onClose} size="lg">
        <div style={{ height: 'min(65dvh, 600px)', display: 'flex', minHeight: 0 }}>
          <ConversationView
            chatId={chat.id}
            otherPartyName={chat.otherPartyName}
            productContext={chat.productContext}
            registerRealtimeHandlers={(onMessage, onRead) => {
              messageHandler.current = onMessage;
              readHandler.current = onRead;
            }}
          />
        </div>
      </Modal>
    </div>,
    document.body,
  );
}

export default function SellerOrderChat({
  sellerId,
  requestId,
  onError,
  preserveDraft = false,
}: {
  sellerId: string;
  requestId: string;
  onError: (message: string) => void;
  preserveDraft?: boolean;
}) {
  const router = useRouter();
  const opening = useRef(false);
  const [busy, setBusy] = useState(false);
  const [activeChat, setActiveChat] = useState<CustomerSellerChatItem | null>(null);
  async function open() {
    if (opening.current) return;
    opening.current = true;
    setBusy(true);
    onError('');
    try {
      const chat = await request<CustomerSellerChatItem>(
        `/sellers/${encodeURIComponent(sellerId)}/preorders/${encodeURIComponent(requestId)}/chat/open`,
        {},
        true,
        'POST',
      );
      queryClient.setQueryData(['seller-opened-chat', sellerId, chat.id], chat);
      void queryClient.invalidateQueries({ queryKey: ['seller-chats', sellerId] });
      if (preserveDraft) setActiveChat(chat);
      else router.push(`/seller/chats?chat=${encodeURIComponent(chat.id)}`);
    } catch (cause) {
      onError(
        cause instanceof ApiError && cause.status === 404
          ? 'Chưa mở được chat từ đơn này. Vui lòng tải lại đơn rồi thử lại.'
          : cause instanceof ApiError && cause.status >= 500
            ? 'Chat đang tạm gián đoạn. Vui lòng thử lại sau.'
            : formatChatError(cause),
      );
    } finally {
      opening.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <Button type="button" variant="outline" disabled={busy} onClick={() => void open()}>
        <MessageSquare size={16} aria-hidden="true" />
        {busy ? 'Đang mở trò chuyện…' : 'Nhắn khách'}
      </Button>
      {activeChat && <DraftChat chat={activeChat} onClose={() => setActiveChat(null)} />}
    </>
  );
}
