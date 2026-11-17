import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, MessageSquare } from '@florabot/ui';
import { queryClient } from '@/shared/lib/api';
import { formatChatError, openCustomerChat } from '../chat/api';
import {
  customerConversationHref,
  rememberOpenedCustomerChat,
} from '../chat/customer-chat.navigation';
import type { OrderFilter, WebOrder } from './orders.types';
import styles from './customer-orders.module.css';
import { orderReturnHref } from './order-navigation';

export default function CustomerOrderChat({
  row,
  page,
  filter,
  className,
}: {
  row: WebOrder;
  page: number;
  filter: OrderFilter;
  className?: string;
}) {
  const router = useRouter();
  const opening = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function open() {
    if (opening.current) return;
    opening.current = true;
    setBusy(true);
    setError('');
    try {
      const chat = await openCustomerChat({ sellerId: row.sellerId, productId: row.productId });
      rememberOpenedCustomerChat(chat);
      queryClient.removeQueries({ queryKey: ['member-chats'] });
      router.push(customerConversationHref(chat.id, orderReturnHref(row.id, page, filter)));
    } catch (cause) {
      setError(formatChatError(cause));
    } finally {
      opening.current = false;
      setBusy(false);
    }
  }
  return (
    <div className={className ? `${styles.orderChat} ${className}` : styles.orderChat}>
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        aria-busy={busy}
        onClick={() => void open()}
      >
        <MessageSquare size={16} aria-hidden="true" />
        {busy ? 'Đang mở trò chuyện…' : 'Nhắn shop về đơn này'}
      </Button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
