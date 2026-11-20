import { liveListOptions } from '@/shared/lib/live-list';
import WorkspaceTable from '@/features/portal/components/WorkspaceTable';
import { Modal } from '@/shared/components/Modal';
import { AdminFilterBar } from '@/features/portal/components/AdminUi';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { queryClient, request } from '@/shared/lib/api';
import type {
  AdminIncidentDetail,
  AdminIncidentPage,
  AdminIncidentResponse,
} from './incidents.types';
import {
  formatIncidentDate,
  formatIncidentLabel,
  safeUrl,
  incidentProgressLabel,
} from './incidents.utils';

type Incident = AdminIncidentResponse;
type Detail = AdminIncidentDetail;
type Page = AdminIncidentPage;

function IncidentItem({ row, hidden = false }: { row: Incident; hidden?: boolean }) {
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
  const incident = detail.data?.incident ?? row;
  return (
    <tr hidden={hidden}>
      <td>
        <time dateTime={row.createdAt}>{formatIncidentDate(row.createdAt)}</time>
      </td>
      <td>
        <strong>{formatIncidentLabel(row)}</strong>
        <span className="table-secondary">
          {row.kind === 'DISPENSE_FAILED' ? 'Không giao được hoa' : 'Sự cố thiết bị'}
        </span>
      </td>
      <td>
        <span className="table-truncate" title={row.reason}>
          {row.reason}
        </span>
      </td>
      <td>
        <span className="table-badge" data-state={incident.status}>
          {incidentProgressLabel(incident)}
        </span>
      </td>
      <td>
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(true)}
          aria-label={`Xem sự cố ${row.id}`}
        >
          Xem
        </Button>
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title={formatIncidentLabel(row)}
          size="lg"
          className="admin-monitor-dialog"
        >
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
                  {detail.data.incident.task && (
                    <p>
                      Người phụ trách: <strong>{detail.data.incident.task.assigneeName}</strong> ·{' '}
                      {incidentProgressLabel(detail.data.incident)}
                      <br />
                      Mã công việc: {detail.data.incident.task.id}
                    </p>
                  )}
                  <h3>Ảnh minh chứng</h3>
                  {detail.data.evidence.items.length > 0 && (
                    <p className="quiet">
                      Gồm ảnh báo sự cố và ảnh công việc đã liên kết. Chọn ảnh để mở ở tab mới.
                    </p>
                  )}
                  {detail.data.evidence.items.length === 0 ? (
                    <p>Phiếu chưa có ảnh báo sự cố hoặc ảnh công việc được liên kết.</p>
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
                    <p className="quiet">Phiếu đang được Quản lý vận hành xử lý.</p>
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
        </Modal>
      </td>
    </tr>
  );
}

export default function AdminIncidents() {
  const [status, setStatus] = useState('OPEN');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const normalizeSearch = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]/g, '');
  const matches = (row: Incident) =>
    normalizeSearch(`${formatIncidentLabel(row)} ${row.reason} ${row.id}`).includes(
      normalizeSearch(search.trim()),
    );
  const queue = useQuery({
    ...liveListOptions(),
    queryKey: ['admin-incidents', status, page],
    queryFn: () => request<Page>(`/admin/incidents?status=${status}&page=${page}`),
  });
  return (
    <section className="admin-incidents" aria-labelledby="incidents-title">
      <h2 id="incidents-title">Theo dõi sự cố tủ hoa</h2>
      <AdminFilterBar
        actions={
          queue.isError ? (
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
          ) : undefined
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
        <div>
          <label htmlFor="admin-incident-search">Tìm sự cố trong trang</label>
          <input
            id="admin-incident-search"
            type="search"
            value={search}
            placeholder="Tên kiosk, ô tủ, nội dung hoặc mã sự cố"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </AdminFilterBar>
      {queue.isPending ? (
        <p role="status">Đang tải danh sách sự cố…</p>
      ) : queue.isError ? (
        <p role="alert" className="error">
          Chưa tải được sự cố. Hệ thống sẽ tự thử lại.
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
          {queue.data.items.length > 0 && (
            <p className="quiet" role="status">
              {queue.data.items.filter(matches).length} / {queue.data.items.length} sự cố trong
              trang {page}
              {queue.data.hasMore ? ' · Còn trang tiếp theo' : ''}
            </p>
          )}
          {search && queue.data.items.length > 0 && !queue.data.items.some(matches) && (
            <p role="status">
              Không có sự cố khớp tìm kiếm trong trang này. Xóa nội dung tìm kiếm hoặc chuyển trang
              để xem thêm.
            </p>
          )}
          {queue.data.items.some(matches) && (
            <WorkspaceTable label="Giám sát sự cố tủ">
              <table className="admin-monitor-table">
                <thead>
                  <tr>
                    <th scope="col">Thời gian</th>
                    <th scope="col">Kiosk / Ô tủ</th>
                    <th scope="col">Sự cố</th>
                    <th scope="col">Tiến độ</th>
                    <th scope="col">Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.data.items.map((row) => (
                    <IncidentItem key={row.id} row={row} hidden={!matches(row)} />
                  ))}
                </tbody>
              </table>
            </WorkspaceTable>
          )}
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
        </>
      )}
    </section>
  );
}
