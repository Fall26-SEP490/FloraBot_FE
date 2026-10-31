import { Boxes, Button, CircleAlert, RefreshCw } from '@florabot/ui';
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
          Thuê trọn kiosk theo sức chứa phù hợp. Bạn chọn hình thức bán cho từng ô trống khi vận
          hành.
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
              <label
                key={pkg.id}
                className={`kiosk-package-card ${isSelected ? 'is-selected' : ''}`}
              >
                <input
                  type="radio"
                  name="kiosk-lease-package"
                  value={pkg.id}
                  checked={isSelected}
                  onChange={() => onSelectPackage(pkg.id)}
                  aria-label={pkg.name}
                  className="kiosk-package-radio"
                />
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
                      <strong>{pkg.totalSlots}</strong> ô tủ · Thuê nguyên kiosk
                    </span>
                  </div>
                </div>

                <p className="package-desc">
                  Kinh doanh hoa bán sẵn và nhận đơn đặt trước tại cùng một điểm bán.
                </p>

                <div className="package-select-action">
                  <span className={`select-indicator ${isSelected ? 'is-active' : ''}`}>
                    {isSelected ? '✓ Đã chọn gói này' : 'Chọn gói này'}
                  </span>
                </div>
              </label>
            );
          })}
        </div>
      )}

      {!isLoading && !isError && packages?.length === 0 && (
        <p role="status" className="kiosk-packages-error">
          Hiện chưa có gói thuê. Vui lòng quay lại sau.
        </p>
      )}

      {error && (
        <p role="alert" className="kiosk-field-error">
          {error}
        </p>
      )}
    </section>
  );
}
