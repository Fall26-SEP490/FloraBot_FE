import { useCallback, useEffect, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@florabot/ui';
import type { components } from '../../../../../../../packages/contracts/src/generated/api';
import { ApiError, queryClient, request, type Session } from '@/shared/lib/api';

type Overview = components['schemas']['SubscriptionOverviewResponse'];
type PaymentLink = components['schemas']['PaymentLinkResponse'];
const schema = z.object({
  months: z.number().int().min(1, 'Chọn từ 1 đến 12 tháng.').max(12, 'Chọn từ 1 đến 12 tháng.'),
});
const money = (value: number | string) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(value));
const date = (value: string) =>
  new Date(`${value}T00:00:00+07:00`).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
const statuses: Record<string, string> = {
  PENDING_PAYMENT: 'Chờ thanh toán',
  ACTIVE: 'Đã thanh toán',
  EXPIRED: 'Đã kết thúc',
  CANCELLED: 'Đã hủy',
};
const errorMessage = (error: Error) =>
  error instanceof ApiError
    ? error.message
    : 'Chưa kết nối được máy chủ. Tải lại danh sách để kiểm tra trước khi thử lại.';

export default function Subscriptions({ session }: { session: Session }) {
  const base = `/sellers/${session.sellerId}`;
  const queryKey = ['subscriptions', session.sellerId];
  const overview = useQuery({
    queryKey,
    queryFn: () => request<Overview>(`${base}/subscriptions`),
    refetchInterval: 30_000,
  });
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { months: 1 },
  });
  const months = useWatch({ control: form.control, name: 'months' });
  const linkRef = useRef<HTMLAnchorElement>(null);
  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['subscriptions', session.sellerId],
      }),
      queryClient.invalidateQueries({ queryKey: ['session'] }),
    ]);
  }, [session.sellerId]);
  const subscribe = useMutation({
    mutationFn: (values: z.infer<typeof schema>) =>
      request(`${base}/flows/subscribe`, { p_months: values.months }),
    onSettled: refresh,
  });
  const payment = useMutation({
    mutationFn: async (id: string) => {
      const result = await request<PaymentLink>(`${base}/subscriptions/${id}/payment-link`, {});
      const url = new URL(result.checkoutUrl);
      if (
        url.protocol !== 'https:' ||
        url.hostname !== 'pay.payos.vn' ||
        url.username ||
        url.password ||
        url.port
      )
        throw new Error('Invalid payment URL');
      return { ...result, subscriptionId: id };
    },
  });
  const allowed = ['APPROVED', 'ACTIVE', 'PAST_DUE'].includes(session.sellerStatus || '');
  const hasPending = overview.data?.subscriptions.some((row) => row.status === 'PENDING_PAYMENT');
  const selectedPending = overview.data?.subscriptions.some(
    (row) => row.id === payment.data?.subscriptionId && row.status === 'PENDING_PAYMENT',
  );
  useEffect(() => {
    if (!payment.data || !selectedPending) return;
    const frame = requestAnimationFrame(() => linkRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [payment.data, selectedPending]);
  useEffect(() => {
    if (!payment.data || !selectedPending) return;
    const timer = window.setInterval(() => {
      void refresh();
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [payment.data, selectedPending, refresh]);
  return (
    <section
      id="subscriptions"
      className="subscriptions"
      aria-labelledby="subscriptions-title"
      tabIndex={-1}
    >
      <h2 id="subscriptions-title">Gói thuê của shop</h2>
      <p>Thêm một kỳ thuê để những bó hoa luôn có chỗ đón khách.</p>
      {overview.isPending ? (
        <p role="status">Đang tải gói thuê…</p>
      ) : overview.isError ? (
        <div>
          <p role="alert" className="error">
            {errorMessage(overview.error)}
          </p>
          <Button onClick={() => void overview.refetch()}>Tải lại gói thuê</Button>
        </div>
      ) : (
        <>
          {overview.data.package ? (
            <p className="package-summary">
              <strong>{overview.data.package.name}</strong> ·{' '}
              {money(overview.data.package.monthlyFee)}/tháng · Tối đa{' '}
              {overview.data.package.maxSlots} ô
            </p>
          ) : (
            <p>
              Shop chưa được duyệt gói thuê. Đội ngũ FloraBot sẽ hỗ trợ bạn sau khi duyệt hồ sơ.
            </p>
          )}
          {allowed && overview.data.package?.status === 'ACTIVE' && !hasPending && (
            <form
              className="subscription-form"
              noValidate
              onSubmit={form.handleSubmit((values) => subscribe.mutate(values))}
            >
              <label htmlFor="subscription-months">Số tháng đăng ký</label>
              <select
                id="subscription-months"
                {...form.register('months', { valueAsNumber: true })}
                aria-invalid={!!form.formState.errors.months}
                aria-describedby="subscription-help subscription-months-error"
                disabled={subscribe.isPending}
              >
                {Array.from({ length: 12 }, (_, index) => (
                  <option key={index} value={index + 1}>
                    {index + 1} tháng
                  </option>
                ))}
              </select>
              <p id="subscription-months-error" className="error">
                {form.formState.errors.months?.message}
              </p>
              <p id="subscription-help" className="quiet">
                Kỳ mới nối tiếp kỳ hiện có hoặc bắt đầu hôm nay nếu gói đã hết hạn. Ngày kết thúc
                không nằm trong kỳ thuê.
              </p>
              <p className="subscription-total">
                Phí kỳ thuê:{' '}
                <strong>{money(Number(overview.data.package.monthlyFee) * months)}</strong>
              </p>
              <Button type="submit" disabled={subscribe.isPending}>
                {subscribe.isPending ? 'Đang đăng ký…' : 'Đăng ký kỳ thuê'}
              </Button>
            </form>
          )}
          {hasPending && (
            <p className="quiet">
              Bạn có kỳ đang chờ thanh toán bên dưới. Hãy hoàn tất kỳ này trước khi đăng ký thêm.
            </p>
          )}
          {!allowed && overview.data.package && (
            <p>
              Trạng thái hiện tại của shop chưa cho phép đăng ký hoặc thanh toán gói. Vui lòng liên
              hệ đội ngũ vận hành.
            </p>
          )}
          {subscribe.isError && (
            <p role="alert" className="error">
              {errorMessage(subscribe.error)}
            </p>
          )}
          <p role="status">
            {subscribe.isSuccess
              ? 'Đã đăng ký kỳ thuê. Chọn tạo liên kết để tiếp tục thanh toán.'
              : ''}
          </p>
          <div className="subscription-history-heading">
            <h3>Các kỳ thuê gần đây</h3>
            <Button variant="outline" onClick={() => void refresh()} disabled={overview.isFetching}>
              Cập nhật trạng thái
            </Button>
          </div>
          {!overview.data.subscriptions.length ? (
            <p>Shop chưa có kỳ thuê nào.</p>
          ) : (
            <ul className="subscription-list">
              {overview.data.subscriptions.map((row) => (
                <li key={row.id}>
                  <div>
                    <h4>{row.packageName}</h4>
                    <p>
                      {date(row.periodFrom)} đến trước {date(row.periodTo)}
                    </p>
                    <p>
                      {statuses[row.status] || row.status} · <strong>{money(row.price)}</strong>
                    </p>
                  </div>
                  {row.status === 'PENDING_PAYMENT' && allowed && (
                    <Button
                      variant="outline"
                      disabled={payment.isPending}
                      onClick={() => payment.mutate(row.id)}
                    >
                      {payment.isPending && payment.variables === row.id
                        ? 'Đang lấy liên kết…'
                        : 'Tạo liên kết thanh toán'}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {payment.isError && (
            <p role="alert" className="error">
              {errorMessage(payment.error)}
            </p>
          )}
          {payment.data && selectedPending && (
            <div className="payment-ready">
              <p role="status">Liên kết thanh toán {money(payment.data.amount)} đã sẵn sàng.</p>
              <a
                ref={linkRef}
                className="button button-primary"
                href={payment.data.checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Tiếp tục trên payOS
              </a>
              <p className="quiet">
                Gói chỉ được kích hoạt sau khi hệ thống xác nhận đã nhận tiền. Quay lại đây và chọn
                “Cập nhật trạng thái” để kiểm tra.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
