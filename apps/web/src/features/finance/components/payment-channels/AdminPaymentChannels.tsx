'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import type { components } from '../../../../../../../packages/contracts/src/generated/api';
import { queryClient, request } from '@/shared/lib/api';
import '../../styles/commerce-subscriptions.css';

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
  const [message, setMessage] = useState('');
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
      setMessage('Đã gắn cấu hình. Cần xác thực trước khi shop nhận thanh toán.');
      await queryClient.invalidateQueries({ queryKey: ['admin-payment-channels'] });
    },
  });
  const verify = useMutation({
    mutationFn: (id: string) =>
      request<Verification>(`/sellers/${id}/payment-channel/verify`, {}, true, 'POST'),
    onSuccess: async (result) => {
      setMessage(result.message || (result.verified ? 'Đã xác thực.' : 'Chưa xác thực được.'));
      await queryClient.invalidateQueries({ queryKey: ['admin-payment-channels'] });
    },
  });
  return (
    <div className="business-stack">
      <section className="business-panel">
        <h2>Gắn cấu hình PayOS cho shop</h2>
        <p>
          Chỉ nhập mã tham chiếu cấu hình đã có trên máy chủ. Không nhập API key, checksum key hay
          thông tin bí mật vào trình duyệt.
        </p>
        <form
          className="business-form"
          onSubmit={(event) => {
            event.preventDefault();
            setMessage('');
            bind.mutate();
          }}
        >
          <label htmlFor="channel-seller-id">Seller ID</label>
          <input
            id="channel-seller-id"
            required
            pattern="[0-9a-fA-F-]{36}"
            value={sellerId}
            onChange={(event) => setSellerId(event.target.value)}
          />
          <label htmlFor="channel-secret-ref">Mã tham chiếu cấu hình</label>
          <input
            id="channel-secret-ref"
            required
            autoComplete="off"
            value={secretRef}
            onChange={(event) => setSecretRef(event.target.value)}
          />
          <Button disabled={bind.isPending} type="submit">
            {bind.isPending ? 'Đang gắn…' : 'Gắn kênh thanh toán'}
          </Button>
        </form>
        {bind.isError && <p role="alert">{bind.error.message}</p>}
        {message && <p role="status">{message}</p>}
      </section>
      <section className="business-panel">
        <div className="business-heading">
          <h2>Kênh thanh toán đã cấu hình</h2>
          <Button variant="outline" onClick={() => void channels.refetch()}>
            Làm mới
          </Button>
        </div>
        {channels.isPending ? (
          <p role="status">Đang tải…</p>
        ) : channels.isError ? (
          <p role="alert">{channels.error.message}</p>
        ) : channels.data?.length ? (
          <div className="business-table-scroll">
            <table className="business-table">
              <thead>
                <tr>
                  <th>Shop</th>
                  <th>Trạng thái</th>
                  <th>Tài khoản nhận</th>
                  <th>Phiên bản</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {channels.data.map((item) => (
                  <tr key={item.sellerId}>
                    <td>
                      <strong>{item.shopName}</strong>
                      <br />
                      <small>{item.sellerId}</small>
                    </td>
                    <td>{label[item.state] || item.state}</td>
                    <td>
                      {item.expectedBankName || item.expectedBankBin} ·{' '}
                      {item.expectedBankAccountMasked}
                    </td>
                    <td>{item.currentVersion}</td>
                    <td>
                      {item.state === 'PENDING_VERIFICATION' && (
                        <Button
                          variant="outline"
                          disabled={verify.isPending}
                          onClick={() => verify.mutate(item.sellerId)}
                        >
                          Xác thực
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>Chưa có kênh nào được cấu hình.</p>
        )}
        {verify.isError && <p role="alert">{verify.error.message}</p>}
      </section>
    </div>
  );
}
