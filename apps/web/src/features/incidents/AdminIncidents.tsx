import { AdminFilterBar, AdminDisclosureSummary } from '@/features/portal/components/AdminUi';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { queryClient, request } from '@/shared/lib/api';
import type {
  AdminIncidentDetail,
  AdminIncidentPage,
  AdminIncidentResponse,
} from './incidents.types';
import { formatIncidentDate, formatIncidentLabel, safeUrl } from './incidents.utils';

type Incident = AdminIncidentResponse;
type Detail = AdminIncidentDetail;
type Page = AdminIncidentPage;

function IncidentItem({ row }: { row: Incident }) {
  const [open, setOpen] = useState(false);
  const [evidencePage, setEvidencePage] = useState(1);
  const detail = useQuery({
    queryKey: ['admin-incident', row.id, evidencePage],
    queryFn: () =>
      request<Detail>(
        `/admin/incidents/${row.id}${evidencePage > 1 ? `?evidencePage=${evidencePage}` : ''}`,
      ),
    enabled: open,
  });
  return (
    <li>
      <details onToggle={(event) => setOpen(event.currentTarget.open)}>
        <AdminDisclosureSummary
          statusCode={row.status}
          title={formatIncidentLabel(row)}
          meta={formatIncidentDate(row.createdAt)}
          status={row.kind === 'DISPENSE_FAILED' ? 'Không giao được hoa' : 'Sự cố thiết bị'}
        />
        {open && (
          <div className="incident-detail">
            {detail.isPending ? (
              <p role="status">Đang tải chi tiết sự cố…</p>
            ) : detail.isError ? (
              <>
                <p role="alert" className="error">
                  Chưa tải được chi tiết sự cố.
                </p>
                <Button variant="outline" onClick={() => void detail.refetch()}>
                  Tải lại chi tiết
                </Button>
              </>
            ) : (
              <>
                <p>{detail.data.incident.location?.address}</p>
                <p className="incident-text">{detail.data.incident.reason}</p>
                <p className="quiet">Mã sự cố: {row.id}</p>
                <h3>Ảnh minh chứng</h3>
                <p className="quiet">
                  Đường dẫn do người báo cung cấp, chưa xác minh nội dung. Ảnh mở ở tab mới.
                </p>
                {detail.data.evidence.items.length === 0 ? (
                  <p>Chưa có ảnh đính kèm.</p>
                ) : (
                  <ul className="incident-evidence">
                    {detail.data.evidence.items.map((photo, index) => {
                      const url = safeUrl(photo.url);
                      const photoIndex = (evidencePage - 1) * 20 + index + 1;
                      const sourceLabel =
                        photo.source === 'STAFF_TASK'
                          ? ' · Ảnh kiểm tra kỹ thuật'
                          : photo.source === 'INCIDENT'
                            ? ' · Ảnh báo sự cố'
                            : '';
                      return (
                        <li key={photo.id}>
                          {url ? (
                            <>
                              <a href={url} target="_blank" rel="noopener noreferrer">
                                Mở ảnh minh chứng {photoIndex}
                              </a>
                              {sourceLabel && <span className="quiet">{sourceLabel}</span>}
                            </>
                          ) : (
                            <span>Ảnh {photoIndex}: đường dẫn không hợp lệ để mở an toàn.</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {detail.data.evidence.hasMore && (
                  <p>
                    Đang hiển thị 20 ảnh ở trang {evidencePage}. Còn ảnh khác trong hồ sơ, cần đối
                    chiếu đầy đủ trước khi kết luận.
                  </p>
                )}
                {(evidencePage > 1 || detail.data.evidence.hasMore) && (
                  <nav className="stock-actions" aria-label="Phân trang ảnh sự cố">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={evidencePage === 1 || detail.isFetching}
                      onClick={() => setEvidencePage((value) => Math.max(1, value - 1))}
                    >
                      Ảnh trang trước
                    </Button>
                    <span>Trang ảnh {evidencePage}</span>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!detail.data.evidence.hasMore || detail.isFetching}
                      onClick={() => setEvidencePage((value) => value + 1)}
                    >
                      Ảnh trang sau
                    </Button>
                  </nav>
                )}
                {detail.data.incident.status === 'OPEN' ? (
                  <p className="quiet">
                    Đang được theo dõi trong luồng vận hành. Quản lý vận hành tiếp nhận, phân công
                    kỹ thuật viên và kiểm tra báo cáo. Admin xem tiến độ và ảnh minh chứng tại đây.
                  </p>
                ) : (
                  <>
                    <h3>Đã xử lý</h3>
                    <p className="incident-text">
                      {detail.data.incident.decision || 'Chưa có ghi chú.'}
                    </p>
                    {detail.data.incident.resolvedAt && (
                      <p>{formatIncidentDate(detail.data.incident.resolvedAt)}</p>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </details>
    </li>
  );
}

export default function AdminIncidents() {
  const [status, setStatus] = useState('OPEN');
  const [page, setPage] = useState(1);
  const queue = useQuery({
    queryKey: ['admin-incidents', status, page],
    queryFn: () => request<Page>(`/admin/incidents?status=${status}&page=${page}`),
  });
  return (
    <section className="admin-incidents" aria-labelledby="incidents-title">
      <h2 id="incidents-title">Theo dõi sự cố tủ hoa</h2>
      <p>
        Chế độ giám sát. Quản lý vận hành phụ trách tiếp nhận, phân công và duyệt kết quả xử lý sự
        cố. Mỗi trang có tối đa 25 sự cố.
      </p>
      <AdminFilterBar
        actions={
          <>
            <Button
              variant="outline"
              disabled={queue.isFetching}
              onClick={() => {
                setPage(1);
                void queryClient.invalidateQueries({ queryKey: ['admin-incidents'] });
                void queryClient.invalidateQueries({ queryKey: ['admin-incident'] });
              }}
            >
              Cập nhật danh sách sự cố
            </Button>
          </>
        }
      >
        <div>
          <label htmlFor="incident-status">Trạng thái sự cố</label>
          <select
            id="incident-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="OPEN">Đang mở · cũ nhất trước</option>
            <option value="RESOLVED_FIXED">Đã xử lý · mới nhất trước</option>
          </select>
        </div>
      </AdminFilterBar>
      {queue.isPending ? (
        <p role="status">Đang tải danh sách sự cố…</p>
      ) : queue.isError ? (
        <p role="alert" className="error">
          Chưa tải được sự cố. Chọn “Cập nhật danh sách sự cố” để thử lại.
        </p>
      ) : (
        <>
          {queue.data.items.length === 0 && (
            <p>
              {page === 1
                ? 'Chưa có sự cố trong nhóm này.'
                : 'Trang này không còn sự cố. Quay lại trang trước hoặc cập nhật danh sách.'}
            </p>
          )}
          <ul className="admin-shop-list">
            {queue.data.items.map((row) => (
              <IncidentItem key={row.id} row={row} />
            ))}
          </ul>
          <nav className="stock-actions" aria-label="Phân trang sự cố">
            <Button
              variant="outline"
              disabled={page === 1 || queue.isFetching}
              onClick={() => setPage((value) => value - 1)}
            >
              Trang sự cố trước
            </Button>
            <span>Trang {page}</span>
            <Button
              variant="outline"
              disabled={!queue.data.hasMore || queue.isFetching}
              onClick={() => setPage((value) => value + 1)}
            >
              Trang sự cố sau
            </Button>
          </nav>
          <p className="quiet">
            Danh sách có thể thay đổi khi người khác xử lý. Cập nhật để quay lại trang đầu.
          </p>
        </>
      )}
    </section>
  );
}
