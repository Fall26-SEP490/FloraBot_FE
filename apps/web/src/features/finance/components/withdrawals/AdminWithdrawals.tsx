import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@florabot/ui';
import type {
  AdminWithdrawalDetail,
  AdminWithdrawalPage,
  AdminWithdrawalResponse,
  ApproveWithdrawalRequest,
  PayWithdrawalRequest,
  RejectWithdrawalRequest,
  WithdrawalBankResponse,
} from '../../finance.types';
import { ApiError, queryClient, request } from '../../../../api';

import EvidenceUpload from '../../../../shared/components/EvidenceUpload';
import FinancialProofs from '../FinancialProofs';

type Item = AdminWithdrawalResponse;
type Detail = AdminWithdrawalDetail;
type Bank = WithdrawalBankResponse;
type Page = AdminWithdrawalPage;
type Action = 'approve' | 'reject' | 'pay';
const names: Record<string, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Chờ chuyển tiền',
  PAID: 'Đã ghi nhận chuyển tiền',
  REJECTED: 'Đã từ chối',
};
const money = (value: number | string) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(value));
const schema = z.object({
  value: z.string().trim().max(10000, 'Nội dung quá dài.'),
  transferred: z.boolean(),
});

function WithdrawalDetails({ id, onNotice }: { id: string; onNotice: (message: string) => void }) {
  const query = useQuery({
    queryKey: ['admin-withdrawal', id],
    queryFn: () => request<Detail>(`/admin/withdrawals/${id}`),
  });
  const [action, setAction] = useState<Action | null>(null);
  const [review, setReview] = useState(false);
  const [bank, setBank] = useState<Bank | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [bankError, setBankError] = useState('');
  const confirmRef = useRef<HTMLButtonElement>(null);
  const actionRef = useRef<HTMLButtonElement | null>(null);
  const sending = useRef(false);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { value: '', transferred: false },
  });
  useEffect(() => {
    if (review) confirmRef.current?.focus();
  }, [review]);
  useEffect(() => {
    if (!bank) return;
    const timer = window.setTimeout(() => setBank(null), 60_000);
    const hide = () => {
      if (document.hidden) setBank(null);
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [bank]);
  const operation = useMutation({
    mutationFn: ({ kind, value }: { kind: Action; value: string }) =>
      kind === 'approve'
        ? request('/admin/flows/approve_withdrawal', {
            p_w: id,
          } satisfies ApproveWithdrawalRequest)
        : kind === 'reject'
          ? request('/admin/flows/reject_withdrawal', {
              p_w: id,
              p_reason: value,
            } satisfies RejectWithdrawalRequest)
          : request('/admin/flows/pay_withdrawal', {
              p_w: id,
              p_proof_url: value,
            } satisfies PayWithdrawalRequest),
    onSuccess: (_, input) => {
      setBank(null);
      setAction(null);
      setReview(false);
      form.reset();
      onNotice(
        input.kind === 'pay'
          ? 'Đã ghi nhận chuyển tiền và cập nhật sổ cái.'
          : input.kind === 'approve'
            ? 'Đã duyệt yêu cầu. Một admin khác cần thực hiện bước chi.'
            : 'Đã từ chối yêu cầu rút tiền.',
      );
    },
    onError: (error) => {
      setReview(false);
      setBank(null);
      if (!(error instanceof ApiError) || error.status >= 500)
        onNotice(
          'Chưa xác nhận được kết quả. Không chuyển tiền lần nữa; đối chiếu chứng từ và trạng thái yêu cầu trước khi thao tác tiếp.',
        );
    },
    onSettled: async () => {
      sending.current = false;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-withdrawals'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-withdrawal', id] }),
      ]);
    },
  });
  const reveal = async () => {
    if (revealing) return;
    setRevealing(true);
    setBankError('');
    try {
      setBank(await request<Bank>(`/admin/withdrawals/${id}/bank-details`, {}));
    } catch (error) {
      setBankError(
        error instanceof ApiError
          ? error.message
          : 'Chưa tải được thông tin ngân hàng. Kiểm tra kết nối và thử lại.',
      );
    } finally {
      setRevealing(false);
    }
  };
  if (query.isPending) return <p role="status">Đang tải yêu cầu rút tiền…</p>;
  if (query.isError)
    return (
      <>
        <p role="alert" className="error">
          Chưa tải được yêu cầu rút tiền.
        </p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          Tải lại yêu cầu
        </Button>
      </>
    );
  const detail = query.data;
  const item = detail.withdrawal;
  const canPay = detail.canAccessBank && Number(detail.availableBalance) >= Number(item.amount);
  const start = (kind: Action, button: HTMLButtonElement) => {
    actionRef.current = button;
    setAction(kind);
    setReview(false);
    operation.reset();
    form.reset();
    requestAnimationFrame(() => form.setFocus('value'));
  };
  const confirm = () => {
    // Keep loaded actions usable during background reads; the API remains authoritative.
    if (sending.current || !action || !review || (action === 'pay' && (!canPay || !bank))) return;
    sending.current = true;
    operation.mutate({ kind: action, value: form.getValues('value') });
  };
  return (
    <div className="withdrawal-detail">
      <dl className="bank-summary">
        <div>
          <dt>Mã yêu cầu</dt>
          <dd>{id}</dd>
        </div>
        <div>
          <dt>Số tiền yêu cầu</dt>
          <dd>{money(item.amount)}</dd>
        </div>
        <div>
          <dt>Số dư có thể rút hiện tại</dt>
          <dd>{money(detail.availableBalance)}</dd>
        </div>
        <div>
          <dt>Ngân hàng của yêu cầu</dt>
          <dd>
            {detail.bankName} · {detail.holder}
          </dd>
        </div>
        <div>
          <dt>Số tài khoản</dt>
          <dd>
            {detail.accountSuffix
              ? `Đã che, kết thúc bằng ${detail.accountSuffix}`
              : 'Chưa đọc được thông tin'}
          </dd>
        </div>
      </dl>
      <p className="quiet">
        Đích nhận tiền được lưu khi shop gửi yêu cầu, không đổi theo tài khoản shop cập nhật sau đó.
        Các yêu cầu chờ chưa giữ chỗ số dư.
      </p>
      {detail.bankStatus !== 'READY' && (
        <p className="error">
          Không đọc được tài khoản của yêu cầu này. Cần đối chiếu với shop trước khi chi; đổi tài
          khoản shop không sửa yêu cầu cũ.
        </p>
      )}
      {item.status === 'APPROVED' && !detail.canAccessBank && detail.bankStatus === 'READY' && (
        <p>Bước chi cần một admin khác người đã duyệt yêu cầu.</p>
      )}
      {detail.canAccessBank && (
        <div>
          <p>
            Trước khi chuyển khoản, đối chiếu mã yêu cầu và chứng từ với người phụ trách để tránh
            chi trùng.
          </p>
          {bank ? (
            <>
              <dl className="bank-summary">
                <div>
                  <dt>Ngân hàng nhận</dt>
                  <dd>{bank.bankName}</dd>
                </div>
                <div>
                  <dt>Chủ tài khoản nhận</dt>
                  <dd>{bank.holder}</dd>
                </div>
                <div>
                  <dt>Số tài khoản đầy đủ</dt>
                  <dd>{bank.account}</dd>
                </div>
              </dl>
              <Button variant="outline" onClick={() => setBank(null)}>
                Ẩn số tài khoản
              </Button>
            </>
          ) : (
            <Button variant="outline" disabled={revealing} onClick={() => void reveal()}>
              {revealing ? 'Đang tải tài khoản…' : 'Xem tài khoản để chi'}
            </Button>
          )}
          <p className="quiet">
            Lần xem được ghi nhật ký. Số tài khoản tự ẩn sau một phút, khi rời tab hoặc đóng hồ sơ.
          </p>
          {Number(detail.availableBalance) < Number(item.amount) && (
            <p className="error">
              Số dư hiện không đủ để ghi nhận chi. Cần đối chiếu trước khi chuyển tiền.
            </p>
          )}
        </div>
      )}
      {bankError && (
        <p role="alert" className="error">
          {bankError}
        </p>
      )}
      {['PENDING', 'APPROVED'].includes(item.status) && (
        <>
          <div className="stock-actions">
            {item.status === 'PENDING' && (
              <Button
                disabled={operation.isPending}
                onClick={(event) => start('approve', event.currentTarget)}
              >
                Duyệt yêu cầu
              </Button>
            )}
            <Button
              variant="outline"
              disabled={operation.isPending}
              onClick={(event) => start('reject', event.currentTarget)}
            >
              Từ chối yêu cầu
            </Button>
            {item.status === 'APPROVED' && detail.canAccessBank && (
              <Button
                disabled={!canPay || !bank || operation.isPending}
                onClick={(event) => start('pay', event.currentTarget)}
              >
                Ghi nhận đã chuyển khoản
              </Button>
            )}
          </div>
          {action && (
            <form
              noValidate
              onSubmit={form.handleSubmit((values) => {
                if (action === 'reject' && (values.value.length < 5 || values.value.length > 2000))
                  return form.setError(
                    'value',
                    { message: 'Nêu lý do từ chối từ 5 đến 2.000 ký tự.' },
                    { shouldFocus: true },
                  );
                if (action === 'pay' && !values.value.startsWith('evidence:v1:'))
                  return form.setError(
                    'value',
                    { message: 'Vui lòng tải ảnh chứng từ trước khi xác nhận.' },
                    { shouldFocus: true },
                  );
                if (action === 'pay' && !values.transferred)
                  return form.setError(
                    'transferred',
                    { message: 'Chỉ xác nhận sau khi đã chuyển khoản và đối chiếu chứng từ.' },
                    { shouldFocus: true },
                  );
                form.setValue('value', values.value);
                setReview(true);
              })}
            >
              <h3>
                {action === 'approve'
                  ? 'Kiểm tra trước khi duyệt'
                  : action === 'reject'
                    ? 'Lý do từ chối'
                    : 'Ghi nhận khoản đã chuyển'}
              </h3>
              <p>
                {action === 'approve'
                  ? `Duyệt ${money(item.amount)} cho ${item.shopName || 'shop'}? Duyệt chưa chuyển tiền và chưa trừ số dư.`
                  : action === 'reject'
                    ? 'Shop sẽ thấy lý do này trong lịch sử yêu cầu.'
                    : 'FloraBot không thực hiện chuyển khoản. Chỉ ghi nhận sau khi bạn đã chuyển đúng số tiền tới tài khoản của yêu cầu.'}
              </p>
              {action !== 'approve' && (
                <div hidden={review}>
                  {action === 'pay' ? (
                    <Controller
                      name="value"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <EvidenceUpload
                          id={`payout-value-${id}`}
                          endpoint={`/api/admin/evidence/pay_withdrawal/${id}`}
                          inputRef={field.ref}
                          onReference={field.onChange}
                          error={fieldState.error?.message}
                          disabled={operation.isPending || review}
                        />
                      )}
                    />
                  ) : (
                    <>
                      <label htmlFor={`payout-value-${id}`}>Lý do từ chối yêu cầu</label>
                      <input
                        id={`payout-value-${id}`}
                        maxLength={2000}
                        autoComplete="off"
                        {...form.register('value')}
                        aria-invalid={!!form.formState.errors.value}
                        aria-describedby={`payout-error-${id}`}
                        disabled={operation.isPending}
                      />
                      <p className="error" id={`payout-error-${id}`}>
                        {form.formState.errors.value?.message}
                      </p>
                    </>
                  )}
                  {action === 'pay' && (
                    <>
                      <label className="payout-checkbox">
                        <input
                          type="checkbox"
                          {...form.register('transferred')}
                          aria-invalid={!!form.formState.errors.transferred}
                          aria-describedby={`payout-transferred-${id}`}
                          disabled={operation.isPending}
                        />
                        Tôi đã chuyển khoản và đối chiếu chứng từ của yêu cầu này.
                      </label>
                      <p className="error" id={`payout-transferred-${id}`}>
                        {form.formState.errors.transferred?.message}
                      </p>
                    </>
                  )}
                </div>
              )}
              {review && (
                <p className="incident-text">
                  {action === 'approve'
                    ? 'Xác nhận duyệt và chuyển yêu cầu sang chờ chi.'
                    : action === 'reject'
                      ? `Từ chối: ${form.getValues('value')}`
                      : `Ghi nhận đã chi ${money(item.amount)}. Ảnh chứng từ đã lưu riêng tư và gắn với yêu cầu này.`}
                </p>
              )}
              <div className="stock-actions">
                {review ? (
                  <Button
                    ref={confirmRef}
                    type="button"
                    disabled={operation.isPending || (action === 'pay' && !bank)}
                    onClick={confirm}
                  >
                    {operation.isPending ? 'Đang ghi nhận…' : 'Xác nhận thao tác'}
                  </Button>
                ) : (
                  <Button type="submit" disabled={operation.isPending}>
                    Kiểm tra thao tác
                  </Button>
                )}
                <Button
                  variant="outline"
                  disabled={operation.isPending}
                  onClick={() => {
                    setAction(null);
                    setReview(false);
                    form.reset();
                    requestAnimationFrame(() => actionRef.current?.focus());
                  }}
                >
                  Hủy thao tác
                </Button>
              </div>
            </form>
          )}
        </>
      )}
      {item.rejectReason && <p>Lý do từ chối: {item.rejectReason}</p>}
      {item.paidAt && <FinancialProofs purpose="pay_withdrawal" resourceId={id} />}
      {item.paidAt && <p>Ghi nhận chi lúc {new Date(item.paidAt).toLocaleString('vi-VN')}.</p>}
      {operation.isError && (
        <p role="alert" className="error">
          {operation.error instanceof ApiError
            ? operation.error.message
            : 'Chưa xác nhận kết quả ghi nhận. Đối chiếu trạng thái và chứng từ; không chuyển khoản lại.'}
        </p>
      )}
    </div>
  );
}

function WithdrawalItem({ item, onNotice }: { item: Item; onNotice: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <details onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary>
          <strong>
            {item.shopName || item.sellerId} · {money(item.amount)}
          </strong>
          <span>
            {names[item.status]} · {new Date(item.createdAt).toLocaleString('vi-VN')}
          </span>
        </summary>
        {open && <WithdrawalDetails id={item.id} onNotice={onNotice} />}
      </details>
    </li>
  );
}

export default function AdminWithdrawals() {
  const [status, setStatus] = useState('PENDING');
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState('');
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const queue = useQuery({
    queryKey: ['admin-withdrawals', status, page],
    queryFn: () => request<Page>(`/admin/withdrawals?status=${status}&page=${page}`),
  });
  return (
    <section className="admin-withdrawals" aria-labelledby="admin-withdrawals-title">
      <h2 id="admin-withdrawals-title">Yêu cầu rút tiền của shop</h2>
      <p>
        Duyệt và chi bằng hai tài khoản admin khác nhau. Mỗi khoản chi cần chứng từ để đối chiếu.
      </p>
      <label htmlFor="withdrawal-status">Trạng thái yêu cầu rút tiền</label>
      <select
        id="withdrawal-status"
        value={status}
        onChange={(event) => {
          setStatus(event.target.value);
          setPage(1);
        }}
      >
        {Object.entries(names).map(([value, name]) => (
          <option key={value} value={value}>
            {name}
          </option>
        ))}
      </select>
      <div className="stock-actions">
        <Button
          variant="outline"
          disabled={queue.isFetching}
          onClick={() => {
            setPage(1);
            void queryClient.invalidateQueries({ queryKey: ['admin-withdrawals'] });
            void queryClient.invalidateQueries({ queryKey: ['admin-withdrawal'] });
          }}
        >
          Cập nhật yêu cầu rút tiền
        </Button>
      </div>
      <p role="status" ref={noticeRef} tabIndex={-1}>
        {notice}
      </p>
      {queue.isPending ? (
        <p role="status">Đang tải yêu cầu rút tiền…</p>
      ) : queue.isError ? (
        <p role="alert" className="error">
          Chưa tải được danh sách. Chọn “Cập nhật yêu cầu rút tiền” để thử lại.
        </p>
      ) : (
        <>
          {queue.data.items.length === 0 && (
            <p>Không có yêu cầu ở trang này. Cập nhật hoặc chọn trạng thái khác để kiểm tra.</p>
          )}
          <ul className="admin-shop-list">
            {queue.data.items.map((item) => (
              <WithdrawalItem
                key={item.id}
                item={item}
                onNotice={(message) => {
                  setNotice(message);
                  requestAnimationFrame(() => noticeRef.current?.focus());
                }}
              />
            ))}
          </ul>
          <nav className="stock-actions" aria-label="Phân trang yêu cầu rút tiền">
            <Button
              variant="outline"
              disabled={page === 1 || queue.isFetching}
              onClick={() => setPage((value) => value - 1)}
            >
              Trang yêu cầu trước
            </Button>
            <span>Trang {page}</span>
            <Button
              variant="outline"
              disabled={!queue.data.hasMore || queue.isFetching}
              onClick={() => setPage((value) => value + 1)}
            >
              Trang yêu cầu sau
            </Button>
          </nav>
          <p className="quiet">
            Tối đa 25 yêu cầu mỗi trang. Danh sách có thể thay đổi khi admin khác xử lý; cập nhật để
            trở lại trang đầu.
          </p>
        </>
      )}
    </section>
  );
}
