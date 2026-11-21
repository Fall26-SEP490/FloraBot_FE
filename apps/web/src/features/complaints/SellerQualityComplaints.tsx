'use client';

import SellerPagination from '@/shared/components/SellerPagination';
import RefreshRegion from '@/shared/components/RefreshRegion';
import IconActionButton from '@/shared/components/IconActionButton';
import { useId, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Button, Search } from '@florabot/ui';
import Select from '@/shared/components/Select';
import SidePanel from '@/shared/components/SidePanel';
import { queryClient, request } from '@/shared/lib/api';
import { displayVietnamDate, vietnamDateTime } from '@/shared/lib/vietnam-date';
import QualityComplaintDetails from './QualityComplaintDetails';
import { type QualityComplaint, type QualitySchema } from './quality-complaints.api';
import styles from './seller-quality-complaints.module.css';

const states: Record<string, string> = {
  REPORTED: 'Chờ tiếp nhận',
  ACCEPTED: 'Đã tiếp nhận',
  IN_PROGRESS: 'Đang kiểm tra',
  REVIEW_REQUIRED: 'Chờ duyệt báo cáo',
  REPLACEMENT_READY: 'Sẵn sàng nhận hoa thay',
  ATTENTION_REQUIRED: 'Cần xử lý tiếp',
  REFUND_REVIEW: 'Chờ xét hoàn tiền',
  RESOLVED: 'Đã xử lý',
};
const date = (value: string) => displayVietnamDate(vietnamDateTime(value), true);
type RenderActions = (
  detail: QualityComplaint,
  reload: () => Promise<unknown>,
  stale: boolean,
  onBusy: (busy: boolean) => void,
) => ReactNode;

function ComplaintPanel({
  row,
  sellerId,
  onClose,
  renderActions,
}: {
  row: QualityComplaint;
  sellerId: string;
  onClose: () => void;
  renderActions: RenderActions;
}) {
  const [evidencePage, setEvidencePage] = useState(1);
  const [busy, setBusy] = useState(false);
  const detail = useQuery({
    queryKey: ['quality-complaint', '/me/complaints', sellerId, row.id, evidencePage],
    queryFn: () =>
      request<QualityComplaint>(`/me/complaints/${row.id}?evidencePage=${evidencePage}`),
  });
  async function reload() {
    const fresh = await detail.refetch({ throwOnError: true });
    await queryClient.invalidateQueries({ queryKey: ['quality-queue', '/me/complaints'] });
    if (!fresh.data) throw new Error('Missing complaint');
  }
  const data = detail.data;
  const current = data ?? row;
  return (
    <SidePanel title={`Đơn ${row.orderCode}`} onClose={onClose} closeDisabled={busy}>
      <div className={styles.panelBody}>
        <div className={styles.meta}>
          <span className={styles.badge} data-state={current.handlingState}>
            {states[current.handlingState] || current.handlingState}
          </span>
          <span>Gửi {date(row.createdAt)}</span>
        </div>
        {detail.isError && (
          <div className={styles.error} role="alert">
            <p>Chưa cập nhật được hồ sơ. Tải lại trước khi thao tác.</p>
            <Button variant="outline" disabled={detail.isFetching} onClick={() => detail.refetch()}>
              Thử lại
            </Button>
          </div>
        )}
        {!data ? (
          !detail.isError && <p role="status">Đang tải phản ánh…</p>
        ) : (
          <>
            <QualityComplaintDetails
              detail={data}
              scope="seller"
              onPage={setEvidencePage}
              actions={renderActions(data, reload, detail.isError || detail.isFetching, setBusy)}
            />
          </>
        )}
      </div>
    </SidePanel>
  );
}

export default function SellerQualityComplaints({
  sellerId,
  renderActions,
}: {
  sellerId: string;
  renderActions: RenderActions;
}) {
  const searchId = useId();
  const stateId = useId();
  const [page, setPage] = useState(1);
  const [state, setState] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<QualityComplaint | null>(null);
  const queue = useQuery({
    queryKey: ['quality-queue', '/me/complaints', sellerId, state, page],
    queryFn: () =>
      request<QualitySchema['QualityComplaintPage']>(
        `/me/complaints?${new URLSearchParams({ page: String(page), ...(state && { state }) })}`,
      ),
  });
  const needle = search.trim().toLocaleLowerCase('vi');
  const rows = (queue.data?.items ?? []).filter(
    (row) =>
      !needle ||
      [row.orderCode, row.reason, ...row.items.map((item) => item.name)]
        .join(' ')
        .toLocaleLowerCase('vi')
        .includes(needle),
  );
  return (
    <div className={styles.sellerQueue} role="region" aria-label="Hồ sơ chất lượng hoa">
      <RefreshRegion>
        <div className={styles.surface}>
          <div className={styles.filters}>
            <label htmlFor={searchId} className={styles.searchField}>
              <span>Tìm phản ánh</span>
              <span className={styles.searchInput}>
                <Search size={18} aria-hidden="true" />
                <input
                  id={searchId}
                  type="search"
                  placeholder="Mã đơn, nội dung hoặc tên hoa"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </span>
            </label>
            <label htmlFor={stateId} className={styles.stateField}>
              <span>Trạng thái</span>
              <Select
                id={stateId}
                value={state}
                onChange={(event) => {
                  setState(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">Tất cả</option>
                {Object.entries(states).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </label>
            {(state || search) && (
              <IconActionButton
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setState('');
                  setPage(1);
                }}
                action="clear"
                label="Xóa bộ lọc"
              />
            )}
            <IconActionButton
              action="reload"
              label="Tải lại phản ánh"
              disabled={queue.isFetching}
              onClick={() => queue.refetch()}
            />
          </div>
          {needle && (page > 1 || queue.data?.hasMore) && (
            <p className={styles.scopeHint}>
              Tìm trong trang hiện tại. Chuyển trang để xem thêm phản ánh.
            </p>
          )}
          {queue.isError && (
            <div className={styles.error} role="alert">
              <p>Chưa tải được danh sách phản ánh.</p>
              <Button variant="outline" disabled={queue.isFetching} onClick={() => queue.refetch()}>
                Thử lại
              </Button>
            </div>
          )}
          <div className={styles.columns} aria-hidden="true">
            <span>Mã đơn</span>
            <span>Nội dung phản ánh</span>
            <span>Hoa trong đơn</span>
            <span>Ngày gửi</span>
            <span>Trạng thái</span>
            <span />
          </div>
          {queue.isPending ? (
            <p className={styles.empty} role="status">
              Đang tải phản ánh…
            </p>
          ) : !queue.isError && !rows.length ? (
            <div className={styles.empty} role="status">
              <strong>
                {needle
                  ? 'Không tìm thấy phản ánh phù hợp'
                  : state
                    ? 'Chưa có phản ánh ở trạng thái này'
                    : 'Chưa có phản ánh chất lượng'}
              </strong>
              <p>
                {needle || state
                  ? 'Thử đổi hoặc xóa bộ lọc.'
                  : 'Phản ánh của khách sẽ hiển thị tại đây.'}
              </p>
            </div>
          ) : (
            <ul className={styles.records}>
              {rows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className={styles.record}
                    aria-label={`Xem phản ánh đơn ${row.orderCode}`}
                    onClick={() => setSelected(row)}
                  >
                    <span className={styles.orderCode}>{row.orderCode}</span>
                    <span className={styles.reason}>{row.reason}</span>
                    <span
                      className={styles.flowers}
                      title={row.items.map((item) => item.name).join(', ')}
                    >
                      {row.items.map((item) => item.name).join(', ') || '—'}
                    </span>
                    <span className={styles.created}>{date(row.createdAt)}</span>
                    <span className={styles.state}>
                      <span className={styles.badge} data-state={row.handlingState}>
                        {states[row.handlingState] || row.handlingState}
                      </span>
                    </span>
                    <span className={styles.openIcon}>
                      <ArrowRight size={16} aria-hidden="true" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {(page > 1 || queue.data?.hasMore) && (
            <SellerPagination
              ariaLabel="Phân trang phản ánh"
              page={page}
              hasMore={queue.data?.hasMore}
              busy={queue.isFetching}
              onPageChange={setPage}
            />
          )}
        </div>
      </RefreshRegion>
      {selected && (
        <ComplaintPanel
          key={selected.id}
          row={selected}
          sellerId={sellerId}
          onClose={() => setSelected(null)}
          renderActions={renderActions}
        />
      )}
    </div>
  );
}
