import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { sessionQuery } from '@/shared/lib/api';
import { formatChatError, openCustomerChat } from '@/features/chat/api';
import type { CatalogItem } from '../catalog.types';
import type { ChatNotice } from '../components/ChatNoticeDialog';

export function useCustomerChat(onBeforeOpen: (item: CatalogItem | null) => void) {
  const router = useRouter();
  const session = useQuery(sessionQuery);
  const opening = useRef(false);
  const [openingChatId, setOpeningChatId] = useState<string | null>(null);
  const [chatNotice, setChatNotice] = useState<ChatNotice | null>(null);

  const handleOpenChat = useCallback(
    async (item: CatalogItem) => {
      if (opening.current) return;
      if (item.isDemoSample) {
        setChatNotice({
          kind: 'error',
          message:
            'Mẫu minh họa chưa gắn với shop thật. Hãy chọn sản phẩm từ danh mục API để nhắn tin.',
        });
        return;
      }
      onBeforeOpen(null);
      if (!session.data) {
        const params = new URLSearchParams({
          action: 'chat',
          sellerId: item.sellerId,
          productId: item.productId,
          shopName: item.shopName,
          name: item.name,
        });
        setChatNotice({ kind: 'login', returnUrl: `/dat-hoa?${params}` });
        return;
      }
      if (session.data.role !== 'CUSTOMER') {
        setChatNotice({ kind: 'role' });
        return;
      }
      opening.current = true;
      setOpeningChatId(item.productId);
      setChatNotice(null);
      try {
        const chat = await openCustomerChat({ sellerId: item.sellerId, productId: item.productId });
        try {
          sessionStorage.setItem(
            'florabot_opened_chat',
            JSON.stringify({
              id: chat.id,
              otherPartyName: item.shopName,
              productContext: item.name,
              createdAt: new Date().toISOString(),
            }),
          );
        } catch {
          // Opening the conversation still works when browser storage is unavailable.
        }
        router.push(`/tai-khoan?chat=${encodeURIComponent(chat.id)}#member-chats`);
      } catch (error) {
        setChatNotice({ kind: 'error', message: formatChatError(error) });
      } finally {
        opening.current = false;
        setOpeningChatId(null);
      }
    },
    [onBeforeOpen, router, session.data],
  );

  return { handleOpenChat, openingChatId, chatNotice, setChatNotice };
}
