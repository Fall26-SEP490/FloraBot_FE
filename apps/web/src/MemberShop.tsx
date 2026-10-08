import { useState } from 'react';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { ApiError, queryClient, request, sessionQuery, type Session } from './api';

type Fields = { shopName: string; phone: string; address: string };

export default function MemberShop() {
  const session = useQuery(sessionQuery);
  const router = useRouter();
  const form = useForm<Fields>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(values: Fields) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const next = await request<Session>('/member/shop', values);
      queryClient.clear();
      queryClient.setQueryData(['session'], next);
      router.push('/seller');
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Chưa xác nhận được kết quả. Bạn có thể gửi lại cùng thông tin; hệ thống chỉ tạo một shop cho tài khoản.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section id="member-shop" aria-labelledby="member-shop-title">
      <h2 id="member-shop-title">Cùng FloraBot mở shop hoa</h2>
      {session.isPending ? (
        <p role="status">Đang kiểm tra tài khoản…</p>
      ) : session.isError ? (
        <>
          <p role="alert">Chưa kiểm tra được shop của bạn.</p>
          <Button onClick={() => void session.refetch()}>Thử lại</Button>
        </>
      ) : session.data.sellerId ? (
        <>
          <p>Bạn có thể mua hoa và quản lý shop bằng tài khoản này.</p>
          <Link href="/seller">Vào shop của bạn</Link>
        </>
      ) : (
        <>
          <p>
            Giữ nguyên tài khoản, lịch sử mua và điểm tích lũy. Shop mới cần được duyệt và kích hoạt
            gói trước khi bán hoa.
          </p>
          <form noValidate onSubmit={form.handleSubmit(submit)}>
            <label htmlFor="shop-name">Tên shop</label>
            <input
              id="shop-name"
              maxLength={120}
              {...form.register('shopName', {
                validate: (value) => value.trim().length >= 2 || 'Tên shop cần ít nhất 2 ký tự.',
              })}
              aria-invalid={!!form.formState.errors.shopName}
              aria-describedby="shop-name-error"
            />
            <p id="shop-name-error" className="error">
              {form.formState.errors.shopName?.message}
            </p>
            <label htmlFor="shop-phone">Số điện thoại shop</label>
            <input
              id="shop-phone"
              type="tel"
              autoComplete="tel"
              {...form.register('phone', {
                required: 'Nhập số điện thoại.',
                pattern: {
                  value: /^(0[35789][0-9]{8}|\+84[35789][0-9]{8})$/,
                  message: 'Nhập số điện thoại Việt Nam hợp lệ.',
                },
              })}
              aria-invalid={!!form.formState.errors.phone}
              aria-describedby="shop-phone-error"
            />
            <p id="shop-phone-error" className="error">
              {form.formState.errors.phone?.message}
            </p>
            <label htmlFor="shop-address">Địa chỉ shop</label>
            <input
              id="shop-address"
              autoComplete="street-address"
              maxLength={200}
              {...form.register('address', {
                validate: (value) => !!value.trim() || 'Nhập địa chỉ shop.',
              })}
              aria-invalid={!!form.formState.errors.address}
              aria-describedby="shop-address-error"
            />
            <p id="shop-address-error" className="error">
              {form.formState.errors.address?.message}
            </p>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? 'Đang gửi yêu cầu…' : 'Đăng ký mở shop'}
            </Button>
          </form>
        </>
      )}
    </section>
  );
}
