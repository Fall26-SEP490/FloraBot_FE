'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import type { components } from '../../../../../../../packages/contracts/src/generated/api';
import EvidenceUpload from '@/shared/components/EvidenceUpload';
import { queryClient, request, type Session } from '@/shared/lib/api';
import '../../styles/commerce-subscriptions.css';

type Page = components['schemas']['SellerRefundPageResponse'];
type BaseDetail = components['schemas']['SellerRefundDetailResponse'];
type Detail = Omit<BaseDetail, 'submission'> & {
  submission?:
    | (NonNullable<BaseDetail['submission']> & {
        attemptCount?: number;
        reviewReason?: string | null;
      })
    | null;
};
type Bank = components['schemas']['RefundBankResponse'];
const money = (value: number | string | null | undefined) =>
  `${(Number(value) || 0).toLocaleString('vi-VN')} đ`;

const refundStatusLabels: Record<string, string> = {
  PENDING: 'Chờ xử lý',
  APPROVED: 'Đã duyệt hoàn',
  TRANSFERRED: 'Đã chuyển tiền',
  COMPLETED: 'Hoàn tất',
  REJECTED: 'Từ chối',
  CANCELLED: 'Đã hủy',
};

const refundStatusStyles: Record<string, { bg: string; color: string; border: string }> = {
  PENDING: { bg: '#fffbeb', color: '#92400e', border: '#fde68a' },
  APPROVED: { bg: '#edf5ea', color: '#1b5e20', border: '#c8dec4' },
  TRANSFERRED: { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' },
  COMPLETED: { bg: '#edf5ea', color: '#1b5e20', border: '#c8dec4' },
  REJECTED: { bg: '#fef2f2', color: '#991b1b', border: '#fecaca' },
  CANCELLED: { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' },
};

function RefundCard({ id, sellerId }: { id: string; sellerId: string }) {
  const base = `/sellers/${sellerId}/refunds/${id}`;
  const [bank, setBank] = useState<Bank | null>(null);
  const [reason, setReason] = useState('');
  const [providerReference, setProviderReference] = useState('');
  const [transferredAt, setTransferredAt] = useState('');
  const [evidenceTicket, setEvidenceTicket] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState('');
  const detail = useQuery({
    queryKey: ['seller-refund-detail', id],
    queryFn: () => request<Detail>(base),
  });
  useEffect(() => {
    const hide = () => {
      if (document.hidden) setBank(null);
    };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);
  useEffect(() => {
    if (!bank) return;
    const timer = window.setTimeout(() => setBank(null), 60_000);
    return () => window.clearTimeout(timer);
  }, [bank]);
  const reveal = useMutation({
    mutationFn: () =>
      request<Bank>(`${base}/bank-details`, { reason: reason.trim() }, true, 'POST'),
    onSuccess: setBank,
  });
  const submit = useMutation({
    mutationFn: () => {
      if (!bank || !detail.data)
        throw new Error('Cần mở lại tài khoản nhận hoàn tiền trước khi xác nhận.');
      return request(
        `${base}/submit-transfer`,
        {
          amount: Number(detail.data.amount),
          currency: 'VND',
          bankName: bank.bankName,
          bankHolder: bank.holder,
          accountNumber: bank.account,
          providerReference: providerReference.trim(),
          transferredAt: new Date(transferredAt).toISOString(),
          evidenceTicket,
        },
        true,
        'POST',
      );
    },
    onSuccess: async () => {
      setBank(null);
      setEvidenceTicket('');
      setConfirmed(false);
      setNotice('Đã gửi chứng từ chuyển khoản để quản trị viên đối chiếu.');
      await queryClient.invalidateQueries({ queryKey: ['seller-refund-detail', id] });
      await queryClient.invalidateQueries({ queryKey: ['seller-refunds', sellerId] });
    },
  });
  if (detail.isPending) return <p role="status">Đang tải khoản hoàn…</p>;
  if (detail.isError || !detail.data)
    return <p role="alert">{detail.error?.message || 'Không tìm thấy khoản hoàn.'}</p>;
  const item = detail.data;
  return (
    <div className="business-refund-detail">
      <h3>
        Đơn {item.orderCode} · <span className="refund-amount">{money(item.amount)}</span>
      </h3>
      <p>
        Trạng thái:{' '}
        <span
          className="refund-status-pill"
          data-status={item.status}
          style={
            refundStatusStyles[item.status]
              ? {
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '2px 10px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 600,
                  background: refundStatusStyles[item.status].bg,
                  color: refundStatusStyles[item.status].color,
                  border: `1px solid ${refundStatusStyles[item.status].border}`,
                }
              : undefined
          }
        >
          {refundStatusLabels[item.status] || item.status}
        </span>
        {item.isApproved ? ' · Đã được duyệt' : ' · Chờ duyệt'}
      </p>
      {item.status === 'PENDING' && (
        <p className="business-note">
          {!item.isApproved
            ? 'Chờ Admin duyệt yêu cầu trước khi chuyển khoản cho khách.'
            : item.submission?.status === 'PENDING_REVIEW'
              ? 'Đã gửi chứng từ. Chờ Admin đối chiếu để hoàn tất khoản hoàn.'
              : !item.canAccessBank
                ? 'Khách cần bổ sung tài khoản nhận hoàn trên biên nhận. Sau đó tải lại hồ sơ để tiếp tục.'
                : 'Mở tài khoản nhận hoàn, chuyển khoản cho khách rồi gửi mã giao dịch và ảnh chứng từ bên dưới.'}
        </p>
      )}
      {item.reason && <p>Lý do: {item.reason}</p>}
      {item.submission && (
        <div>
          <p>
            Chứng từ đã gửi: {item.submission.providerReference} · {item.submission.status}
            {item.submission.attemptCount != null
              ? ` · Lần gửi ${item.submission.attemptCount}/4`
              : ''}
          </p>
          {item.submission.reviewReason && (
            <p role="alert">Lý do quản trị viên từ chối chứng từ: {item.submission.reviewReason}</p>
          )}
        </div>
      )}
      {item.canAccessBank && (!item.submission || item.submission.status === 'REJECTED') && (
        <div className="business-form">
          <label htmlFor={`bank-reason-${id}`}>Lý do xem tài khoản nhận hoàn</label>
          <input
            id={`bank-reason-${id}`}
            minLength={5}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <Button
            variant="outline"
            disabled={reason.trim().length < 5 || reveal.isPending}
            onClick={() => reveal.mutate()}
          >
            Xem tài khoản nhận tiền
          </Button>
        </div>
      )}
      {bank && (
        <div className="business-note">
          <p>
            Ngân hàng: <strong>{bank.bankName}</strong>
          </p>
          <p>
            Chủ tài khoản: <strong>{bank.holder}</strong>
          </p>
          <p>
            Số tài khoản: <strong>{bank.account}</strong>
          </p>
          <p>Thông tin này tự ẩn sau 60 giây hoặc khi rời tab.</p>
        </div>
      )}
      {item.canSubmitTransfer &&
        bank &&
        (!item.submission || item.submission.status === 'REJECTED') && (
          <div className="business-form">
            <p>
              {item.submission?.status === 'REJECTED'
                ? 'Chứng từ trước đó bị từ chối. Vui lòng kiểm tra lại và gửi chứng từ chuyển khoản mới (tối đa 3 lần gửi lại).'
                : 'Chỉ gửi xác nhận sau khi bạn đã tự chuyển khoản đúng số tiền và tài khoản trên.'}
            </p>
            <label htmlFor={`refund-reference-${id}`}>Mã giao dịch ngân hàng</label>
            <input
              id={`refund-reference-${id}`}
              minLength={3}
              maxLength={100}
              value={providerReference}
              onChange={(event) => setProviderReference(event.target.value)}
            />
            <label htmlFor={`refund-time-${id}`}>Thời điểm chuyển khoản</label>
            <input
              id={`refund-time-${id}`}
              type="datetime-local"
              value={transferredAt}
              onChange={(event) => setTransferredAt(event.target.value)}
            />
            <EvidenceUpload
              id={`refund-proof-${id}`}
              endpoint={`/api/sellers/${sellerId}/refunds/${id}/evidence/upload`}
              onReference={setEvidenceTicket}
            />
            <label>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />{' '}
              Tôi đã chuyển đúng {money(item.amount)} và đối chiếu tài khoản người nhận.
            </label>
            <Button
              disabled={
                submit.isPending ||
                !confirmed ||
                !evidenceTicket ||
                providerReference.trim().length < 3 ||
                !transferredAt
              }
              onClick={() => submit.mutate()}
            >
              Gửi xác nhận chuyển khoản
            </Button>
          </div>
        )}
      {notice && <p role="status">{notice}</p>}
      {(reveal.isError || submit.isError) && (
        <p role="alert">{reveal.error?.message || submit.error?.message}</p>
      )}
    </div>
  );
}

export default function SellerRefunds({ session }: { session: Session }) {
  const sellerId = session.sellerId;
  const [page, setPage] = useState(1);
  const refunds = useQuery({
    queryKey: ['seller-refunds', sellerId, page],
    enabled: Boolean(sellerId),
    queryFn: () => request<Page>(`/sellers/${sellerId}/refunds?page=${page}&pageSize=10`),
  });
  if (!sellerId) return <p role="alert">Tài khoản chưa liên kết với shop.</p>;
  return (
    <section className="business-panel">
      <div className="business-heading">
        <div>
          <h2>Hoàn tiền trực tiếp</h2>
          <p>Khoản hoàn đã duyệt cần được shop chuyển khoản và gửi chứng từ để đối chiếu.</p>
        </div>
        <Button variant="outline" onClick={() => void refunds.refetch()}>
          Làm mới
        </Button>
      </div>
      {refunds.isPending ? (
        <p role="status">Đang tải khoản hoàn…</p>
      ) : refunds.isError ? (
        <p role="alert">{refunds.error.message}</p>
      ) : refunds.data?.items.length ? (
        <div className="business-card-list">
          {refunds.data.items.map((item) => (
            <details className="business-card" key={item.id}>
              <summary className="refund-summary-head">
                <div className="refund-summary-main">
                  <span className="refund-order-code">Đơn {item.orderCode}</span>
                  <span className="refund-amount">{money(item.amount)}</span>
                </div>
                <div className="refund-summary-meta">
                  <span
                    className="refund-status-pill"
                    data-status={item.status}
                    style={
                      refundStatusStyles[item.status]
                        ? {
                            background: refundStatusStyles[item.status].bg,
                            color: refundStatusStyles[item.status].color,
                            borderColor: refundStatusStyles[item.status].border,
                          }
                        : undefined
                    }
                  >
                    {refundStatusLabels[item.status] || item.status}
                  </span>
                  <span className="refund-toggle-arrow" aria-hidden="true">
                    ▾
                  </span>
                </div>
              </summary>
              <RefundCard id={item.id} sellerId={sellerId} />
            </details>
          ))}
        </div>
      ) : (
        <p>Chưa có khoản hoàn trực tiếp.</p>
      )}
      {refunds.data && (
        <div className="business-pagination">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Trước
          </Button>
          <span>Trang {page}</span>
          <Button
            variant="outline"
            disabled={!refunds.data.hasMore}
            onClick={() => setPage(page + 1)}
          >
            Sau
          </Button>
        </div>
      )}
    </section>
  );
}
