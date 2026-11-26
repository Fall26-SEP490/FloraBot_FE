import KioskFilter from '@/shared/components/KioskFilter';
import { matchesKiosk } from '@/shared/lib/kiosk-filter';
import {
  matchesTaskSearch,
  newestFirst,
  readAllTaskPages,
} from '../task-management/task-list.utils';
import Select from '@/shared/components/Select';
import IncidentOverview from './IncidentOverview';
import styles from './incident-overview.module.css';
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
  const progressLabel = incidentProgressLabel(incident);
  const progressTone =
    incident.status === 'RESOLVED_FIXED'
      ? 'resolved'
      : progressLabel === 'Chờ nghiệm thu'
        ? 'review'
        : progressLabel === 'Đã phân công' || progressLabel === 'Đang xử lý'
          ? 'active'
          : 'pending';
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
        <span className={styles.progress} data-tone={progressTone}>
          <span className={styles.dot} aria-hidden="true" />
          {progressLabel}
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
          className={`admin-monitor-dialog ${styles.dialog}`}
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
                  <IncidentOverview incident={detail.data.incident} />
                  <h3>Ảnh minh chứng</h3>
                  {detail.data.evidence.items.length === 0 ? (
                    <p>Phiếu chưa có ảnh báo sự cố hoặc ảnh công việc được liên kết.</p>
                  ) : (
                    <ul className={styles.photos}>
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
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={styles.photo}
                                  aria-label={`Mở ảnh minh chứng ${photoIndex}`}
                                >
                                  {url.startsWith('/api/') ? (
                                    <img
                                      src={url}
                                      alt={`Ảnh minh chứng ${photoIndex}`}
                                      loading="lazy"
                                      onError={(event) => {
                                        event.currentTarget.hidden = true;
                                      }}
                                    />
                                  ) : (
                                    <span className={styles.external}>Ảnh đính kèm</span>
                                  )}
                                  <span className={styles.photoCaption}>
                                    <strong>Mở ảnh minh chứng {photoIndex}</strong>
                                    {sourceLabel && <span>{sourceLabel.replace(' · ', '')}</span>}
                                  </span>
                                </a>
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
  const [kioskFilter, setKioskFilter] = useState('');
  const queue = useQuery({
    ...liveListOptions(),
    queryKey: ['admin-incidents', status, 'all'],
    queryFn: () =>
      readAllTaskPages((number) =>
        request<Page>(`/admin/incidents?status=${status}&page=${number}`),
      ),
  });
  const matching = newestFirst(
    (queue.data?.items ?? []).map((row) => ({
      ...row,
      updatedAt: row.resolvedAt ?? row.createdAt,
    })),
    status === 'RESOLVED_FIXED',
  ).filter(
    (row) =>
      matchesKiosk(row.kioskId, kioskFilter) &&
      matchesTaskSearch(
        [
          formatIncidentLabel(row),
          row.location?.kioskCode,
          row.reason,
          row.id,
          `SC-${row.id.slice(-6)}`,
          row.task?.assigneeName,
        ],
        search,
      ),
  );
  const currentPage = Math.min(page, Math.max(1, Math.ceil(matching.length / 25)));
  const visible = matching.slice((currentPage - 1) * 25, currentPage * 25);
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
          <Select
            id="incident-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="OPEN">Đang mở</option>
            <option value="RESOLVED_FIXED">Đã xử lý</option>
          </Select>
        </div>
        <div>
          <label htmlFor="admin-incident-search">Tìm sự cố</label>
          <input
            id="admin-incident-search"
            type="search"
            value={search}
            placeholder="Tên kiosk, ô tủ, nội dung hoặc mã sự cố"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <KioskFilter
          items={(queue.data?.items ?? []).map((row) => ({
            id: row.kioskId,
            name: row.location?.kioskName,
            code: row.location?.kioskCode,
          }))}
          value={kioskFilter}
          onChange={(value) => {
            setKioskFilter(value);
            setPage(1);
          }}
        />
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
          <p className="quiet" role="status">
            {matching.length} sự cố
          </p>
          {queue.data.items.length > 0 && matching.length === 0 && (
            <p role="status">Không có sự cố phù hợp.</p>
          )}
          {visible.length > 0 && (
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
                  {visible.map((row) => (
                    <IncidentItem key={row.id} row={row} />
                  ))}
                </tbody>
              </table>
            </WorkspaceTable>
          )}
          <nav className="stock-actions" aria-label="Phân trang sự cố">
            <Button
              variant="outline"
              disabled={currentPage === 1 || queue.isFetching}
              onClick={() => setPage(currentPage - 1)}
            >
              Trang sự cố trước
            </Button>
            <span>Trang {currentPage}</span>
            <Button
              variant="outline"
              disabled={currentPage * 25 >= matching.length || queue.isFetching}
              onClick={() => setPage(currentPage + 1)}
            >
              Trang sự cố sau
            </Button>
          </nav>
        </>
      )}
    </section>
  );
}
