import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Button } from '@florabot/ui';
import { ApiError, queryClient, request } from './api';
import { passwordRule } from './MemberAuth';
import type { components } from '../../../packages/contracts/src/generated/api';
import WebRequests from './WebRequests';
import MemberShop from './MemberShop';
import MemberGoogleLink from './MemberGoogleLink';

type Profile = { id: string; fullName: string; email: string | null; loyaltyPoints: number };
export default function MemberAccount() {
  const router = useRouter();
  const profile = useQuery({
    queryKey: ['member-profile'],
    queryFn: () => request<Profile>('/member/profile'),
  });
  const [page, setPage] = useState(1);
  const history = useQuery({
    queryKey: ['member-history', page],
    queryFn: () =>
      request<components['schemas']['CustomerHistoryPage']>(`/member/history?page=${page}`),
  });
  const passwords = useForm<{ currentPassword: string; newPassword: string; confirm: string }>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  async function save(body: unknown, password = false) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await request(password ? '/member/password' : '/member/profile', body);
      if (password) {
        passwords.reset();
        queryClient.clear();
        router.push('/dang-nhap');
      } else {
        await queryClient.invalidateQueries({ queryKey: ['member-profile'] });
        setNotice('Đã cập nhật tên của bạn.');
      }
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Chưa xác nhận được thay đổi. Hãy tải lại để kiểm tra.',
      );
    } finally {
      setBusy(false);
    }
  }
  const statuses: Record<string, string> = {
    AWAITING_PAYMENT: 'Chờ thanh toán',
    PAID: 'Đã thanh toán',
    DISPENSING: 'Đang nhận hoa',
    COMPLETED: 'Đã nhận hoa',
    CANCELLED: 'Đã hủy',
    EXPIRED: 'Hết hạn thanh toán',
    DISPENSE_FAILED: 'Đang xử lý sự cố',
    REFUNDED: 'Đã hoàn tiền',
    DISPUTED: 'Đang xử lý phản ánh',
  };
  return (
    <>
      <main id="main" className="member-page">
        <h1>Góc nhỏ của {profile.data?.fullName || 'bạn'}</h1>
        <p>Thông tin thành viên và những dịp bạn gửi trao yêu thương.</p>
        <nav className="member-tabs" aria-label="Trong tài khoản">
          <a href="#member-profile">Hồ sơ cá nhân</a>
          <a href="#web-orders">Đơn đặt trước</a>
          <a href="#member-orders">Lịch sử mua</a>
          <a href="#member-security">Bảo mật</a>
          <a href="#member-shop">Shop của bạn</a>
        </nav>
        <p role="status">{notice}</p>
        <p role="alert" className="error">
          {error}
        </p>
        <section id="member-profile">
          <h2>Thông tin của bạn</h2>
          {profile.isPending ? (
            <p role="status">Đang tải hồ sơ…</p>
          ) : profile.isError ? (
            <>
              <p role="alert">Chưa tải được hồ sơ.</p>
              <Button onClick={() => void profile.refetch()}>Tải lại hồ sơ</Button>
            </>
          ) : (
            <>
              <dl className="bank-summary">
                <div>
                  <dt>Họ và tên</dt>
                  <dd>{profile.data.fullName}</dd>
                </div>
                <div>
                  <dt>Email đăng nhập</dt>
                  <dd>{profile.data.email}</dd>
                </div>
                <div>
                  <dt>Điểm tích lũy</dt>
                  <dd>{profile.data.loyaltyPoints.toLocaleString('vi-VN')} điểm</dd>
                </div>
              </dl>
              <div style={{ marginBlock: '1.25rem' }}>
                <Link href="/ho-so" className="button button-outline">
                  Xem và cập nhật hồ sơ cá nhân
                </Link>
              </div>
              <MemberGoogleLink email={profile.data.email} />
            </>
          )}
        </section>
        <WebRequests mode="member" />
        <section id="member-orders">
          <h2>Lịch sử mua hoa</h2>
          {history.isPending ? (
            <p role="status">Đang tải đơn hàng…</p>
          ) : history.isError ? (
            <>
              <p role="alert">Chưa tải được lịch sử.</p>
              <Button onClick={() => void history.refetch()}>Tải lại lịch sử</Button>
            </>
          ) : (
            <>
              {history.data.items.length ? (
                <ul className="member-orders">
                  {history.data.items.map((order) => (
                    <li key={order.id}>
                      <h3>
                        {order.shopName} · {order.orderCode}
                      </h3>
                      <p>
                        {statuses[order.status] || order.status} ·{' '}
                        {new Date(order.createdAt).toLocaleString('vi-VN')}
                      </p>
                      <p>{order.items.join(', ') || 'Hoa đặt theo yêu cầu'}</p>
                      <strong>{Number(order.totalAmount).toLocaleString('vi-VN')} đ</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="member-empty">
                  <h3>Một dịp tặng hoa đang đợi bạn</h3>
                  <p>Các đơn mua bằng tài khoản này sẽ được lưu ở đây.</p>
                  <Link href="/dat-hoa">Khám phá hoa và đặt theo yêu cầu</Link>
                </div>
              )}
              <nav className="stock-actions" aria-label="Phân trang lịch sử">
                <Button
                  variant="outline"
                  disabled={page === 1 || history.isFetching}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Trang trước
                </Button>
                <span>Trang {page}</span>
                <Button
                  variant="outline"
                  disabled={!history.data.hasMore || history.isFetching}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Trang sau
                </Button>
              </nav>
            </>
          )}
        </section>
        <section id="member-security">
          <h2>Đổi mật khẩu</h2>
          <p>Sau khi đổi, bạn cần đăng nhập lại trên các thiết bị.</p>
          <form
            noValidate
            onSubmit={passwords.handleSubmit(({ currentPassword, newPassword }) =>
              save({ currentPassword, newPassword }, true),
            )}
          >
            {(['currentPassword', 'newPassword', 'confirm'] as const).map((field, index) => (
              <div key={field}>
                <label htmlFor={`security-${field}`}>
                  {['Mật khẩu hiện tại', 'Mật khẩu mới', 'Nhập lại mật khẩu mới'][index]}
                </label>
                <input
                  id={`security-${field}`}
                  type="password"
                  autoComplete={index === 0 ? 'current-password' : 'new-password'}
                  {...passwords.register(field, {
                    required: 'Nhập mật khẩu.',
                    validate:
                      index === 1
                        ? passwordRule
                        : index === 2
                          ? (value) =>
                              value === passwords.getValues('newPassword') ||
                              'Hai mật khẩu chưa khớp.'
                          : undefined,
                  })}
                  aria-describedby={`security-${field}-error`}
                  aria-invalid={!!passwords.formState.errors[field]}
                />
                <p id={`security-${field}-error`} className="error">
                  {passwords.formState.errors[field]?.message}
                </p>
              </div>
            ))}
            <Button type="submit" disabled={busy}>
              Đổi mật khẩu và đăng nhập lại
            </Button>
          </form>
        </section>
        <MemberShop />
      </main>
    </>
  );
}
