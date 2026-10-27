import { Button, CircleAlert, ClipboardList, Eye, RefreshCw } from '@florabot/ui';
import type { KioskApplicationPage, KioskApplicationResponse } from '../installations.types';
import { KIOSK_STATUS_LABELS, OPERATIONS_STAGE_TABS } from '../installations.constants';

interface InstallationListItemProps {
  item: KioskApplicationResponse;
  isSelected: boolean;
  onSelect: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

function InstallationListItem({ item, isSelected, onSelect }: InstallationListItemProps) {
  return (
    <tr className={isSelected ? 'is-selected-row' : ''}>
      <td data-label="Shop & liên hệ">
        <strong>{item.shopName}</strong>
        <div className="table-sub-text">{item.phone}</div>
      </td>
      <td data-label="Gói thuê">
        <strong>{item.packageName}</strong>
        <div className="table-sub-text">
          {item.walkInSlots}W + {item.preorderSlots}P ({item.totalSlots} ô)
        </div>
      </td>
      <td data-label="Địa chỉ lắp đặt">
        <span className="address-truncate" title={item.installationAddress}>
          {item.installationAddress}
        </span>
      </td>
      <td data-label="Ngày tiếp nhận">{new Date(item.createdAt).toLocaleDateString('vi-VN')}</td>
      <td data-label="Trạng thái">
        <span className="kiosk-status-pill" data-status={item.status}>
          {KIOSK_STATUS_LABELS[item.status] || item.status}
        </span>
      </td>
      <td data-label="">
        <Button variant={isSelected ? 'default' : 'outline'} onClick={onSelect}>
          <Eye size={16} aria-hidden="true" />
          {isSelected ? 'Đang xem' : 'Chi tiết'}
        </Button>
      </td>
    </tr>
  );
}

interface InstallationListProps {
  isManager: boolean;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  page: number;
  onPageChange: (updater: (prev: number) => number) => void;
  applicationsPage?: KioskApplicationPage;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  selectedAppId?: string | null;
  onSelectApp: (appId: string | null, triggerButton: HTMLButtonElement) => void;
  onRefresh: () => void;
  onOpenEnroll: () => void;
  enrollPending?: boolean;
}

export function InstallationList({
  isManager,
  statusFilter,
  onStatusFilterChange,
  page,
  onPageChange,
  applicationsPage,
  isLoading,
  isError,
  isFetching,
  selectedAppId,
  onSelectApp,
  onRefresh,
  onOpenEnroll,
  enrollPending,
}: InstallationListProps) {
  return (
    <section className="operations-queue-section" aria-labelledby="queue-heading">
      <div className="operations-section-heading">
        <div>
          <h2 id="queue-heading">Hàng đợi hồ sơ</h2>
          <p>Chọn một hồ sơ để kiểm tra thông tin và thực hiện bước tiếp theo.</p>
        </div>
        {isManager && (
          <Button variant="outline" onClick={onOpenEnroll} disabled={enrollPending}>
            + Thêm tủ mới
          </Button>
        )}
      </div>

      <div className="operations-stage-tabs" role="group" aria-label="Lọc nhanh hồ sơ">
        {OPERATIONS_STAGE_TABS.map(([value, label]) => (
          <button
            type="button"
            key={value}
            aria-pressed={statusFilter === value}
            onClick={() => onStatusFilterChange(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="queue-filter-bar">
        <div className="filter-group">
          <label htmlFor="status-filter-select">Lọc theo trạng thái:</label>
          <select
            id="status-filter-select"
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="AWAITING_PAYMENT">Chờ thanh toán</option>
            <option value="PAID_REVIEW">Đã thanh toán - Chờ duyệt</option>
            <option value="UNDER_REVIEW">Đang xem xét</option>
            <option value="CONFIRMED">Đã xác nhận - Chờ xếp lịch</option>
            <option value="SCHEDULED">Đã xếp lịch</option>
            <option value="INSTALLING">Đang lắp đặt</option>
            <option value="AWAITING_HANDOVER">Chờ nghiệm thu</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="REFUND_PENDING">Đang hoàn tiền</option>
            <option value="CANCELLED">Đã hủy</option>
            <option value="REJECTED">Đã từ chối</option>
            <option value="REFUNDED">Đã hoàn tiền</option>
          </select>
        </div>

        <Button variant="outline" className="refresh-btn" onClick={onRefresh} disabled={isFetching}>
          <RefreshCw className={isFetching ? 'spin' : ''} size={16} aria-hidden="true" />
          Làm mới
        </Button>
      </div>

      {isLoading && (
        <p role="status" className="kiosk-status-loading">
          <RefreshCw className="spin" size={16} aria-hidden="true" />
          Đang tải danh sách hồ sơ kiosk...
        </p>
      )}

      {isError && (
        <div role="alert" className="kiosk-field-error-banner">
          <CircleAlert size={18} aria-hidden="true" />
          <span>Không thể tải danh sách hồ sơ. Vui lòng thử lại.</span>
        </div>
      )}

      {applicationsPage && !isError && (
        <div className="table-responsive">
          <table className="kiosk-data-table" aria-label="Danh sách hồ sơ thuê kiosk">
            <thead>
              <tr>
                <th scope="col">Shop & Liên hệ</th>
                <th scope="col">Gói thuê</th>
                <th scope="col">Địa chỉ lắp đặt</th>
                <th scope="col">Ngày tạo</th>
                <th scope="col">Trạng thái</th>
                <th scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {applicationsPage.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-empty-cell">
                    <div className="operations-empty">
                      <ClipboardList size={32} aria-hidden="true" />
                      <h3>Chưa có hồ sơ phù hợp</h3>
                      <p>Thử chọn trạng thái khác hoặc làm mới để kiểm tra hồ sơ vừa tiếp nhận.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                applicationsPage.items.map((item) => (
                  <InstallationListItem
                    key={item.id}
                    item={item}
                    isSelected={selectedAppId === item.id}
                    onSelect={(event) => {
                      onSelectApp(selectedAppId === item.id ? null : item.id, event.currentTarget);
                    }}
                  />
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="table-pagination-row">
            <Button
              variant="outline"
              disabled={page <= 1 || isFetching}
              onClick={() => onPageChange((p) => p - 1)}
            >
              Trang trước
            </Button>
            <span>Trang {page}</span>
            <Button
              variant="outline"
              disabled={!applicationsPage.hasMore || isFetching}
              onClick={() => onPageChange((p) => p + 1)}
            >
              Trang sau
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
