'use client';

import SellerPagination from '@/shared/components/SellerPagination';
import IconActionButton from '@/shared/components/IconActionButton';
import RefreshRegion from '@/shared/components/RefreshRegion';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import type { components } from '../../../../../../../packages/contracts/src/generated/api';
import { ApiError, queryClient, request, type Session } from '@/shared/lib/api';
import ShopBankSection from './ShopBankSection';
import '../../styles/commerce-subscriptions.css';
import '../../styles/seller-finance.css';

type Channel = components['schemas']['SellerPaymentChannelResponse'];
type Verification = components['schemas']['ChannelVerificationResponse'];
type Payments = components['schemas']['SellerPaymentsListResponse'];
type Report = components['schemas']['SellerSalesReportResponse'];
type Loyalty = components['schemas']['SellerLoyaltySettingsResponse'];

const currency = (value: number | string | null | undefined) => {
  const num = Number(value);
  return `${(Number.isFinite(num) ? num : 0).toLocaleString('vi-VN')} đ`;
};
const dateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—';
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : 'Chưa xử lý được yêu cầu.';
const channelLabels: Record<string, string> = {
  ACTIVE: 'Đã kích hoạt',
  PENDING_VERIFICATION: 'Chờ xác thực',
  PAUSED: 'Tạm dừng',
};

export default function SellerCommerce({ session }: { session: Session }) {
  const sellerId = session.sellerId;
  const base = `/sellers/${sellerId}`;
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState('');
  const channel = useQuery({
    queryKey: ['seller-payment-channel', sellerId],
    enabled: Boolean(sellerId),
    queryFn: async () => {
      try {
        return await request<Channel>(`${base}/payment-channel`);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
  });
  const payments = useQuery({
    queryKey: ['seller-direct-payments', sellerId, page],
    enabled: Boolean(sellerId),
    queryFn: () => request<Payments>(`${base}/payments?page=${page}&pageSize=10`),
  });
  const report = useQuery({
    queryKey: ['seller-direct-sales', sellerId],
    enabled: Boolean(sellerId),
    queryFn: () => request<Report>(`${base}/reports/sales`),
  });
  const loyalty = useQuery({
    queryKey: ['seller-loyalty-settings', sellerId],
    enabled: Boolean(sellerId),
    queryFn: () => request<Loyalty>(`${base}/loyalty-settings`),
  });
  const verify = useMutation({
    mutationFn: () => request<Verification>(`${base}/payment-channel/verify`, {}, true, 'POST'),
    onSuccess: async (result) => {
      setNotice(
        result.message ||
          (result.verified ? 'Đã xác thực kênh thanh toán.' : 'Chưa xác thực được kênh.'),
      );
      await queryClient.invalidateQueries({ queryKey: ['seller-payment-channel', sellerId] });
    },
  });
  const changeChannelStatus = useMutation({
    mutationFn: (status: 'ACTIVE' | 'PAUSED') =>
      request<Channel>(`${base}/payment-channel/status`, { status }, true, 'PATCH'),
    onSuccess: async () =>
      queryClient.invalidateQueries({ queryKey: ['seller-payment-channel', sellerId] }),
  });
  const reconcile = useMutation({
    mutationFn: (paymentId: string) =>
      request(`${base}/payments/${paymentId}/reconcile`, {}, true, 'POST'),
    onSuccess: async () => {
      setNotice('Đã tra cứu lại giao dịch từ PayOS.');
      await queryClient.invalidateQueries({ queryKey: ['seller-direct-payments', sellerId] });
      await queryClient.invalidateQueries({ queryKey: ['seller-direct-sales', sellerId] });
    },
  });
  const updateLoyalty = useMutation({
    mutationFn: (enabled: boolean) =>
      request<Loyalty>(`${base}/loyalty-settings`, { enabled }, true, 'PUT'),
    onSuccess: async () =>
      queryClient.invalidateQueries({ queryKey: ['seller-loyalty-settings', sellerId] }),
  });

  if (!sellerId) return <p role="alert">Tài khoản chưa liên kết với shop.</p>;
  return (
    <RefreshRegion className="seller-finance">
      <div className="business-stack seller-commerce">
        {/* 1. Ngân hàng shop: dùng làm thông tin nhận hoàn phí thuê kiosk */}
        <ShopBankSection
          sellerId={sellerId}
          sectionId="shop-bank-heading"
          title="Ngân hàng nhận hoàn phí"
          compact
        />

        {/* 2. Kênh PayOS Seller: dùng nhận tiền bán hoa từ kiosk */}
        <section className="business-panel seller-channel" aria-labelledby="seller-channel-title">
          <div className="business-heading">
            <div>
              <h2 id="seller-channel-title">Kênh nhận tiền PayOS</h2>
              <p>Nhận tiền bán hoa từ khách hàng.</p>
            </div>
            <IconActionButton
              variant="outline"
              onClick={() =>
                Promise.all([
                  channel.refetch(),
                  report.refetch(),
                  payments.refetch(),
                  loyalty.refetch(),
                  queryClient.refetchQueries({ queryKey: ['seller-shop-bank', sellerId] }),
                ])
              }
              disabled={
                channel.isFetching || payments.isFetching || report.isFetching || loyalty.isFetching
              }
              action="reload"
              label="Làm mới"
            />
          </div>
          {channel.isPending ? (
            <p role="status">Đang kiểm tra kênh thanh toán…</p>
          ) : channel.isError ? (
            <p role="alert">{errorText(channel.error)}</p>
          ) : channel.data ? (
            <>
              <div className="channel-ready-card">
                <div className="finance-channel-status">
                  <span className="finance-status" data-finance-state={channel.data.state}>
                    {channelLabels[channel.data.state] || channel.data.state}
                  </span>
                </div>
                <div className="business-facts channel-bank-facts">
                  <div>
                    <span>Chủ tài khoản</span>
                    <strong>{channel.data.expectedBankName || 'Chưa cập nhật'}</strong>
                  </div>
                  <div>
                    <span>Số tài khoản</span>
                    <strong>{channel.data.expectedBankAccountMasked}</strong>
                  </div>
                </div>
              </div>
              {channel.data.state !== 'ACTIVE' && (
                <p className="business-note">
                  Shop chưa thể nhận thanh toán đơn hoa mới. Quản trị viên cần gắn cấu hình PayOS
                  của shop và xác thực kênh.
                </p>
              )}
              <div className="finance-settings-actions">
                {channel.data.state === 'PENDING_VERIFICATION' && (
                  <Button
                    variant="outline"
                    disabled={verify.isPending}
                    onClick={() => verify.mutate()}
                  >
                    {verify.isPending ? 'Đang xác thực…' : 'Kiểm tra xác thực PayOS'}
                  </Button>
                )}
                {channel.data.state === 'ACTIVE' && (
                  <Button
                    variant="outline"
                    disabled={changeChannelStatus.isPending}
                    onClick={() => changeChannelStatus.mutate('PAUSED')}
                  >
                    Tạm dừng nhận thanh toán mới
                  </Button>
                )}
                {channel.data.state === 'PAUSED' && (
                  <Button
                    variant="outline"
                    disabled={changeChannelStatus.isPending}
                    onClick={() => changeChannelStatus.mutate('ACTIVE')}
                  >
                    Mở lại kênh thanh toán
                  </Button>
                )}
              </div>
            </>
          ) : (
            <p className="business-note">
              Chưa có kênh PayOS của shop. Hãy liên hệ quản trị viên để gắn cấu hình trước khi nhận
              thanh toán.
            </p>
          )}
          {notice && <p role="status">{notice}</p>}
          {(verify.isError || changeChannelStatus.isError) && (
            <p role="alert">{errorText(verify.error || changeChannelStatus.error)}</p>
          )}
        </section>
        <section className="business-panel seller-receipts" aria-labelledby="seller-receipts-title">
          <h2 id="seller-receipts-title">Giao dịch bán hoa</h2>
          {report.isPending ? (
            <p role="status">Đang tải doanh số…</p>
          ) : report.isError ? (
            <p role="alert">{errorText(report.error)}</p>
          ) : (
            report.data && (
              <div className="business-facts">
                <div>
                  <span>Đã thanh toán</span>
                  <strong>{currency(report.data.grossPaid)}</strong>
                </div>
                <div>
                  <span>Đã hoàn</span>
                  <strong>{currency(report.data.totalRefunded)}</strong>
                </div>
                <div>
                  <span>Doanh thu sau hoàn tiền</span>
                  <strong>{currency(report.data.netReceipts)}</strong>
                </div>
                <div>
                  <span>Đơn đã trả tiền</span>
                  <strong>{report.data.paidOrders}</strong>
                </div>
              </div>
            )
          )}
          {payments.isPending ? (
            <p role="status">Đang tải giao dịch…</p>
          ) : payments.isError ? (
            <p role="alert">{errorText(payments.error)}</p>
          ) : (
            payments.data &&
            ((payments.data.payments ?? []).length ? (
              <>
                <div className="business-table-scroll">
                  <table className="business-table">
                    <thead>
                      <tr>
                        <th>Giao dịch</th>
                        <th>Số tiền</th>
                        <th>Trạng thái</th>
                        <th>Thời gian</th>
                        <th>Tài khoản nhận</th>
                        <th>Kiểm tra</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(payments.data.payments ?? []).map((payment) => (
                        <tr key={payment.id}>
                          <td>{payment.orderCode || payment.id.slice(0, 8)}</td>
                          <td>{currency(payment.amount)}</td>
                          <td>
                            <span className="finance-status" data-finance-state={payment.status}>
                              {(
                                {
                                  PAID: 'Đã thanh toán',
                                  SUCCEEDED: 'Đã thanh toán',
                                  PENDING: 'Chờ thanh toán',
                                  CANCELLED: 'Đã hủy',
                                  CANCELED: 'Đã hủy',
                                  FAILED: 'Thanh toán thất bại',
                                  EXPIRED: 'Hết hạn',
                                  REFUNDED: 'Đã hoàn tiền',
                                } as Record<string, string>
                              )[payment.status] || payment.status}
                            </span>
                          </td>
                          <td>{dateTime(payment.paidAt || payment.createdAt)}</td>
                          <td>{payment.receiverAccountMasked || '—'}</td>
                          <td>
                            {payment.status === 'PENDING' && (
                              <Button
                                variant="outline"
                                disabled={reconcile.isPending}
                                onClick={() => reconcile.mutate(payment.id)}
                              >
                                Đối soát
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {(page > 1 || Number(payments.data.totalCount) > 10) && (
                  <SellerPagination
                    page={page}
                    totalPages={Math.max(1, Math.ceil(Number(payments.data.totalCount) / 10))}
                    busy={payments.isFetching}
                    onPageChange={setPage}
                  />
                )}
              </>
            ) : (
              <p>Chưa có giao dịch bán hoa trực tiếp.</p>
            ))
          )}
          {reconcile.isError && <p role="alert">{errorText(reconcile.error)}</p>}
        </section>
        <section className="business-panel seller-loyalty" aria-labelledby="seller-loyalty-title">
          <h2 id="seller-loyalty-title">Tích điểm theo shop</h2>
          <p>Tích điểm 1% cho đơn đặt trước hoàn tất. Không áp dụng mua trực tiếp tại tủ.</p>
          {loyalty.isPending ? (
            <p role="status">Đang tải cài đặt…</p>
          ) : loyalty.isError ? (
            <p role="alert">{errorText(loyalty.error)}</p>
          ) : (
            loyalty.data && (
              <div className="business-inline">
                <span
                  className="status-pill"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '13px',
                    fontWeight: 600,
                    background: loyalty.data.enabled ? '#edf5ea' : '#f3f4f6',
                    color: loyalty.data.enabled ? '#1b5e20' : '#374151',
                    border: `1px solid ${loyalty.data.enabled ? '#c8dec4' : '#d1d5db'}`,
                  }}
                >
                  {loyalty.data.enabled ? 'Đang bật tích điểm' : 'Đang tắt tích điểm'}
                </span>
                <Button
                  variant="outline"
                  disabled={updateLoyalty.isPending}
                  onClick={() => updateLoyalty.mutate(!loyalty.data!.enabled)}
                >
                  {updateLoyalty.isPending
                    ? 'Đang lưu…'
                    : loyalty.data.enabled
                      ? 'Tắt tích điểm'
                      : 'Bật tích điểm'}
                </Button>
              </div>
            )
          )}
          {updateLoyalty.isError && <p role="alert">{errorText(updateLoyalty.error)}</p>}
        </section>
      </div>
    </RefreshRegion>
  );
}
