'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button, ArrowRight, RefreshCw } from '@florabot/ui';
import { ApiError, queryClient, request, sessionQuery, type Session } from './api';
import type { KioskApplicationResponse } from './kioskApplicationTypes';
import { KIOSK_STATUS_LABELS } from './kioskApplicationTypes';

type Fields = { shopName: string; phone: string; address: string };

export default function MemberShop() {
  const session = useQuery(sessionQuery);
  const router = useRouter();
  const form = useForm<Fields>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const currentApp = useQuery({
    queryKey: ['current-kiosk-application', session.data?.id],
    queryFn: async () => {
      try {
        return await request<KioskApplicationResponse>('/member/kiosk-applications/current');
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          return null;
        }
        throw err;
      }
    },
    enabled: !!session.data,
  });

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
    <section id="member-shop" aria-labelledby="member-shop-title" className="account-section-card">
      <h2 id="member-shop-title">Cùng FloraBot mở shop hoa</h2>

      {session.isPending || (!!session.data && currentApp.isLoading) ? (
        <p role="status">
          <RefreshCw className="spin" size={16} aria-hidden="true" /> Đang kiểm tra thông tin shop…
        </p>
      ) : session.isError ? (
        <>
          <p role="alert">Chưa kiểm tra được shop của bạn.</p>
          <Button onClick={() => void session.refetch()}>Thử lại</Button>
        </>
      ) : session.data.sellerId ? (
        <div className="member-shop-existing">
          <p>Bạn có thể mua hoa và quản lý shop bằng tài khoản này.</p>
          <Link href="/seller" className="button button-primary">
            Vào shop của bạn
          </Link>
        </div>
      ) : currentApp.isError ? (
        <>
          <p role="alert">Chưa tải được hồ sơ thuê kiosk từ máy chủ.</p>
          <Button onClick={() => void currentApp.refetch()}>Thử lại</Button>
        </>
      ) : currentApp.data?.status &&
        currentApp.data.status !== 'CANCELLED' &&
        currentApp.data.status !== 'REJECTED' &&
        currentApp.data.status !== 'REFUNDED' ? (
        <div className="member-shop-in-progress">
          <p>
            Bạn đang có một hồ sơ đăng ký thuê kiosk hoa:{' '}
            <strong>{currentApp.data.shopName}</strong> ( Gói: {currentApp.data.packageName}).
          </p>
          <p>
            Trạng thái hiện tại:{' '}
            <strong>{KIOSK_STATUS_LABELS[currentApp.data.status] || currentApp.data.status}</strong>
          </p>
          <div style={{ marginTop: '1rem' }}>
            <Link href="/thue-kiosk" className="button button-primary">
              <ArrowRight size={18} aria-hidden="true" />
              Xem tiến độ hồ sơ thuê kiosk
            </Link>
          </div>
        </div>
      ) : (
        <div className="member-shop-cta-box">
          <p className="account-section-desc">
            Trở thành Chủ shop hoa FloraBot thông qua mô hình kiosk thông minh 2 phân vùng (vãng lai
            và đặt trước). Giữ nguyên tài khoản thành viên, lịch sử mua hoa và điểm tích lũy của
            bạn.
          </p>

          <form noValidate onSubmit={form.handleSubmit(submit)} style={{ marginTop: '1rem' }}>
            <div>
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
            </div>
            <div>
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
            </div>
            <div>
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
            </div>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'center',
                marginTop: '1rem',
                flexWrap: 'wrap',
              }}
            >
              <Button type="submit" disabled={busy}>
                {busy ? 'Đang gửi yêu cầu…' : 'Đăng ký mở shop'}
              </Button>
              <Link
                href="/thue-kiosk"
                className="button button-outline"
                id="open-kiosk-application-link"
              >
                Tìm hiểu các gói thuê kiosk
              </Link>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
