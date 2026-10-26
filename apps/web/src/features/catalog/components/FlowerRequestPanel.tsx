import { Button, MessageSquare } from '@florabot/ui';
import type { CatalogItem } from '../catalog.types';
import { FlowerRequestForm } from './FlowerRequestForm';

interface FlowerRequestPanelProps {
  selected: CatalogItem | null;
  onClose: () => void;
  onOpenChat: (item: CatalogItem) => void;
  openingChatId: string | null;
}

export function FlowerRequestPanel({
  selected,
  onClose,
  onOpenChat,
  openingChatId,
}: FlowerRequestPanelProps) {
  if (!selected) return null;

  return (
    <section className="flower-request" aria-labelledby="selected-flower">
      <div className="flower-request-heading">
        <h2 id="selected-flower" className="flower-request-title">
          Đặt {selected.name}
        </h2>
        <Button variant="outline" onClick={onClose}>
          Đóng mẫu đang chọn
        </Button>
      </div>
      <p className="flower-request-meta">
        {selected.shopName} · {selected.kioskName}
      </p>
      <FlowerRequestForm key={`${selected.productId}-${selected.kioskId}`} item={selected} />
      <div className="flower-request-actions">
        <Button
          variant="outline"
          type="button"
          className="chat-open-btn"
          disabled={openingChatId === selected.productId}
          onClick={() => onOpenChat(selected)}
        >
          <MessageSquare size={16} aria-hidden="true" />
          {openingChatId === selected.productId ? 'Đang mở chat…' : 'Nhắn tin với shop'}
        </Button>
      </div>
    </section>
  );
}
