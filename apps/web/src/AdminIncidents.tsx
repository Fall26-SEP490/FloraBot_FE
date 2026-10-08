import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@florabot/ui';
import type { components } from '../../../packages/contracts/src/generated/api';
import { ApiError, queryClient, request } from './api';

type Incident = components['schemas']['AdminIncidentResponse'];
type Detail = components['schemas']['AdminIncidentDetail'];
type Page = components['schemas']['AdminIncidentPage'];
const schema = z.object({
  note: z
    .string()
    .trim()
    .min(5, 'Ghi kết quả kiểm tra ít nhất 5 ký tự.')
    .max(2000, 'Ghi chú tối đa 2.000 ký tự.'),
});
const date = (value: string) =>
  new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
const label = (row: Incident) =>
  `${row.location?.kioskName || row.kioskId}${row.slot ? ` · Ô ${row.slot.slotCode}` : ' · Toàn kiosk'}`;
const safeUrl = (value: string) => {
  try {
    if (/^\/api\/admin\/evidence\/[0-9a-f-]{36}$/.test(value)) return value;
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
};

function IncidentItem({ row, onNotice }: { row: Incident; onNotice: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState<string | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const sending = useRef(false);
  const detail = useQuery({
    queryKey: ['admin-incident', row.id],
    queryFn: () => request<Detail>(`/admin/incidents/${row.id}`),
    enabled: open,
  });
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { note: '' },
  });
  useEffect(() => {
    if (review !== null) confirmRef.current?.focus();
  }, [review]);
  const resolve = useMutation({
    mutationFn: (note: string) =>
      request('/admin/flows/resolve_device_fault', {
        p_dispute: row.id,
        p_note: note,
      } satisfies components['schemas']['ResolveDeviceFaultRequest']),
    onSuccess: () => {
      form.reset();
      setReview(null);
      onNotice(`Đã ghi nhận xử lý sự cố tại ${label(row)}.`);
    },
    onError: (error) => {
      setReview(null);
      if (!(error instanceof ApiError) || error.status >= 500)
        onNotice(
          'Chưa xác nhận được kết quả xử lý. Danh sách đang được cập nhật; hãy kiểm tra mục đã xử lý trước khi gửi lại.',
        );
    },
    onSettled: async () => {
      sending.current = false;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-incidents'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-incident', row.id] }),
        queryClient.invalidateQueries({ queryKey: ['admin-slots'] }),
      ]);
    },
  });
  const confirm = () => {
    // Background reads must not cancel a pointer press; the flow checks current state atomically.
    if (
      sending.current ||
      review === null ||
      detail.isError ||
      detail.data?.incident.status !== 'OPEN'
    )
      return;
    sending.current = true;
    resolve.mutate(review);
  };
  return (
    <li>
      <details onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary>
          <strong>{label(row)}</strong>
          <span>
            {row.kind === 'DISPENSE_FAILED' ? 'Không giao được hoa' : 'Sự cố thiết bị'} ·{' '}
            {date(row.createdAt)}
          </span>
        </summary>
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
                      return (
                        <li key={photo.id}>
                          {url ? (
                            <a href={url} target="_blank" rel="noopener noreferrer">
                              Mở ảnh minh chứng {index + 1}
                            </a>
                          ) : (
                            <span>Ảnh {index + 1}: đường dẫn không hợp lệ để mở an toàn.</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {detail.data.evidence.hasMore && (
                  <p>
                    Đang hiển thị 20 ảnh đầu tiên. Còn ảnh khác trong hồ sơ, cần đối chiếu đầy đủ
                    trước khi kết luận.
                  </p>
                )}
                {detail.data.incident.status === 'OPEN' ? (
                  <form noValidate onSubmit={form.handleSubmit((values) => setReview(values.note))}>
                    <h3>Ghi nhận kết quả xử lý</h3>
                    <p>
                      Chỉ đóng sự cố sau khi kiểm tra thực tế. Hệ thống tự xác định trạng thái ô phù
                      hợp; thao tác này không mở cửa và không chuyển tiền.
                    </p>
                    {row.kind === 'DISPENSE_FAILED' && (
                      <p className="quiet">
                        Sự cố giao hoa có khoản hoàn chờ chi phải được hoàn tiền trước khi đóng.
                      </p>
                    )}
                    <div hidden={review !== null}>
                      <label htmlFor={`incident-note-${row.id}`}>Kết quả kiểm tra và xử lý</label>
                      <textarea
                        id={`incident-note-${row.id}`}
                        rows={3}
                        maxLength={2000}
                        {...form.register('note')}
                        disabled={resolve.isPending}
                        aria-invalid={!!form.formState.errors.note}
                        aria-describedby={`incident-error-${row.id}`}
                      />
                      <p id={`incident-error-${row.id}`} className="error">
                        {form.formState.errors.note?.message}
                      </p>
                    </div>
                    {review !== null && (
                      <>
                        <p>
                          <strong>Xác nhận đã kiểm tra và xử lý tại {label(row)}?</strong>
                        </p>
                        <p className="incident-text">{review}</p>
                      </>
                    )}
                    <div className="stock-actions">
                      {review === null ? (
                        <Button type="submit" disabled={resolve.isPending}>
                          Kiểm tra kết quả xử lý
                        </Button>
                      ) : (
                        <>
                          <Button
                            ref={confirmRef}
                            type="button"
                            onClick={confirm}
                            disabled={resolve.isPending}
                          >
                            {resolve.isPending ? 'Đang ghi nhận…' : 'Xác nhận đóng sự cố'}
                          </Button>
                          <Button
                            variant="outline"
                            disabled={resolve.isPending}
                            onClick={() => {
                              setReview(null);
                              requestAnimationFrame(() => form.setFocus('note'));
                            }}
                          >
                            Sửa ghi chú
                          </Button>
                        </>
                      )}
                    </div>
                  </form>
                ) : (
                  <>
                    <h3>Đã xử lý</h3>
                    <p className="incident-text">
                      {detail.data.incident.decision || 'Chưa có ghi chú.'}
                    </p>
                    {detail.data.incident.resolvedAt && (
                      <p>{date(detail.data.incident.resolvedAt)}</p>
                    )}
                  </>
                )}
                {resolve.isError && (
                  <p role="alert" className="error">
                    {resolve.error instanceof ApiError
                      ? resolve.error.message
                      : 'Kết nối bị gián đoạn. Kiểm tra trạng thái cập nhật trước khi thử lại.'}
                  </p>
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
  const [notice, setNotice] = useState('');
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const queue = useQuery({
    queryKey: ['admin-incidents', status, page],
    queryFn: () => request<Page>(`/admin/incidents?status=${status}&page=${page}`),
  });
  return (
    <section className="admin-incidents" aria-labelledby="incidents-title">
      <h2 id="incidents-title">Theo dõi sự cố tủ hoa</h2>
      <p>Ưu tiên các báo cáo đang mở để hoa sớm được bán trở lại. Mỗi trang có tối đa 25 sự cố.</p>
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
      <div className="stock-actions">
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
      </div>
      <p role="status" tabIndex={-1} ref={noticeRef}>
        {notice}
      </p>
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
              <IncidentItem
                key={row.id}
                row={row}
                onNotice={(message) => {
                  setNotice(message);
                  requestAnimationFrame(() => noticeRef.current?.focus());
                }}
              />
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
