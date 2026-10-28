import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@florabot/ui';
import type { ApproveRefundRequest, ConfirmRefundRequest } from '../../finance.types';
import { ApiError, queryClient, request } from '@/shared/lib/api';
import EvidenceUpload from '../../../../shared/components/EvidenceUpload';
import { REFUND_STATUS_NAMES } from '../../finance.constants';
import type {
  AdminRefundDetail,
  AdminRefundPage,
  AdminRefundResponse,
  RefundBankResponse,
} from '../../finance.types';
import { formatFinanceDate, formatMoney } from '../../finance.utils';
import FinancialProofs from '../FinancialProofs';

type Item = AdminRefundResponse;
type Detail = AdminRefundDetail;
type Bank = RefundBankResponse;
type Queue = AdminRefundPage;

const schema = z.object({
  proof: z
    .string()
    .startsWith('evidence:v1:', 'Vui lòng tải ảnh chứng từ trước khi xác nhận.')
    .max(10000),
  transferred: z
    .boolean()
    .refine((value) => value, 'Chỉ xác nhận sau khi đã chuyển tiền và đối chiếu chứng từ.'),
});

function RefundDetails({ id, onNotice }: { id: string; onNotice: (message: string) => void }) {
  const query = useQuery({
    queryKey: ['admin-refund', id],
    queryFn: () => request<Detail>(`/admin/refunds/${id}`),
  });
  const [bank, setBank] = useState<Bank | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [action, setAction] = useState<'approve' | 'pay' | null>(null);
  const [review, setReview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState('');
  const epoch = useRef(0);
  const mounted = useRef(true);
  const sending = useRef(false);
  const revealBusy = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const restoreFocus = useRef(false);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { proof: '', transferred: false },
  });
  useLayoutEffect(() => {
    if (review) heading.current?.focus();
    else if (action === 'pay') form.setFocus('proof');
    else if (restoreFocus.current) {
      opener.current?.focus();
      restoreFocus.current = false;
    }
  }, [review, action, form]);
  useEffect(() => {
    mounted.current = true;
    epoch.current++;
    const hide = () => {
      if (document.hidden) {
        epoch.current++;
        setBank(null);
      }
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      mounted.current = false;
      document.removeEventListener('visibilitychange', hide);
    };
  }, []);
  useEffect(() => {
    if (!bank) return;
    const timer = setTimeout(() => setBank(null), 60_000);
    return () => clearTimeout(timer);
  }, [bank]);
  useEffect(() => {
    if (!query.data?.canAccessBank) epoch.current++;
  }, [query.data?.canAccessBank]);
  if (bank && query.data && !query.data.canAccessBank) setBank(null);
  async function reveal() {
    if (revealBusy.current || uncertain) return;
    revealBusy.current = true;
    setRevealing(true);
    setError('');
    const generation = ++epoch.current;
    try {
      const value = await request<Bank>(`/admin/refunds/${id}/bank-details`, {});
      if (mounted.current && generation === epoch.current && !document.hidden) setBank(value);
    } catch (cause) {
      if (mounted.current && generation === epoch.current)
        setError(
          cause instanceof ApiError
            ? cause.message
            : 'Chưa tải được tài khoản. Tải lại hồ sơ để kiểm tra.',
        );
    } finally {
      revealBusy.current = false;
      if (mounted.current) setRevealing(false);
    }
  }
  async function confirm() {
    if (
      sending.current ||
      uncertain ||
      !review ||
      !action ||
      query.isError ||
      query.data?.refund.status !== 'PENDING'
    )
      return;
    if (action === 'approve' ? !query.data.canApprove : !query.data.canAccessBank || !bank) return;
    sending.current = true;
    setSaving(true);
    setError('');
    try {
      if (action === 'approve')
        await request('/admin/flows/approve_refund', {
          p_refund: id,
        } satisfies ApproveRefundRequest);
      else
        await request('/admin/flows/confirm_refund', {
          p_refund: id,
          p_proof_url: form.getValues('proof'),
        } satisfies ConfirmRefundRequest);
      onNotice(
        action === 'approve'
          ? 'Đã duyệt khoản hoàn. Bước chi cần một admin khác.'
          : 'Đã ghi nhận chi hoàn và cập nhật sổ cái.',
      );
      setAction(null);
      form.reset();
    } catch (cause) {
      if (!(cause instanceof ApiError) || cause.status >= 500) {
        setUncertain(true);
        setAction(null);
        form.reset();
        setError(
          'Chưa xác nhận được kết quả. Không chuyển tiền lần nữa. Tải lại hồ sơ và đối chiếu chứng từ trước khi tiếp tục.',
        );
      } else setError(cause.message);
    } finally {
      epoch.current++;
      setBank(null);
      setReview(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-refunds'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-refund', id] }),
        queryClient.invalidateQueries({ queryKey: ['admin-complaints'] }),
      ]);
      sending.current = false;
      if (mounted.current) setSaving(false);
    }
  }
  const start = (kind: 'approve' | 'pay', button: HTMLButtonElement) => {
    opener.current = button;
    setAction(kind);
    setReview(kind === 'approve');
    form.reset();
    setError('');
  };
  if (query.isPending) return <p role="status">Đang tải khoản hoàn…</p>;
  const data = query.data;
  return (
    <div className="withdrawal-detail">
      {query.isError || !data ? (
        <p role="alert" className="error">
          Chưa tải được khoản hoàn. Chọn tải lại hồ sơ để tiếp tục.
        </p>
      ) : (
        <>
          <p className="quiet">Mã khoản hoàn: {id}</p>
          <h3>
            Hoàn {formatMoney(data.refund.amount)} cho đơn{' '}
            {data.refund.orderCode || data.refund.orderId}
          </h3>
          <p className="incident-text">{data.refund.reason}</p>
          {data.refund.status === 'PENDING' && (
            <>
              {data.bankStatus === 'NEEDS_UPDATE' && (
                <p>
                  Chưa có tài khoản nhận hoàn hợp lệ. Khách cần bổ sung hoặc cập nhật trên biên
                  nhận.
                </p>
              )}
              {!data.canApprove && !data.canAccessBank && data.bankStatus === 'READY' && (
                <p>Khoản hoàn đã được duyệt. Cần admin khác người duyệt thực hiện bước chi.</p>
              )}
              <p>
                FloraBot chỉ ghi nhận kết quả chuyển khoản thủ công. Đối chiếu mã khoản hoàn với
                người phụ trách trước khi chi để tránh chuyển trùng.
              </p>
              {!uncertain && (
                <>
                  {data.canApprove && !action && (
                    <Button onClick={(event) => start('approve', event.currentTarget)}>
                      Duyệt khoản hoàn
                    </Button>
                  )}
                  {data.canAccessBank && (
                    <div>
                      {bank ? (
                        <>
                          <dl className="bank-summary">
                            <div>
                              <dt>Ngân hàng nhận hoàn</dt>
                              <dd>{bank.bankName}</dd>
                            </div>
                            <div>
                              <dt>Người nhận hoàn</dt>
                              <dd>{bank.holder}</dd>
                            </div>
                            <div>
                              <dt>Tài khoản nhận hoàn</dt>
                              <dd>{bank.account}</dd>
                            </div>
                          </dl>
                          <Button
                            variant="outline"
                            onClick={() => {
                              epoch.current++;
                              setBank(null);
                            }}
                          >
                            Ẩn tài khoản nhận hoàn
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          disabled={revealing || saving}
                          onClick={() => void reveal()}
                        >
                          {revealing ? 'Đang tải tài khoản…' : 'Xem tài khoản nhận hoàn'}
                        </Button>
                      )}
                      <p className="quiet">
                        Lần xem được ghi nhật ký; thông tin tự ẩn sau một phút, khi rời tab hoặc
                        đóng hồ sơ. Đây là tài khoản khách khai hiện tại, cần đối chiếu trước khi
                        chuyển.
                      </p>
                      {!action && (
                        <Button
                          disabled={!bank || saving}
                          onClick={(event) => start('pay', event.currentTarget)}
                        >
                          Ghi nhận đã chi hoàn
                        </Button>
                      )}
                    </div>
                  )}
                  {action && (
                    <form noValidate onSubmit={form.handleSubmit(() => setReview(true))}>
                      {action === 'pay' && (
                        <div hidden={review}>
                          <Controller
                            name="proof"
                            control={form.control}
                            render={({ field, fieldState }) => (
                              <EvidenceUpload
                                id={`refund-proof-${id}`}
                                endpoint={`/api/admin/evidence/confirm_refund/${id}`}
                                inputRef={field.ref}
                                onReference={field.onChange}
                                error={fieldState.error?.message}
                                disabled={saving || review}
                              />
                            )}
                          />
                          <label className="payout-checkbox">
                            <input
                              type="checkbox"
                              {...form.register('transferred')}
                              disabled={saving}
                              aria-invalid={!!form.formState.errors.transferred}
                              aria-describedby={`refund-check-error-${id}`}
                            />
                            Tôi đã chuyển đúng khoản hoàn và đối chiếu chứng từ.
                          </label>
                          <p className="error" id={`refund-check-error-${id}`}>
                            {form.formState.errors.transferred?.message}
                          </p>
                        </div>
                      )}
                      {review && (
                        <>
                          <h4 ref={heading} tabIndex={-1}>
                            {action === 'approve'
                              ? `Duyệt khoản hoàn ${formatMoney(data.refund.amount)}?`
                              : `Ghi nhận đã chi hoàn ${formatMoney(data.refund.amount)}?`}
                          </h4>
                          <p>
                            {action === 'approve'
                              ? 'Một admin khác sẽ thực hiện bước chi; thao tác duyệt chưa chuyển tiền.'
                              : 'Chỉ xác nhận khi giao dịch ngân hàng đã hoàn tất. Thao tác này cập nhật sổ cái và trạng thái khoản hoàn.'}
                          </p>
                          {action === 'pay' && (
                            <p className="incident-text">
                              Ảnh chứng từ đã lưu riêng tư và gắn với khoản hoàn này.
                            </p>
                          )}
                        </>
                      )}
                      <div className="stock-actions">
                        {review ? (
                          <Button
                            type="button"
                            disabled={saving || (action === 'pay' && !bank)}
                            onClick={() => void confirm()}
                          >
                            {saving ? 'Đang ghi nhận…' : 'Xác nhận khoản hoàn'}
                          </Button>
                        ) : (
                          <Button type="submit" disabled={saving || !bank}>
                            Kiểm tra chứng từ hoàn
                          </Button>
                        )}
                        {review && action === 'pay' && (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={saving}
                            onClick={() => setReview(false)}
                          >
                            Sửa chứng từ hoàn
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          disabled={saving}
                          onClick={() => {
                            restoreFocus.current = true;
                            setAction(null);
                            setReview(false);
                            form.reset();
                          }}
                        >
                          Hủy xử lý khoản hoàn
                        </Button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </>
          )}
          {data.refund.paidAt && <FinancialProofs purpose="confirm_refund" resourceId={id} />}
          {data.refund.paidAt && (
            <p>Đã ghi nhận chi lúc {formatFinanceDate(data.refund.paidAt)}.</p>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <Button
        variant="outline"
        disabled={saving || query.isFetching}
        onClick={async () => {
          epoch.current++;
          setBank(null);
          const result = await query.refetch();
          if (result.isSuccess) {
            setUncertain(false);
            setError('');
            setAction(null);
            setReview(false);
            form.reset();
          }
        }}
      >
        Tải lại khoản hoàn
      </Button>
    </div>
  );
}

function RefundItem({ item, onNotice }: { item: Item; onNotice: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <details onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary>
          <strong>
            Đơn {item.orderCode || item.orderId || item.id} · {formatMoney(item.amount)}
          </strong>
          <span>
            {item.status === 'PENDING' && item.requiresApproval
              ? 'Cần admin duyệt'
              : REFUND_STATUS_NAMES[item.status] || item.status}
          </span>
        </summary>
        {open && <RefundDetails id={item.id} onNotice={onNotice} />}
      </details>
    </li>
  );
}

export default function AdminRefunds() {
  const [status, setStatus] = useState('PENDING');
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState('');
  const noticeRef = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    if (notice) noticeRef.current?.focus();
  }, [notice]);
  const queue = useQuery({
    queryKey: ['admin-refunds', status, page],
    queryFn: () => request<Queue>(`/admin/refunds?status=${status}&page=${page}`),
  });
  return (
    <section className="admin-refunds" aria-labelledby="refunds-title">
      <h2 id="refunds-title">Hoàn tiền cho khách</h2>
      <p>Duyệt và chi bằng hai admin khác nhau. Khoản đang chờ được xếp cũ nhất trước.</p>
      <label htmlFor="refund-status">Trạng thái khoản hoàn</label>
      <select
        id="refund-status"
        value={status}
        onChange={(event) => {
          setStatus(event.target.value);
          setPage(1);
        }}
      >
        {Object.entries(REFUND_STATUS_NAMES).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <div className="stock-actions">
        <Button
          variant="outline"
          disabled={queue.isFetching}
          onClick={() => {
            setPage(1);
            void queryClient.invalidateQueries({ queryKey: ['admin-refunds'] });
          }}
        >
          Cập nhật khoản hoàn
        </Button>
      </div>
      <p role="status" tabIndex={-1} ref={noticeRef}>
        {notice}
      </p>
      {queue.isPending ? (
        <p role="status">Đang tải hàng chờ hoàn tiền…</p>
      ) : queue.isError ? (
        <p role="alert" className="error">
          Chưa tải được hàng chờ. Chọn “Cập nhật khoản hoàn” để thử lại.
        </p>
      ) : (
        <>
          {queue.data.items.length === 0 && <p>Không có khoản hoàn ở trang này.</p>}
          <ul className="admin-shop-list">
            {queue.data.items.map((item) => (
              <RefundItem key={item.id} item={item} onNotice={setNotice} />
            ))}
          </ul>
          <nav className="stock-actions" aria-label="Phân trang khoản hoàn">
            <Button
              variant="outline"
              disabled={page === 1 || queue.isFetching}
              onClick={() => setPage((value) => value - 1)}
            >
              Trang hoàn trước
            </Button>
            <span>Trang {page}</span>
            <Button
              variant="outline"
              disabled={!queue.data.hasMore || queue.isFetching}
              onClick={() => setPage((value) => value + 1)}
            >
              Trang hoàn sau
            </Button>
          </nav>
        </>
      )}
    </section>
  );
}
