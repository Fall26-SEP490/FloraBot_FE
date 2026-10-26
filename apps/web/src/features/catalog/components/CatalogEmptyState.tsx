import { Button, Flower2, RotateCcw } from '@florabot/ui';

interface CatalogEmptyStateProps {
  isPending: boolean;
  isError: boolean;
  hasItems: boolean;
  search: string;
  hasActiveFilters: boolean;
  onRefetch: () => void;
  onResetFilters: () => void;
}

export function CatalogEmptyState({
  isPending,
  isError,
  hasItems,
  search,
  hasActiveFilters,
  onRefetch,
  onResetFilters,
}: CatalogEmptyStateProps) {
  if (isPending) {
    return (
      <div className="catalog-loading-state">
        <p role="status">Đang tìm những bó hoa dành cho bạn…</p>
      </div>
    );
  }

  if (isError && !hasItems) {
    return (
      <div className="catalog-empty-card">
        <div className="catalog-empty-icon-wrap is-error">
          <Flower2 size={38} strokeWidth={1.5} aria-hidden="true" />
        </div>
        <h2 className="catalog-empty-title">Chưa tải được danh mục hoa</h2>
        <p className="catalog-empty-desc">
          Hệ thống tạm thời chưa kết nối được máy chủ danh mục. Bạn thử tải lại nhé.
        </p>
        <Button onClick={onRefetch}>Tải lại mẫu hoa</Button>
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
          {trimmedSearch || hasActiveFilters
            ? 'Bạn thử kiểm tra lại chính tả từ khóa, hoặc đặt lại bộ lọc dịp tặng và khoảng giá để xem toàn bộ danh mục hoa có sẵn nhé.'
            : 'Các cửa hàng hoa đang chuẩn bị và cập nhật thêm sản phẩm tại tủ kiosk. Bạn vui lòng quay lại sau nhé!'}
        </p>
        {hasActiveFilters && (
          <div className="catalog-empty-actions">
            <Button className="catalog-empty-reset-btn" onClick={onResetFilters}>
              <RotateCcw size={15} aria-hidden="true" />
              <span>Xóa bộ lọc để xem tất cả</span>
            </Button>
          </div>
        )}
      </div>
    );
  }

  return null;
}
