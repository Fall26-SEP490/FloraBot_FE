import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@florabot/ui';
import type { components } from '../../../packages/contracts/src/generated/api';
import { ApiError, queryClient, request, type Session } from './api';
import BankDetails from './BankDetails';

type Overview = components['schemas']['WalletResponse'];
const money = (value: number | string) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(value));
const date = (value: string) =>
  new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
const statuses: Record<string, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt, chờ chuyển tiền',
  PAID: 'Đã chuyển tiền',
  REJECTED: 'Đã từ chối',
};
const accounts: Record<string, string> = {
  SELLER_PENDING: 'Tiền đang chờ',
  SELLER_AVAILABLE: 'Tiền có thể rút',
};
const references: Record<string, string> = {
  ORDER: 'Bán hàng',
  SETTLEMENT: 'Kết chuyển tiền',
  WITHDRAWAL: 'Rút tiền',
  REFUND: 'Hoàn tiền',
};
const schema = z.object({
  amount: z
    .string()
    .trim()
    .regex(/^\d+$/, 'Nhập số tiền nguyên, không kèm dấu chấm hoặc dấu phẩy.')
    .refine((value) => Number.isSafeInteger(Number(value)), 'Số tiền vượt giới hạn cho phép.'),
});
const message = (error: Error) =>
  error instanceof ApiError
    ? error.message
    : 'Kết nối bị gián đoạn. Hãy cập nhật ví để kiểm tra lại.';

export default function Wallet({ session }: { session: Session }) {
  const base = `/sellers/${session.sellerId}`;
  const queryKey = ['wallet', session.sellerId];
  const marker = `florabot:withdrawal-unconfirmed:${session.sellerId}`;
  const [uncertain, setUncertain] = useState(() => {
    try {
      return sessionStorage.getItem(marker) === '1';
    } catch {
      return false;
    }
  });
  const [review, setReview] = useState<number | null>(null);
  const sending = useRef(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const amountRef = useRef<HTMLInputElement | null>(null);
  const overview = useQuery({
    queryKey,
    queryFn: () => request<Overview>(`${base}/wallet`),
    refetchInterval: 30_000,
  });
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { amount: '' },
  });
  useEffect(() => {
    if (review !== null) confirmRef.current?.focus();
  }, [review]);
  const amountField = form.register('amount');
  const markUncertain = (value: boolean) => {
    setUncertain(value);
    try {
      if (value) sessionStorage.setItem(marker, '1');
      else sessionStorage.removeItem(marker);
    } catch {
      /* In-memory guard still prevents automatic retries. */
    }
  };
  const withdrawal = useMutation({
    mutationFn: (amount: number) =>
      request<components['schemas']['FlowResult']>(`${base}/flows/request_withdrawal`, {
        p_amount: amount,
      }),
    onSuccess: () => {
      markUncertain(false);
      setReview(null);
      form.reset();
    },
    onError: (error) => {
      // A timeout or server failure can occur after the database has committed.
      if (error instanceof ApiError && [400, 401, 403, 404, 409, 429].includes(error.status))
        markUncertain(false);
      setReview(null);
    },
    onSettled: async () => {
      sending.current = false;
      await queryClient.invalidateQueries({ queryKey });
    },
  });
  const available = Number(overview.data?.balance?.availableBalance ?? 0);
  const minimum = Number(overview.data?.minimumWithdrawal ?? 0);
  const validateAmount = (amount: number) => {
    if (amount < minimum || amount <= 0) {
      form.setError(
        'amount',
        { message: `Số tiền rút tối thiểu là ${money(minimum)}.` },
        { shouldFocus: true },
      );
      return false;
    }
    if (amount > available) {
      form.setError(
        'amount',
        { message: 'Số tiền vượt quá phần có thể rút. Hãy nhập số nhỏ hơn hoặc cập nhật ví.' },
        { shouldFocus: true },
      );
      return false;
    }
    return true;
  };
  const confirm = () => {
    if (
      sending.current ||
      uncertain ||
      review === null ||
      !overview.data?.bankConfigured ||
      overview.isFetching ||
      overview.isError
    )
      return;
    if (!validateAmount(review)) {
      setReview(null);
      return;
    }
    sending.current = true;
    markUncertain(true);
    withdrawal.mutate(review);
  };
  return (
    <section id="wallet" className="wallet" aria-labelledby="wallet-title" tabIndex={-1}>
      <div className="wallet-heading">
        <div>
          <h2 id="wallet-title">Tiền bán hoa của shop</h2>
          <p>Theo dõi tiền từ mỗi đơn hàng đến khi về tài khoản của bạn.</p>
        </div>
        <Button
          variant="outline"
          onClick={() => void overview.refetch()}
          disabled={overview.isFetching}
        >
          Cập nhật ví
        </Button>
      </div>
      {overview.isPending ? (
        <p role="status">Đang tải ví của shop…</p>
      ) : overview.isError ? (
        <p role="alert" className="error">
          {message(overview.error)} Chọn “Cập nhật ví” để thử lại.
        </p>
      ) : (
        <>
          <dl className="wallet-balances">
            <div>
              <dt>Có thể rút</dt>
              <dd>{money(available)}</dd>
            </div>
            <div>
              <dt>Đang chờ kết chuyển</dt>
              <dd>{money(overview.data.balance?.pendingBalance ?? 0)}</dd>
            </div>
            {Number(overview.data.balance?.debt ?? 0) > 0 && (
              <div>
                <dt>Khoản cần bù</dt>
                <dd>{money(overview.data.balance?.debt ?? 0)}</dd>
              </div>
            )}
          </dl>
          <p className="quiet">
            Tiền bán hàng được kết chuyển sau thời hạn khiếu nại khi đơn đủ điều kiện. Yêu cầu rút
            đang chờ chưa trừ số dư; số tiền được kiểm tra lại khi chuyển khoản.
          </p>
          <BankDetails session={session} />
          <div className="wallet-actions">
            <div>
              <h3>Gửi yêu cầu rút tiền</h3>
              <p>
                Mức rút tối thiểu hiện tại: <strong>{money(minimum)}</strong>.
              </p>
              <p className="quiet">
                Đội ngũ sẽ duyệt yêu cầu và chuyển khoản. Gửi yêu cầu chưa có nghĩa là tiền đã về
                ngân hàng.
              </p>
            </div>
            <div>
              {!overview.data.bankConfigured ? (
                <p>
                  Shop chưa có đầy đủ thông tin tài khoản nhận tiền. Mở mục “Tài khoản nhận tiền” để
                  khai báo trước khi rút.
                </p>
              ) : uncertain && !withdrawal.isPending ? (
                <div role="alert">
                  <p>
                    Chưa xác định được kết quả lần gửi trước. Cập nhật ví và kiểm tra các yêu cầu
                    gần đây trước khi gửi thêm.
                  </p>
                  <Button
                    variant="outline"
                    disabled={overview.isFetching}
                    onClick={() => {
                      markUncertain(false);
                      withdrawal.reset();
                    }}
                  >
                    Tôi đã kiểm tra lịch sử yêu cầu
                  </Button>
                </div>
              ) : review !== null ? (
                <div className="withdrawal-review">
                  <p>
                    Bạn muốn yêu cầu rút <strong>{money(review)}</strong> về tài khoản shop đã khai
                    báo?
                  </p>
                  <div className="wallet-buttons">
                    <Button
                      ref={confirmRef}
                      onClick={confirm}
                      disabled={withdrawal.isPending || overview.isFetching}
                    >
                      {withdrawal.isPending ? 'Đang gửi yêu cầu…' : 'Xác nhận yêu cầu rút'}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={withdrawal.isPending}
                      onClick={() => {
                        setReview(null);
                        requestAnimationFrame(() => amountRef.current?.focus());
                      }}
                    >
                      Sửa số tiền
                    </Button>
                  </div>
                </div>
              ) : (
                <form
                  noValidate
                  onSubmit={form.handleSubmit((values) => {
                    const amount = Number(values.amount);
                    if (validateAmount(amount)) {
                      withdrawal.reset();
                      setReview(amount);
                    }
                  })}
                >
                  <label htmlFor="withdrawal-amount">Số tiền muốn rút (đồng)</label>
                  <input
                    id="withdrawal-amount"
                    inputMode="numeric"
                    autoComplete="off"
                    {...amountField}
                    ref={(node) => {
                      amountField.ref(node);
                      amountRef.current = node;
                    }}
                    aria-invalid={!!form.formState.errors.amount}
                    aria-describedby="withdrawal-help withdrawal-error"
                  />
                  <p id="withdrawal-help" className="quiet">
                    Nhập số nguyên, ví dụ 100000 cho 100.000 đồng.
                  </p>
                  <p id="withdrawal-error" className="error">
                    {form.formState.errors.amount?.message}
                  </p>
                  <Button
                    type="submit"
                    disabled={
                      withdrawal.isPending ||
                      overview.isFetching ||
                      available < minimum ||
                      available <= 0
                    }
                  >
                    Kiểm tra yêu cầu rút
                  </Button>
                  {available < minimum && (
                    <p className="quiet">Tiền có thể rút chưa đạt mức tối thiểu.</p>
                  )}
                </form>
              )}
              {withdrawal.isError && (
                <p role="alert" className="error">
                  {message(withdrawal.error)}
                </p>
              )}
              <p role="status">
                {withdrawal.isSuccess
                  ? 'Đã gửi yêu cầu rút tiền. Bạn có thể theo dõi tiến độ bên dưới.'
                  : ''}
              </p>
            </div>
          </div>
          <h3>Yêu cầu rút gần đây</h3>
          {!overview.data.withdrawals.length ? (
            <p>Shop chưa gửi yêu cầu rút tiền nào.</p>
          ) : (
            <ul className="wallet-history">
              {overview.data.withdrawals.map((row) => (
                <li key={row.id}>
                  <div>
                    <strong>{money(row.amount)}</strong>
                    <p>{statuses[row.status] || row.status}</p>
                    <p className="quiet">
                      Gửi lúc {date(row.createdAt)}
                      {row.paidAt && ` · Chuyển lúc ${date(row.paidAt)}`}
                    </p>
                    {row.rejectReason && <p>Lý do: {row.rejectReason}</p>}
                  </div>
                  <span className="wallet-reference">Mã yêu cầu: {row.id}</span>
                </li>
              ))}
            </ul>
          )}
          {overview.data.hasMoreWithdrawals && (
            <p className="quiet">Đang hiển thị 100 yêu cầu gần nhất.</p>
          )}
          <details className="wallet-ledger">
            <summary>Xem giao dịch trong ví</summary>
            <p className="quiet">
              Dấu cộng là tiền tăng, dấu trừ là tiền giảm ở từng phần của ví. Kết chuyển tạo hai
              dòng: giảm tiền chờ và tăng tiền có thể rút.
            </p>
            {!overview.data.entries.length ? (
              <p>Chưa có giao dịch. Tiền bán hoa sẽ xuất hiện tại đây khi đơn được thanh toán.</p>
            ) : (
              <ul className="wallet-history">
                {overview.data.entries.map((row) => (
                  <li key={row.id}>
                    <div>
                      <strong>
                        {references[row.refType] || row.refType} ·{' '}
                        {accounts[row.account] || row.account}
                      </strong>
                      <p>{row.memo}</p>
                      <p className="quiet">{date(row.createdAt)}</p>
                    </div>
                    <span className="wallet-change">
                      {Number(row.amount) < 0 ? '+' : ''}
                      {money(-Number(row.amount))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {overview.data.hasMoreEntries && (
              <p className="quiet">Đang hiển thị 100 giao dịch gần nhất.</p>
            )}
          </details>
        </>
      )}
    </section>
  );
}
