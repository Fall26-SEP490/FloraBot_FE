import { useState } from 'react';
import { Button, RefreshCw, Eye } from '@florabot/ui';
import { useAdminQueues } from '../use-admin-queues';
import AdminQueueItem from './AdminQueueItem';
import '../styles/admin-approvals.css';

export default function AdminApprovalCenter({ actorId }: { actorId: string }) {
  const [onlyWithItems, setOnlyWithItems] = useState(false);
  const rows = useAdminQueues(actorId);
  const busy = rows.some(({ query }) => query.isFetching);
  const reviewRows = rows.filter(({ queue }) => queue.group === 'review');
  const visibleReviewRows = reviewRows.filter(
    ({ query }) => !onlyWithItems || !query.isSuccess || query.data.count > 0,
  );
  return (
    <section className="admin-approval-center" aria-label="Trung tâm yêu cầu">
      <section className="admin-review-section" aria-labelledby="approval-center-title">
        <div className="admin-section-heading">
          <div>
            <h2 id="approval-center-title">Admin cần xử lý</h2>
            <p>Chọn loại yêu cầu để kiểm tra hồ sơ và thực hiện bước tiếp theo.</p>
          </div>
          <Button
            variant="outline"
            disabled={busy}
            data-busy={busy}
            onClick={() => void Promise.all(rows.map(({ query }) => query.refetch()))}
          >
            <RefreshCw size={16} aria-hidden="true" />
            {busy ? 'Đang cập nhật…' : 'Cập nhật danh sách'}
          </Button>
        </div>
        <div className="admin-queue-toolbar">
          <div className="admin-segmented" role="group" aria-label="Hiển thị yêu cầu cần xử lý">
            <button
              type="button"
              aria-pressed={!onlyWithItems}
              onClick={() => setOnlyWithItems(false)}
            >
              Tất cả
            </button>
            <button
              type="button"
              aria-pressed={onlyWithItems}
              onClick={() => setOnlyWithItems(true)}
            >
              Có yêu cầu
            </button>
          </div>
          <p className="admin-scope-note">
            Số lượng theo lần tải hiện tại; dấu + nghĩa là còn trang tiếp theo.
          </p>
        </div>
        <div className="admin-queue-list">
          {visibleReviewRows.map(({ queue, query }) => (
            <AdminQueueItem key={queue.key} queue={queue} query={query} />
          ))}
          {visibleReviewRows.length === 0 && (
            <div className="admin-calm-empty" role="status">
              <h3>Chưa có yêu cầu cần xử lý</h3>
              <p>
                Các danh sách vừa tải đều trống. Chọn “Tất cả” để mở từng mục hoặc cập nhật lại.
              </p>
            </div>
          )}
        </div>
      </section>
      <section className="admin-monitor-section" aria-labelledby="admin-monitor-title">
        <div className="admin-section-heading">
          <div>
            <h2 id="admin-monitor-title">Theo dõi vận hành</h2>
            <p>
              <Eye size={16} aria-hidden="true" /> Kiểm tra sự cố và tiến độ thuê kiosk. Quản lý vận
              hành phụ trách xếp lịch và bàn giao.
            </p>
          </div>
        </div>
        <div className="admin-queue-list">
          {rows
            .filter(({ queue }) => queue.group === 'monitor')
            .map(({ queue, query }) => (
              <AdminQueueItem key={queue.key} queue={queue} query={query} />
            ))}
        </div>
      </section>
    </section>
  );
}
