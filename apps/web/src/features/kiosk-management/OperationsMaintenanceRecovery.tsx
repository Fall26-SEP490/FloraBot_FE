import { useCallback, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import type { components } from '../../../../../packages/contracts/src/generated/api';
import { Modal } from '@/shared/components/Modal';
import { ApiError, queryClient, request } from '@/shared/lib/api';
import '../finance/styles/commerce-subscriptions.css';
import './styles/maintenance-recovery.css';

type RecoveryCandidate = components['schemas']['MaintenanceRecoveryCandidate'];

type RecoveryPage = components['schemas']['MaintenanceRecoveryPage'];
type RecoveryRow = components['schemas']['MaintenanceRecoveryRow'];
type RecoveryRequest = components['schemas']['RecoverMaintenanceRequest'];
type RecoveryResult = components['schemas']['MaintenanceRecoveryResult'];

const actions: Record<string, string> = {
  LOAD: 'Nạp hoa',
  REMOVE: 'Thu hồi hoa',
  REPLACE: 'Thay hoa',
};
const slotStatuses: Record<string, string> = {
  STOCKED: 'Có hoa',
  PENDING_REMOVAL: 'Chờ thu hồi hoa',
  RENTED_EMPTY: 'Ô trống',
};
const dateFormat = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Asia/Ho_Chi_Minh',
});

function RecoveryForm({
  row,
  managerId,
  onClose,
  onRecovered,
}: {
  row: RecoveryRow;
  managerId: string;
  onClose: () => void;
  onRecovered: (result: RecoveryResult) => void;
}) {
  const [contents, setContents] = useState('');
  const [doorClosed, setDoorClosed] = useState(false);
  const [reason, setReason] = useState('');
  const candidate = useQuery({
    queryKey: [
      'operations-maintenance-recovery-detail',
      managerId,
      row.kioskId,
      row.slotId,
      row.sessionId,
    ],
    queryFn: () =>
      request<RecoveryCandidate>(
        `/operations/kiosks/${row.kioskId}/slots/${row.slotId}/maintenance-recovery`,
      ),
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const matchesSession =
    candidate.isSuccess &&
    candidate.data.sessionId === row.sessionId &&
    candidate.data.bouquetId === row.bouquetId;

  const recovery = useMutation({
    mutationFn: (input: RecoveryRequest) =>
      request<RecoveryResult>(
        `/operations/kiosks/${row.kioskId}/slots/${row.slotId}/maintenance-recovery/${row.sessionId}`,
        input,
      ),
    onSuccess: onRecovered,
  });
  const uncertain =
    recovery.isError &&
    (!(recovery.error instanceof ApiError) ||
      recovery.error.status >= 500 ||
      recovery.error.status === 404 ||
      recovery.error.status === 409);
  const ready =
    matchesSession &&
    !candidate.isFetching &&
    doorClosed &&
    !!contents &&
    reason.trim().length >= 5 &&
    !recovery.isPending &&
    !uncertain;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) return;
    recovery.mutate({
      confirmedDoorClosed: doorClosed,
      observedContents: contents,
      expectedBouquetId: row.bouquetId ?? null,
      reason: reason.trim(),
    });
  }

  return (
    <Modal
      open
      title={`Kết thúc phiên bảo trì ô ${row.slotCode}`}
      description={`${row.kioskName} · ${row.kioskCode}`}
      onClose={onClose}
      closeDisabled={recovery.isPending}
    >
      <form className="maintenance-recovery-form" onSubmit={submit}>
        {candidate.isPending ? (
          <p role="status">Đang kiểm tra phiên bảo trì hiện tại…</p>
        ) : candidate.isError ? (
          <div role="alert">
            <p>Chưa xác minh được phiên bảo trì: {candidate.error.message}</p>
            <Button type="button" variant="outline" onClick={() => void candidate.refetch()}>
              Tải lại thông tin phiên
            </Button>
          </div>
        ) : !matchesSession ? (
          <p role="alert">
            Phiên hoặc bó hoa đã thay đổi. Quay lại và làm mới danh sách trước khi tiếp tục.
          </p>
        ) : (
          <>
            <dl className="account-details">
              <div>
                <dt>Thao tác</dt>
                <dd>{actions[candidate.data.action] ?? candidate.data.action}</dd>
              </div>
              <div>
                <dt>Tình trạng phiên</dt>
                <dd>
                  {candidate.data.stage === 'NeedsInspection'
                    ? 'Cần kiểm tra tại tủ'
                    : candidate.data.stage}
                </dd>
              </div>
              <div>
                <dt>Mã phiên</dt>
                <dd>{candidate.data.sessionId}</dd>
              </div>
              <div>
                <dt>Mã lệnh mở cửa</dt>
                <dd>{candidate.data.commandId ?? 'Chưa có mã lệnh được ghi nhận'}</dd>
              </div>
            </dl>
            <p>
              Mã lệnh không chứng minh cửa đã mở. Chỉ xác nhận sau khi kiểm tra cửa và hoa thực tế
              tại tủ.
            </p>
          </>
        )}
        <fieldset
          disabled={!matchesSession || candidate.isFetching || recovery.isPending || uncertain}
        >
          <legend>Kết quả kiểm tra tại tủ</legend>
          <label className="maintenance-recovery-confirm">
            <input
              type="checkbox"
              checked={doorClosed}
              disabled={recovery.isPending}
              onChange={(event) => setDoorClosed(event.target.checked)}
              required
            />
            Tôi đã kiểm tra tại tủ và xác nhận cửa ô đang đóng.
          </label>
          <label>
            Tình trạng thực tế trong ô
            <select
              value={contents}
              onChange={(event) => setContents(event.target.value)}
              required
              disabled={recovery.isPending}
            >
              <option value="">Chọn tình trạng hoa</option>
              {row.bouquetId && <option value="ORIGINAL_BOUQUET">Bó hoa cũ vẫn còn trong ô</option>}
              <option value="EMPTY">Ô đã trống</option>
            </select>
          </label>
          <label>
            Ghi chú kiểm tra
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              required
              minLength={5}
              maxLength={500}
              disabled={recovery.isPending}
            />
          </label>
        </fieldset>
        {recovery.isError && (
          <div role="alert">
            <p className="error">
              {recovery.error instanceof ApiError
                ? `HTTP ${recovery.error.status}: ${recovery.error.message}`
                : 'Không nhận được phản hồi xác nhận từ máy chủ. Kiểm tra kết nối.'}
            </p>
            {uncertain && (
              <p>Đóng cửa sổ và làm mới danh sách để kiểm tra phiên trước khi thao tác tiếp.</p>
            )}
          </div>
        )}
        <div className="maintenance-recovery-actions">
          <Button type="button" variant="outline" onClick={onClose} disabled={recovery.isPending}>
            Quay lại
          </Button>
          <Button type="submit" disabled={!ready}>
            {recovery.isPending ? 'Đang cập nhật…' : 'Xác nhận kết thúc phiên'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function OperationsMaintenanceRecovery({ managerId }: { managerId: string }) {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<RecoveryRow>();
  const [notice, setNotice] = useState('');
  const close = useCallback(() => setSelected(undefined), []);
  const queryKey = ['operations-maintenance-recoveries', managerId] as const;
  const recoveries = useQuery({
    queryKey: [...queryKey, page],
    queryFn: () => request<RecoveryPage>(`/operations/maintenance-recoveries?page=${page}`),
  });

  return (
    <section
      className="business-panel maintenance-recovery-panel"
      aria-labelledby="maintenance-recovery-title"
    >
      <div className="business-heading">
        <h2 id="maintenance-recovery-title">Các ô cần kiểm tra</h2>
        <Button
          variant="outline"
          disabled={recoveries.isFetching}
          onClick={() => void recoveries.refetch()}
        >
          Làm mới
        </Button>
      </div>
      {notice && <p role="status">{notice}</p>}
      {recoveries.isPending ? (
        <p role="status">Đang tải phiên bảo trì hết hạn…</p>
      ) : recoveries.isError ? (
        <p role="alert" className="error">
          {recoveries.error.message}
        </p>
      ) : recoveries.data.items.length === 0 ? (
        <p>Không có phiên bảo trì hết hạn trên trang này.</p>
      ) : (
        <ul className="maintenance-recovery-list">
          {recoveries.data.items.map((row) => (
            <li key={row.sessionId}>
              <div>
                <h3>
                  Ô {row.slotCode} · {row.kioskName}
                </h3>
                <p>
                  {row.kioskCode} · {actions[row.action] ?? row.action} · Hết hạn{' '}
                  {dateFormat.format(new Date(row.expiresAt))}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setNotice('');
                  setSelected(row);
                }}
                aria-label={`Kiểm tra ô ${row.slotCode} tại ${row.kioskCode}`}
              >
                Kiểm tra và kết thúc
              </Button>
            </li>
          ))}
        </ul>
      )}
      {(page > 1 || recoveries.data?.hasMore) && (
        <nav className="business-pagination" aria-label="Trang phiên bảo trì">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Trước
          </Button>
          <span>Trang {page}</span>
          <Button
            variant="outline"
            disabled={!recoveries.data?.hasMore}
            onClick={() => setPage(page + 1)}
          >
            Sau
          </Button>
        </nav>
      )}
      {selected && (
        <RecoveryForm
          key={selected.sessionId}
          row={selected}
          managerId={managerId}
          onClose={close}
          onRecovered={(result) => {
            setNotice(
              `Đã kết thúc phiên ô ${selected.slotCode}. Trạng thái mới: ${slotStatuses[result.slotStatus] ?? result.slotStatus}.`,
            );
            close();
            void queryClient.invalidateQueries({ queryKey });
            void queryClient.invalidateQueries({
              queryKey: ['operations-maintenance-recovery-detail', managerId],
            });
          }}
        />
      )}
    </section>
  );
}
