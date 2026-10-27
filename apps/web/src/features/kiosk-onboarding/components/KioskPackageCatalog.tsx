import { Boxes, Button, CircleAlert, RefreshCw, Store } from '@florabot/ui';
import type { KioskPackageResponse } from '../../installations/installations.types';

interface KioskPackageCatalogProps {
  packages: KioskPackageResponse[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRefetch: () => void;
  selectedPackageId: string;
  onSelectPackage: (id: string) => void;
  error?: string;
}

export function KioskPackageCatalog({
  packages,
  isLoading,
  isError,
  onRefetch,
  selectedPackageId,
  onSelectPackage,
  error,
}: KioskPackageCatalogProps) {
  return (
    <section className="kiosk-packages-section" aria-labelledby="packages-catalog-heading">
      <div className="section-title-wrap">
        <h2 id="packages-catalog-heading">1. Chọn gói thuê kiosk hàng năm</h2>
        <p>
          Mỗi gói tương ứng với một tủ vật lý nguyên chiếc được cấu hình số lượng ô đặt trước và ô
          vãng lai cố định.
        </p>
      </div>

      {isLoading && (
        <p role="status" className="kiosk-status-loading">
          <RefreshCw className="spin" size={18} aria-hidden="true" />
          Đang tải bảng giá các gói kiosk...
        </p>
      )}

      {isError && (
        <div role="alert" className="kiosk-packages-error">
          <CircleAlert size={20} aria-hidden="true" />
          <div>
            <p>Chưa tải được danh mục gói thuê từ máy chủ.</p>
            <Button variant="outline" onClick={onRefetch}>
              Thử lại
            </Button>
          </div>
        </div>
      )}

      {packages && (
        <div
          className="kiosk-packages-grid"
          role="radiogroup"
          aria-labelledby="packages-catalog-heading"
        >
          {packages.map((pkg) => {
            const isSelected = selectedPackageId === pkg.id;
            return (
              <div
                key={pkg.id}
                className={`kiosk-package-card ${isSelected ? 'is-selected' : ''}`}
                onClick={() => onSelectPackage(pkg.id)}
                tabIndex={0}
                role="radio"
                aria-checked={isSelected}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    onSelectPackage(pkg.id);
                  }
                }}
              >
                <div className="package-card-header">
                  <span className="package-tier-badge">{pkg.name}</span>
                  <div className="package-price">
                    <span className="price-number">
                      {Number(pkg.annualFee).toLocaleString('vi-VN')}
                    </span>
                    <span className="price-unit">đ / năm</span>
                  </div>
                </div>

                <div className="package-slots-breakdown">
                  <div className="slot-item">
                    <Boxes size={18} aria-hidden="true" />
                    <span>
                      <strong>{pkg.walkInSlots}</strong> ô vãng lai (Walk-in)
                    </span>
                  </div>
                  <div className="slot-item">
                    <Store size={18} aria-hidden="true" />
                    <span>
                      <strong>{pkg.preorderSlots}</strong> ô đặt trước (Pre-order)
                    </span>
                  </div>
                  <div className="slot-total">
                    Tổng sức chứa: <strong>{pkg.totalSlots} ô tủ</strong>
                  </div>
                </div>

                <p className="package-desc">{pkg.description}</p>

                <div className="package-select-action">
                  <span className={`select-indicator ${isSelected ? 'is-active' : ''}`}>
                    {isSelected ? '✓ Đã chọn gói này' : 'Chọn gói này'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <p role="alert" className="kiosk-field-error">
          {error}
        </p>
      )}
    </section>
  );
}
