import { rentalAllocation } from '../../kiosk-pricing/ApplicationRentalSummary';
import { Button, Boxes, CircleAlert, ClipboardList, Eye, RefreshCw } from '@florabot/ui';
import type { KioskApplicationPage, KioskApplicationResponse } from '../installations.types';
import { managerApplicationAction } from '../operations-presentation';
import WorkspaceTable from '../../portal/components/WorkspaceTable';
import { KIOSK_STATUS_LABELS } from '../installations.constants';

interface InstallationListItemProps {
  item: KioskApplicationResponse;
  isSelected: boolean;
  isManager: boolean;
  onSelect: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

function InstallationListItem({
  item,
  isSelected,
  onSelect,
  isManager,
}: InstallationListItemProps) {
  return (
    <tr className={isSelected ? 'is-selected-row' : ''}>
      <td data-label="Shop & liên hệ">
        <strong>{item.shopName}</strong>
        <span className="table-secondary">{item.phone}</span>
      </td>
      <td data-label="Kiosk / Kỹ thuật viên">
        <strong>{item.assignedKioskCode || '—'}</strong>
        {item.assignedTechnicianName && (
          <span className="table-secondary">{item.assignedTechnicianName}</span>
        )}
      </td>
      <td data-label="Gói thuê">
        <span className="table-truncate" title={item.packageName}>
          {item.packageName}
        </span>
        <span className="table-secondary">{rentalAllocation(item)}</span>
      </td>
      <td data-label="Ngày tiếp nhận">{new Date(item.createdAt).toLocaleDateString('vi-VN')}</td>
      <td data-label="Trạng thái">
        <span className="table-badge" data-state={item.status}>
          {KIOSK_STATUS_LABELS[item.status] || item.status}
        </span>
      </td>
      <td data-label="Thao tác">
        <Button
          variant={isSelected ? 'default' : 'outline'}
          onClick={onSelect}
          aria-expanded={isSelected}
          aria-controls={isSelected ? 'installation-detail' : undefined}
        >
          <Eye size={16} aria-hidden="true" />
          {isSelected ? 'Đang xem' : isManager ? managerApplicationAction(item.status) : 'Xem'}
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
  onOpenInventory?: () => void;
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
  onOpenInventory,
}: InstallationListProps) {
  return (
    <section className="operations-queue-section" aria-labelledby="queue-heading">
      <div className="operations-section-heading">
        <div>
          <h2 id="queue-heading">{isManager ? 'Hàng đợi hồ sơ' : 'Danh sách hồ sơ'}</h2>
        </div>
        {isManager && (
          <div className="installation-header-actions">
            {onOpenInventory && (
              <Button variant="outline" onClick={onOpenInventory}>
                <Boxes size={17} aria-hidden="true" /> Kho tủ khả dụng
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="queue-filter-bar installation-filter-bar">
        <div className="filter-group">
          <label htmlFor="status-filter-select">Trạng thái</label>
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

        {isError && (
          <Button
            variant="outline"
            className="refresh-btn"
            onClick={onRefresh}
            disabled={isFetching}
          >
            <RefreshCw className={isFetching ? 'spin' : ''} size={16} aria-hidden="true" />
            Làm mới
          </Button>
        )}
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
        <div className="installation-results">
          <p className="installation-results-caption" role="status">
            <span>
              <strong>{applicationsPage.items.length} hồ sơ</strong> trong trang {page}
            </span>
          </p>
          <WorkspaceTable label="Danh sách hồ sơ thuê kiosk">
            <table className="installation-register-table" aria-label="Danh sách hồ sơ thuê kiosk">
              <thead>
                <tr>
                  <th scope="col">Shop</th>
                  <th scope="col">Kiosk / Kỹ thuật viên</th>
                  <th scope="col">Gói thuê</th>
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
                      </div>
                    </td>
                  </tr>
                ) : (
                  applicationsPage.items.map((item) => (
                    <InstallationListItem
                      key={item.id}
                      item={item}
                      isManager={isManager}
                      isSelected={selectedAppId === item.id}
                      onSelect={(event) => {
                        onSelectApp(
                          selectedAppId === item.id ? null : item.id,
                          event.currentTarget,
                        );
                      }}
                    />
                  ))
                )}
              </tbody>
            </table>
          </WorkspaceTable>
          {/* Pagination */}
          <div className="table-pagination-row" aria-busy={isFetching}>
            <Button
              variant="outline"
              disabled={page <= 1 || isFetching}
              onClick={() => onPageChange((p) => p - 1)}
            >
              Trang trước
            </Button>
            <span aria-live="polite">Trang {page}</span>
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
