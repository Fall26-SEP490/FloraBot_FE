'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, RefreshCw } from '@florabot/ui';
import type { components } from '../../../../../../../packages/contracts/src/generated/api';
import { queryClient, request } from '@/shared/lib/api';
import './admin-payment-channels.css';

type Channel = components['schemas']['AdminPaymentChannelItemResponse'];
type Verification = components['schemas']['ChannelVerificationResponse'];
const label: Record<string, string> = {
  ACTIVE: 'Đã kích hoạt',
  PENDING_VERIFICATION: 'Chờ xác thực',
  PAUSED: 'Tạm dừng',
};

export default function AdminPaymentChannels() {
  const [sellerId, setSellerId] = useState('');
  const [secretRef, setSecretRef] = useState('');
  const channels = useQuery({
    queryKey: ['admin-payment-channels'],
    queryFn: () => request<Channel[]>('/admin/payment-channels'),
  });
  const bind = useMutation({
    mutationFn: () =>
      request(
        `/sellers/${sellerId.trim()}/payment-channel`,
        { secretRef: secretRef.trim() },
        true,
        'PUT',
      ),
    onSuccess: async () => {
      setSecretRef('');
      await queryClient.invalidateQueries({ queryKey: ['admin-payment-channels'] });
    },
  });
  const verify = useMutation({
    mutationFn: (id: string) =>
      request<Verification>(`/sellers/${id}/payment-channel/verify`, {}, true, 'POST'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-payment-channels'] });
    },
  });
  return (
    <div className="admin-payment-channels">
      <section className="admin-surface" aria-labelledby="bind-channel-title">
        <div className="admin-section-heading">
          <div>
            <h2 id="bind-channel-title">Gắn cấu hình PayOS</h2>
            <p>Dùng mã tham chiếu đã tạo trên máy chủ. Giữ API key và checksum key trên máy chủ.</p>
          </div>
        </div>
        <form
          className="admin-channel-form"
          onSubmit={(event) => {
            event.preventDefault();
            bind.mutate();
          }}
        >
          <div>
            <label htmlFor="channel-seller-id">Mã shop (Seller ID)</label>
            <input
              id="channel-seller-id"
              required
              pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
              spellCheck={false}
              value={sellerId}
              onChange={(event) => setSellerId(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="channel-secret-ref">Mã tham chiếu cấu hình</label>
            <input
              id="channel-secret-ref"
              required
              autoComplete="off"
              spellCheck={false}
              value={secretRef}
              onChange={(event) => setSecretRef(event.target.value)}
            />
          </div>
          <Button disabled={bind.isPending} type="submit">
            {bind.isPending ? 'Đang gắn…' : 'Gắn kênh thanh toán'}
          </Button>
        </form>
        {bind.isError && (
          <p className="error" role="alert">
            {bind.error.message}
          </p>
        )}
        {bind.isSuccess && (
          <p className="admin-channel-feedback" role="status">
            Đã gắn cấu hình. Chọn Xác thực ở kênh của shop để tiếp tục.
          </p>
        )}
      </section>
      <section className="admin-surface" aria-labelledby="channel-list-title">
        <div className="admin-section-heading">
          <div>
            <h2 id="channel-list-title">Kênh đã cấu hình</h2>
            <p>Kiểm tra tài khoản nhận tiền và xác thực các kênh đang chờ.</p>
          </div>
          <Button
            variant="outline"
            disabled={channels.isFetching}
            onClick={() => void channels.refetch()}
          >
            <RefreshCw size={16} aria-hidden="true" />
            {channels.isFetching ? 'Đang cập nhật…' : 'Cập nhật danh sách'}
          </Button>
        </div>
        {verify.isSuccess && (
          <p className="admin-channel-feedback" role="status">
            {verify.data.message ||
              (verify.data.verified ? 'Đã xác thực kênh.' : 'Chưa xác thực được kênh.')}
          </p>
        )}
        {verify.isError && (
          <p className="error" role="alert">
            {verify.error.message}
          </p>
        )}
        {channels.isPending ? (
          <p className="admin-channel-empty" role="status">
            Đang tải kênh thanh toán…
          </p>
        ) : channels.isError ? (
          <p className="error" role="alert">
            {channels.error.message}
          </p>
        ) : channels.data?.length ? (
          <ul className="admin-channel-list">
            {channels.data.map((item) => (
              <li key={item.sellerId}>
                <div className="admin-channel-shop">
                  <h3>{item.shopName}</h3>
                  <small>Mã shop {item.sellerId}</small>
                </div>
                <span className="admin-channel-state" data-state={item.state}>
                  {label[item.state] || item.state}
                </span>
                <dl className="admin-channel-details">
                  <div>
                    <dt>Tài khoản nhận</dt>
                    <dd>
                      {item.expectedBankName || item.expectedBankBin} ·{' '}
                      {item.expectedBankAccountMasked}
                    </dd>
                  </div>
                  <div>
                    <dt>Phiên bản</dt>
                    <dd>{item.currentVersion}</dd>
                  </div>
                </dl>
                {item.state === 'PENDING_VERIFICATION' && (
                  <Button
                    variant="outline"
                    disabled={verify.isPending}
                    aria-label={`Xác thực kênh của ${item.shopName}`}
                    onClick={() => verify.mutate(item.sellerId)}
                  >
                    {verify.isPending && verify.variables === item.sellerId
                      ? 'Đang xác thực…'
                      : 'Xác thực'}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="admin-calm-empty">
            <h3>Chưa có kênh thanh toán</h3>
            <p>Gắn cấu hình PayOS để thêm kênh nhận tiền cho shop.</p>
          </div>
        )}
      </section>
    </div>
  );
}
