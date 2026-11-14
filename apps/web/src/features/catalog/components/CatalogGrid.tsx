import { Button } from '@florabot/ui';
import type { CatalogItem } from '../catalog.types';
import { catalogCardKey } from '../catalog.utils';
import { FlowerCard } from './FlowerCard';

interface CatalogGridProps {
  catalogHref?: string;
  items: CatalogItem[];
  page: number;
  hasMore: boolean;
  isFetching: boolean;
  hasLiveItems: boolean;
  openingChatId: string | null;
  onSelect: (item: CatalogItem) => void;
  onOpenChat: (item: CatalogItem) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
}

export function CatalogGrid({
  catalogHref,
  items,
  page,
  hasMore,
  isFetching,
  hasLiveItems,
  openingChatId,
  onSelect,
  onOpenChat,
  onPrevPage,
  onNextPage,
}: CatalogGridProps) {
  return (
    <>
      <ul className="flower-catalog-grid flower-catalog">
        {items.map((item) => (
          <FlowerCard
            key={catalogCardKey(item)}
            item={item}
            catalogHref={catalogHref}
            openingChatId={openingChatId}
            onSelect={onSelect}
            onOpenChat={onOpenChat}
          />
        ))}
      </ul>
      {hasLiveItems && (hasMore || page > 1) && (
        <nav className="stock-actions" aria-label="Phân trang mẫu hoa">
          <Button variant="outline" disabled={page === 1 || isFetching} onClick={onPrevPage}>
            Trang trước
          </Button>
          <span>Trang {page}</span>
          <Button variant="outline" disabled={!hasMore || isFetching} onClick={onNextPage}>
            Trang sau
          </Button>
        </nav>
      )}
    </>
  );
}
