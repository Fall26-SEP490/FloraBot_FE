import { FlowerGridSkeleton } from '@/shared/components/PageSkeleton';
import IconActionButton from '@/shared/components/IconActionButton';
import { Flower2 } from '@florabot/ui';

interface CatalogEmptyStateProps {
  isPending: boolean;
  error: 'catalog' | 'ratings' | null;
  hasItems: boolean;
  search: string;
  hasActiveFilters: boolean;
  onRefetch: () => void;
  onResetFilters: () => void;
}

export function CatalogEmptyState({
  isPending,
  error,
  hasItems,
  search,
  hasActiveFilters,
  onRefetch,
  onResetFilters,
}: CatalogEmptyStateProps) {
  if (isPending) {
    return <FlowerGridSkeleton gridClassName="flower-catalog-grid flower-catalog" />;
  }

  if (error && !hasItems) {
    const ratingError = error === 'ratings';
    return (
      <div className="catalog-empty-card">
        <div className="catalog-empty-icon-wrap is-error">
          <Flower2 size={38} strokeWidth={1.5} aria-hidden="true" />
        </div>
        <h2 className="catalog-empty-title">
          {ratingError ? 'Chưa tải được đánh giá' : 'Chưa tải được danh mục hoa'}
        </h2>
        <p className="catalog-empty-desc">
          {ratingError
            ? 'Bạn thử tải lại điểm đánh giá để lọc mẫu hoa nhé.'
            : 'Hệ thống tạm thời chưa kết nối được máy chủ danh mục. Bạn thử tải lại nhé.'}
        </p>
        <IconActionButton
          onClick={onRefetch}
          action="reload"
          label={ratingError ? 'Tải lại đánh giá' : 'Tải lại mẫu hoa'}
        />
      </div>
    );
  }

  if (!hasItems) {
    const trimmedSearch = search.trim();
    return (
      <div className="catalog-empty-card">
        <div className="catalog-empty-icon-wrap">
          <Flower2 size={40} strokeWidth={1.5} aria-hidden="true" />
        </div>
        <h2 className="catalog-empty-title">
          {trimmedSearch
            ? `Không tìm thấy mẫu hoa nào cho "${trimmedSearch}"`
            : hasActiveFilters
              ? 'Không có mẫu hoa nào khớp với bộ lọc'
              : 'Hiện chưa có mẫu hoa nào đang mở bán'}
        </h2>
        <p className="catalog-empty-desc">
          {trimmedSearch
            ? 'Thử từ khóa khác hoặc chọn tag để tìm mẫu hoa phù hợp.'
            : hasActiveFilters
              ? 'Thử thay đổi hoặc xóa bộ lọc để xem thêm mẫu hoa.'
              : 'Các cửa hàng hoa đang chuẩn bị mẫu mới. Bạn vui lòng quay lại sau nhé!'}
        </p>
        {hasActiveFilters && (
          <div className="catalog-empty-actions">
            <IconActionButton
              className="catalog-empty-reset-btn"
              onClick={onResetFilters}
              action="clear"
              label="Xóa bộ lọc"
            />
          </div>
        )}
      </div>
    );
  }

  return null;
}
