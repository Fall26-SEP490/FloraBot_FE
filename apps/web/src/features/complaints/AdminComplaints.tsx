import { AdminFilterBar, AdminDisclosureSummary } from '@/features/portal/components/AdminUi';
import { useLayoutEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@florabot/ui';
import { ApiError, queryClient, request } from '@/shared/lib/api';
import type {
  AdminComplaintDetail,
  AdminComplaintPage,
  AdminComplaintResponse,
  ResolveDisputeRequest,
} from './complaints.types';
import { formatComplaintDate, formatComplaintMoney, safeUrl } from './complaints.utils';

type Row = AdminComplaintResponse;
type Detail = AdminComplaintDetail;
type Queue = AdminComplaintPage;

const schema = z.object({
  amount: z
    .string()
    .regex(/^\d+$/, 'Nhập số tiền nguyên, không có dấu phân cách.')
    .refine((value) => Number.isSafeInteger(Number(value)), 'Số tiền không hợp lệ.'),
  decision: z
    .string()
    .trim()
    .min(5, 'Ghi lý do xử lý từ 5 ký tự.')
    .max(2000, 'Lý do tối đa 2.000 ký tự.'),
});
type Fields = z.infer<typeof schema>;

function Complaint({ row, onSaved }: { row: Row; onSaved: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState<Fields | null>(null);
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState('');
  const sending = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const editingFocus = useRef(false);
  const detail = useQuery({
    queryKey: ['admin-complaint', row.id],
    queryFn: () => request<Detail>(`/admin/complaints/${row.id}`),
    enabled: open,
  });
  const form = useForm<Fields>({
    resolver: zodResolver(schema),
    defaultValues: { amount: '', decision: '' },
  });
  useLayoutEffect(() => {
    if (review) heading.current?.focus();
    else if (editingFocus.current) {
      form.setFocus('amount');
      editingFocus.current = false;
    }
  }, [review, form]);
  async function confirm() {
    if (
      sending.current ||
      uncertain ||
      !review ||
      detail.isError ||
      detail.data?.complaint.status !== 'OPEN'
    )
      return;
    sending.current = true;
    setSaving(true);
    setError('');
    try {
      await request('/admin/flows/resolve_dispute', {
        p_dispute: row.id,
        p_refund: Number(review.amount),
        p_decision: review.decision,
      } satisfies ResolveDisputeRequest);
      onSaved(`Đã ghi nhận quyết định cho đơn ${row.orderCode}.`);
      form.reset();
      setReview(null);
    } catch (cause) {
      setReview(null);
      if (!(cause instanceof ApiError) || cause.status >= 500) {
        setUncertain(true);
        setError(
          'Chưa xác nhận được kết quả. Hãy tải lại hồ sơ để kiểm tra quyết định trước khi gửi tiếp.',
        );
      } else setError(cause.message);
    } finally {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-complaints'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-complaint', row.id] }),
      ]);
      sending.current = false;
      setSaving(false);
    }
  }
  return (
    <li>
      <details onToggle={(event) => setOpen(event.currentTarget.open)}>
        <AdminDisclosureSummary
          statusCode={row.status}
          title={`Đơn ${row.orderCode}`}
          meta={formatComplaintDate(row.createdAt)}
          status={formatComplaintMoney(row.orderTotal)}
        />
        {open && (
          <div className="incident-detail">
            {detail.isPending ? (
              <p role="status">Đang tải hồ sơ phản ánh…</p>
            ) : detail.isError ? (
              <p role="alert" className="error">
                Chưa tải được hồ sơ. Chọn tải lại để tiếp tục.
              </p>
            ) : (
              <>
                <h3>Khách phản ánh</h3>
                <p className="incident-text">{detail.data.complaint.reason}</p>
                <ul>
                  {detail.data.items.map((item, index) => (
                    <li key={index}>
                      {item.name} · {item.quantity} × {formatComplaintMoney(item.unitPrice)}
                    </li>
                  ))}
                </ul>
                <h3>Ảnh khách cung cấp</h3>
                <p className="quiet">
                  Liên kết chưa được xác minh nội dung; mở ở tab mới. Đối chiếu ảnh và thông tin đơn
                  trước khi quyết định.
                </p>
                {detail.data.evidence.items.length === 0 ? (
                  <p>Chưa có ảnh minh chứng.</p>
                ) : (
                  <ul className="incident-evidence">
                    {detail.data.evidence.items.map((photo, index) => {
                      const url = safeUrl(photo.url);
                      return (
                        <li key={photo.id}>
                          {url ? (
                            <a href={url} target="_blank" rel="noopener noreferrer">
                              Xem ảnh phản ánh {index + 1}
                            </a>
                          ) : (
                            <span>Ảnh {index + 1}: liên kết không hợp lệ.</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {detail.data.evidence.hasMore && (
                  <p>
                    Hồ sơ còn ảnh ngoài 20 ảnh đang hiển thị. Cần đối chiếu đầy đủ trước khi kết
                    luận.
                  </p>
                )}
                {detail.data.complaint.status === 'OPEN' && !uncertain ? (
                  <form
                    noValidate
                    onSubmit={form.handleSubmit((values) => {
                      if (Number(values.amount) > Number(detail.data.complaint.orderTotal)) {
                        form.setError('amount', {
                          message: 'Số tiền không được vượt giá trị đơn.',
                        });
                        return;
                      }
                      setReview(values);
                      setError('');
                    })}
                  >
                    <h3>Quyết định xử lý</h3>
                    <p>
                      Nhập 0 để từ chối hoàn tiền. Nhập số tiền lớn hơn 0 để duyệt hoàn; việc chuyển
                      khoản được thực hiện riêng bởi quản trị viên khác.
                    </p>
                    <div hidden={!!review}>
                      <label htmlFor={`amount-${row.id}`}>Số tiền đề nghị hoàn (đồng)</label>
                      <input
                        id={`amount-${row.id}`}
                        inputMode="numeric"
                        {...form.register('amount')}
                        readOnly={saving}
                        aria-invalid={!!form.formState.errors.amount}
                        aria-describedby={`amount-error-${row.id}`}
                      />
                      <p className="error" id={`amount-error-${row.id}`}>
                        {form.formState.errors.amount?.message}
                      </p>
                      <label htmlFor={`decision-${row.id}`}>Lý do và căn cứ xử lý</label>
                      <textarea
                        id={`decision-${row.id}`}
                        rows={3}
                        maxLength={2000}
                        {...form.register('decision')}
                        readOnly={saving}
                        aria-invalid={!!form.formState.errors.decision}
                        aria-describedby={`decision-error-${row.id}`}
                      />
                      <p className="error" id={`decision-error-${row.id}`}>
                        {form.formState.errors.decision?.message}
                      </p>
                    </div>
                    {review && (
                      <>
                        <h4 ref={heading} tabIndex={-1}>
                          {Number(review.amount) === 0
                            ? 'Xác nhận từ chối hoàn tiền'
                            : `Xác nhận duyệt hoàn ${formatComplaintMoney(review.amount)}`}
                        </h4>
                        <p className="incident-text">{review.decision}</p>
                        <p>
                          Quyết định sẽ đóng phản ánh này. Duyệt hoàn chưa đồng nghĩa với khách đã
                          nhận tiền.
                        </p>
                      </>
                    )}
                    <div className="stock-actions">
                      {review ? (
                        <>
                          <Button type="button" disabled={saving} onClick={() => void confirm()}>
                            {saving ? 'Đang ghi nhận…' : 'Xác nhận quyết định'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={saving}
                            onClick={() => {
                              editingFocus.current = true;
                              setReview(null);
                            }}
                          >
                            Sửa quyết định
                          </Button>
                        </>
                      ) : (
                        <Button type="submit" disabled={saving}>
                          Kiểm tra quyết định
                        </Button>
                      )}
                    </div>
                  </form>
                ) : (
                  detail.data.complaint.status !== 'OPEN' && (
                    <>
                      <h3>
                        {detail.data.complaint.status === 'RESOLVED_REFUND'
                          ? `Đã duyệt hoàn ${formatComplaintMoney(detail.data.complaint.refundAmount ?? 0)}`
                          : 'Đã từ chối hoàn tiền'}
                      </h3>
                      <p className="incident-text">{detail.data.complaint.decision}</p>
                      <p>Đây là kết quả xét duyệt, không phải xác nhận đã chuyển khoản.</p>
                    </>
                  )
                )}
              </>
            )}
            <p role="alert" className="error">
              {error}
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={saving || detail.isFetching}
              onClick={async () => {
                const result = await detail.refetch();
                if (result.isSuccess) {
                  setUncertain(false);
                  setError('');
                  setReview(null);
                }
              }}
            >
              Tải lại hồ sơ
            </Button>
          </div>
        )}
      </details>
    </li>
  );
}

export default function AdminComplaints() {
  const [status, setStatus] = useState('OPEN');
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState('');
  const noticeRef = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    if (notice) noticeRef.current?.focus();
  }, [notice]);
  const queue = useQuery({
    queryKey: ['admin-complaints', status, page],
    queryFn: () => request<Queue>(`/admin/complaints?status=${status}&page=${page}`),
  });
  return (
    <section className="admin-complaints" aria-labelledby="complaints-title">
      <h2 id="complaints-title">Danh sách phản ánh của khách</h2>
      <p>
        Xem phản ánh và ghi nhận quyết định cho từng đơn. Phản ánh đang mở được xếp cũ nhất trước.
      </p>
      <AdminFilterBar
        actions={
          <>
            <Button
              variant="outline"
              disabled={queue.isFetching}
              onClick={() => {
                setPage(1);
                void queryClient.invalidateQueries({ queryKey: ['admin-complaints'] });
              }}
            >
              Cập nhật phản ánh
            </Button>
          </>
        }
      >
        <div>
          <label htmlFor="complaint-status">Trạng thái phản ánh</label>
          <select
            id="complaint-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="OPEN">Chờ xem xét</option>
            <option value="RESOLVED_REFUND">Đã duyệt hoàn</option>
            <option value="RESOLVED_REJECT">Đã từ chối hoàn</option>
          </select>
        </div>
      </AdminFilterBar>
      <p role="status" tabIndex={-1} ref={noticeRef}>
        {notice}
      </p>
      {queue.isPending ? (
        <p role="status">Đang tải phản ánh…</p>
      ) : queue.isError ? (
        <p role="alert" className="error">
          Chưa tải được danh sách. Chọn “Cập nhật phản ánh” để thử lại.
        </p>
      ) : (
        <>
          {queue.data.items.length === 0 && <p>Chưa có phản ánh ở trang này.</p>}
          <ul className="admin-shop-list">
            {queue.data.items.map((row) => (
              <Complaint key={row.id} row={row} onSaved={setNotice} />
            ))}
          </ul>
          <div className="stock-actions">
            <Button
              variant="outline"
              disabled={page === 1 || queue.isFetching}
              onClick={() => setPage((value) => value - 1)}
            >
              Trang phản ánh trước
            </Button>
            <span>Trang {page}</span>
            <Button
              variant="outline"
              disabled={!queue.data.hasMore || queue.isFetching}
              onClick={() => setPage((value) => value + 1)}
            >
              Trang phản ánh tiếp
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
