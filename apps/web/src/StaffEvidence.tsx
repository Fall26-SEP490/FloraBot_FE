import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { ApiError, queryClient, request } from './api';
import EvidenceUpload from './EvidenceUpload';

import type { ActiveTaskRole } from './StaffTasks';

type Attempt = { id: string; version: number; reference: string };
type EvidencePage = { items: { id: string; createdAt: string }[]; page: number; hasMore: boolean };
function restore(key: string): Attempt | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || 'null') as Attempt | null;
    return value &&
      typeof value.id === 'string' &&
      Number.isInteger(value.version) &&
      typeof value.reference === 'string' &&
      value.reference.startsWith('evidence:v1:')
      ? value
      : null;
  } catch {
    return null;
  }
}

export type StaffEvidenceProps = {
  taskId: string;
  version: number;
  admin?: boolean;
  actorId?: string;
  sellerId?: string | null;
  role?: ActiveTaskRole;
  active: boolean;
  apiBase?: string;
  mode?: 'worker' | 'manager' | 'oversight';
};

export default function StaffEvidence({
  taskId,
  version,
  admin = false,
  actorId,
  sellerId,
  active,
  apiBase: explicitApiBase,
  mode,
}: StaffEvidenceProps) {
  const isWorker = mode !== undefined ? mode === 'worker' : !admin;
  const path = explicitApiBase
    ? `${explicitApiBase}/${taskId}/evidence`
    : `${admin ? '/admin/staff-tasks' : '/staff/tasks'}/${taskId}/evidence`;
  const scopeKey = sellerId
    ? `seller:${sellerId}`
    : (explicitApiBase ?? (admin ? '/admin/staff-tasks' : '/staff/tasks'));
  const key = `florabot-staff-evidence:${actorId ?? 'none'}:${scopeKey}:${taskId}`;
  const [attempt, setAttempt] = useState<Attempt | null>(() => (!isWorker ? null : restore(key)));
  const [reference, setReference] = useState('');
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [uploadKey, setUploadKey] = useState(0);
  const evidence = useQuery({
    queryKey: ['staff-evidence', taskId, actorId ?? 'none', scopeKey, version, page],
    queryFn: () => request<EvidencePage>(`${path}?page=${page}`),
    enabled: open,
  });
  function clearAttempt() {
    sessionStorage.removeItem(key);
    setAttempt(null);
    setReference('');
    setUploadKey((value) => value + 1);
  }
  async function send(payload: Attempt, recover: boolean) {
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
        ? await request<EvidencePage>(`${path}?attachmentId=${encodeURIComponent(payload.id)}`)
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
          const saved = await request<EvidencePage>(
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
    <details className="staff-evidence" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Ảnh minh chứng công việc</summary>
      <p>Ảnh chỉ dành cho người phụ trách công việc và quản trị viên.</p>
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
            <ol>
              {evidence.data.items.map((item, index) => (
                <li key={item.id}>
                  <a href={`/api${path}/${item.id}`} target="_blank" rel="noopener noreferrer">
                    Xem ảnh {(page - 1) * 25 + index + 1} (mở tab mới)
                  </a>
                  {' · '}
                  <time dateTime={item.createdAt}>
                    {new Date(item.createdAt).toLocaleString('vi-VN')}
                  </time>
                </li>
              ))}
            </ol>
          )}
          <div className="staff-history-pagination" aria-label="Phân trang ảnh minh chứng">
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
            <Button
              variant="outline"
              disabled={evidence.isFetching}
              onClick={() => void evidence.refetch()}
            >
              Cập nhật ảnh
            </Button>
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
            <EvidenceUpload
              key={`${version}:${uploadKey}`}
              id={`task-evidence-${taskId}`}
              endpoint={`/api${path}/upload`}
              disabled={busy}
              onReference={setReference}
            />
            <Button
              disabled={busy || !reference}
              onClick={() => void send({ id: crypto.randomUUID(), version, reference }, false)}
            >
              Gắn ảnh vào công việc
            </Button>
          </>
        ) : (
          <p>Bắt đầu công việc để gửi ảnh. Ảnh đã lưu vẫn xem được sau khi gửi báo cáo.</p>
        ))}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
