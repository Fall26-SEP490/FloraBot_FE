import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '@/shared/components/Modal';
import photoStyles from '../../product-management/styles/product-detail.module.css';
import Image from 'next/image';
import '../styles/staff-evidence.css';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { ApiError, queryClient, request } from '@/shared/lib/api';
import EvidenceUpload from '../../../shared/components/EvidenceUpload';
import type {
  StaffEvidenceProps,
  TaskEvidenceAttempt,
  TaskEvidencePage,
} from '../task-management.types';
import {
  formatTaskDate,
  getEvidenceStorageKey,
  restoreEvidenceAttempt,
} from '../task-management.utils';

export type { StaffEvidenceProps };

export default function StaffEvidence({
  taskId,
  version,
  admin = false,
  actorId,
  sellerId,
  active,
  taskStatus,
  apiBase: explicitApiBase,
  mode,
  role,
}: StaffEvidenceProps & { taskStatus?: string }) {
  const isWorker = mode !== undefined ? mode === 'worker' : !admin;
  const path = explicitApiBase
    ? `${explicitApiBase}/${taskId}/evidence`
    : `${admin ? '/admin/staff-tasks' : '/staff/tasks'}/${taskId}/evidence`;
  const scopeKey = sellerId
    ? `seller:${sellerId}`
    : (explicitApiBase ?? (admin ? '/admin/staff-tasks' : '/staff/tasks'));
  const key = getEvidenceStorageKey(actorId, scopeKey, taskId);
  const [attempt, setAttempt] = useState<TaskEvidenceAttempt | null>(() =>
    !isWorker ? null : restoreEvidenceAttempt(key),
  );
  const [reference, setReference] = useState('');
  const [open, setOpen] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [uploadKey, setUploadKey] = useState(0);
  const evidence = useQuery({
    queryKey: ['staff-evidence', taskId, actorId ?? 'none', scopeKey, version, page],
    queryFn: () => request<TaskEvidencePage>(`${path}?page=${page}`),
    enabled: open,
    refetchInterval: open ? 30_000 : false,
  });
  function clearAttempt() {
    sessionStorage.removeItem(key);
    setAttempt(null);
    setReference('');
    setUploadKey((value) => value + 1);
  }
  async function send(payload: TaskEvidenceAttempt, recover: boolean) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    let persisted = false;
    try {
      sessionStorage.setItem(key, JSON.stringify(payload));
      persisted = true;
      setAttempt(payload);
      const existing = recover
        ? await request<TaskEvidencePage>(`${path}?attachmentId=${encodeURIComponent(payload.id)}`)
        : null;
      if (!existing?.items.some((item) => item.id === payload.id)) await request(path, payload);
      clearAttempt();
      setPage(1);
      setNotice('Đã gắn ảnh vào công việc.');
      await queryClient.invalidateQueries({ queryKey: ['staff-evidence', taskId] });
      await queryClient.invalidateQueries({ queryKey: ['staff-detail', taskId] });
    } catch (cause) {
      if (cause instanceof ApiError && [400, 409].includes(cause.status)) {
        // Check the saved ID before discarding an expired ticket after a lost response.
        try {
          const saved = await request<TaskEvidencePage>(
            `${path}?attachmentId=${encodeURIComponent(payload.id)}`,
          );
          const found = saved.items.some((item) => item.id === payload.id);
          clearAttempt();
          if (found) {
            setNotice('Đã tìm thấy ảnh được lưu trước đó.');
            await queryClient.invalidateQueries({ queryKey: ['staff-evidence', taskId] });
          } else setError(`${cause.message} Chọn và tải lại ảnh sau khi cập nhật công việc.`);
        } catch {
          setError('Chưa kiểm tra được ảnh đã lưu. Giữ nguyên thao tác và thử kiểm tra lại.');
        }
      } else
        setError(
          !persisted
            ? 'Chưa gửi ảnh vì trình duyệt không lưu được mã thao tác. Cho phép lưu trữ phiên rồi thử lại.'
            : 'Chưa xác nhận được ảnh đã gắn. Kiểm tra kết quả trước khi gửi ảnh khác; nếu phiên hết hạn, đăng nhập lại.',
        );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details
      className="staff-evidence"
      data-seller-evidence={role === 'SELLER' ? '' : undefined}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Ảnh minh chứng công việc</summary>

      {evidence.isPending ? (
        <p role="status">Đang tải danh sách ảnh…</p>
      ) : evidence.isError ? (
        <>
          <p role="alert">
            Chưa tải được ảnh. Công việc có thể đã bàn giao hoặc kết nối bị gián đoạn.
          </p>
          <Button onClick={() => void evidence.refetch()}>Thử tải lại ảnh</Button>
        </>
      ) : (
        <>
          {evidence.data.items.length === 0 ? (
            <p>Chưa có ảnh minh chứng ở trang này.</p>
          ) : (
            <ol className="staff-evidence-grid">
              {evidence.data.items.map((item, index) => (
                <li key={item.id}>
                  {role === 'SELLER' ? (
                    <button
                      type="button"
                      className="task-evidence-photo"
                      onClick={() => setViewerId(item.id)}
                      aria-label={`Xem lớn ảnh minh chứng ${(page - 1) * 25 + index + 1}`}
                    >
                      <Image
                        src={`/api${path}/${item.id}`}
                        alt={`Ảnh minh chứng ${(page - 1) * 25 + index + 1}`}
                        width={240}
                        height={180}
                        unoptimized
                        loading="lazy"
                      />
                      <span className="task-evidence-zoom">Xem lớn</span>
                    </button>
                  ) : (
                    <>
                      <a href={`/api${path}/${item.id}`} target="_blank" rel="noopener noreferrer">
                        <span className="staff-evidence-preview">
                          <Image
                            src={`/api${path}/${item.id}`}
                            alt={`Ảnh minh chứng ${(page - 1) * 25 + index + 1}`}
                            width={240}
                            height={160}
                            unoptimized
                            loading="lazy"
                          />
                        </span>
                        Xem ảnh {(page - 1) * 25 + index + 1} (mở tab mới)
                      </a>
                      {' · '}
                    </>
                  )}
                  <time dateTime={item.createdAt}>{formatTaskDate(item.createdAt)}</time>
                </li>
              ))}
            </ol>
          )}
          {viewerId &&
            evidence.data.items.some((item) => item.id === viewerId) &&
            createPortal(
              <Modal
                open
                title="Ảnh minh chứng công việc"
                size="lg"
                className={photoStyles.photoModal}
                onClose={() => setViewerId(null)}
              >
                <div className="task-evidence-lightbox">
                  <Image
                    src={`/api${path}/${viewerId}`}
                    alt="Ảnh minh chứng công việc"
                    width={1200}
                    height={900}
                    unoptimized
                  />
                  {evidence.data.items.length > 1 && (
                    <div className="task-evidence-nav">
                      <Button
                        variant="outline"
                        disabled={viewerId === evidence.data.items[0]?.id}
                        onClick={() =>
                          setViewerId(
                            evidence.data.items[
                              evidence.data.items.findIndex((item) => item.id === viewerId) - 1
                            ]?.id ?? viewerId,
                          )
                        }
                      >
                        Ảnh trước
                      </Button>
                      <Button
                        variant="outline"
                        disabled={viewerId === evidence.data.items.at(-1)?.id}
                        onClick={() =>
                          setViewerId(
                            evidence.data.items[
                              evidence.data.items.findIndex((item) => item.id === viewerId) + 1
                            ]?.id ?? viewerId,
                          )
                        }
                      >
                        Ảnh sau
                      </Button>
                    </div>
                  )}
                </div>
              </Modal>,
              document.body,
            )}
          <div className="staff-history-pagination" aria-label="Phân trang ảnh minh chứng">
            {(page > 1 || evidence.data.hasMore) && (
              <>
                <Button
                  variant="outline"
                  disabled={page === 1 || evidence.isFetching}
                  onClick={() => setPage(page - 1)}
                >
                  Ảnh trang trước
                </Button>
                <span>Trang {page}</span>
                <Button
                  variant="outline"
                  disabled={!evidence.data.hasMore || evidence.isFetching}
                  onClick={() => setPage(page + 1)}
                >
                  Ảnh trang tiếp
                </Button>
              </>
            )}
          </div>
        </>
      )}
      {isWorker &&
        actorId &&
        (attempt ? (
          <>
            <p>Có một ảnh đang chờ xác nhận. Kiểm tra ảnh này trước khi gửi ảnh tiếp theo.</p>
            <Button disabled={busy} onClick={() => void send(attempt, true)}>
              {busy ? 'Đang kiểm tra…' : 'Kiểm tra kết quả gửi ảnh'}
            </Button>
          </>
        ) : active ? (
          <>
            <p className="staff-evidence-instruction">
              Tải ảnh → <strong>Gắn ảnh vào công việc</strong>.
            </p>
            <EvidenceUpload
              key={`${version}:${uploadKey}`}
              id={`task-evidence-${taskId}`}
              endpoint={`/api${path}/upload`}
              disabled={busy}
              onReference={setReference}
            />
            {reference && <p role="status">Ảnh đã tải lên, chưa gắn vào công việc.</p>}
            <Button
              disabled={busy || !reference}
              onClick={() => void send({ id: crypto.randomUUID(), version, reference }, false)}
            >
              Gắn ảnh vào công việc
            </Button>
          </>
        ) : (
          <p>
            {taskStatus === 'SUBMITTED' || taskStatus === 'COMPLETED' || taskStatus === 'CANCELLED'
              ? 'Đã kết thúc bước thực hiện.'
              : 'Bắt đầu công việc để gửi ảnh.'}
          </p>
        ))}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
