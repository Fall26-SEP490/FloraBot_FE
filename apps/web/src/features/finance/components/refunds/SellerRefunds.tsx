'use client';

import SellerPagination from '@/shared/components/SellerPagination';
import IconActionButton from '@/shared/components/IconActionButton';
import RefreshRegion from '@/shared/components/RefreshRegion';
import { Modal } from '@/shared/components/Modal';
import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import type { components } from '../../../../../../../packages/contracts/src/generated/api';
import EvidenceUpload from '@/shared/components/EvidenceUpload';
import VietnamDateInput from '@/shared/components/VietnamDateInput';
import { vietnamDateTimeToUtc } from '@/shared/lib/vietnam-date';
import { queryClient, request, type Session } from '@/shared/lib/api';
import '../../styles/commerce-subscriptions.css';
import '../../styles/seller-finance.css';

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

function refundStatusLabel(item: {
  status: string;
  isApproved: boolean;
  submissionStatus?: string | null;
  submission?: { status: string } | null;
}) {
  if (item.status === 'PENDING') {
    if ((item.submission?.status ?? item.submissionStatus) === 'PENDING_REVIEW') {
      return 'Chờ đối chiếu';
    }
    return item.isApproved ? 'Chờ chuyển tiền' : 'Chờ duyệt';
  }
  return refundStatusLabels[item.status] || item.status;
}

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
  const [transferDraftOpen, setTransferDraftOpen] = useState(false);
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
      if (document.hidden) {
        setBank(null);
        setConfirmed(false);
      }
    };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);
  useEffect(() => {
    if (!bank) return;
    const timer = window.setTimeout(() => {
      setBank(null);
      setConfirmed(false);
    }, 60_000);
    return () => window.clearTimeout(timer);
  }, [bank]);
  const reveal = useMutation({
    mutationFn: () =>
      request<Bank>(`${base}/bank-details`, { reason: reason.trim() }, true, 'POST'),
    onSuccess: (details) => {
      setTransferDraftOpen(true);
      if (!document.hidden) setBank(details);
    },
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
          transferredAt: vietnamDateTimeToUtc(transferredAt),
          evidenceTicket,
        },
        true,
        'POST',
      );
    },
    onSuccess: async () => {
      setBank(null);
      setTransferDraftOpen(false);
      setProviderReference('');
      setTransferredAt('');
      setEvidenceTicket('');
      setConfirmed(false);
      setNotice('Đã gửi chứng từ chuyển khoản để quản trị viên đối chiếu.');
      await queryClient.invalidateQueries({ queryKey: ['seller-refund-detail', id] });
      await queryClient.invalidateQueries({ queryKey: ['seller-refunds', sellerId] });
    },
  });
  if (detail.isPending) return <p role="status">Đang tải khoản hoàn…</p>;
  if (!detail.data)
    return <p role="alert">{detail.error?.message || 'Không tìm thấy khoản hoàn.'}</p>;
  const item = detail.data;
  return (
    <div className="business-refund-detail">
      {detail.isError && (
        <div role="alert">
          Chưa tải được trạng thái mới. Bản nháp vẫn được giữ.
          <IconActionButton
            variant="outline"
            onClick={() => detail.refetch()}
            disabled={detail.isFetching}
            action="reload"
            label="Tải lại khoản hoàn"
          />
        </div>
      )}
      <div className="refund-detail-heading">
        <h3>Đơn {item.orderCode}</h3>
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
          {refundStatusLabel(item)}
        </span>
      </div>
      <div className="refund-detail-amount">
        <span>Số tiền hoàn</span>
        <strong>{money(item.amount)}</strong>
      </div>
      {item.status === 'PENDING' && (
        <p className="business-note">
          {!item.isApproved
            ? 'Chờ Admin duyệt yêu cầu trước khi chuyển khoản cho khách.'
            : item.submission?.status === 'PENDING_REVIEW'
              ? 'Đã gửi chứng từ. Chờ Admin đối chiếu để hoàn tất khoản hoàn.'
              : !item.canAccessBank
                ? 'Khách cần bổ sung tài khoản nhận hoàn trên biên nhận. Sau đó tải lại hồ sơ để tiếp tục.'
                : 'Chuyển khoản cho khách và gửi chứng từ để đối chiếu.'}
        </p>
      )}
      {item.reason && (
        <div className="refund-detail-reason">
          <span>Lý do hoàn tiền</span>
          <p>{item.reason.replace(/^AUTO_REFUND:\s*/i, 'Hoàn tự động: ')}</p>
        </div>
      )}
      {item.submission && (
        <div>
          <p>
            Chứng từ: {item.submission.providerReference} ·{' '}
            {(
              {
                PENDING_REVIEW: 'Chờ đối chiếu',
                REJECTED: 'Bị từ chối',
                CONFIRMED: 'Đã đối chiếu',
              } as Record<string, string>
            )[item.submission.status] || item.submission.status}
            {item.submission.attemptCount != null
              ? ` · Chứng từ lần ${item.submission.attemptCount}`
              : ''}
          </p>
          {item.submission.reviewReason && (
            <p role="alert">Lý do quản trị viên từ chối chứng từ: {item.submission.reviewReason}</p>
          )}
        </div>
      )}
      {item.canAccessBank && (!item.submission || item.submission.status === 'REJECTED') && (
        <div className="business-form">
          <label htmlFor={`bank-reason-${id}`}>
            Lý do xem tài khoản nhận hoàn{' '}
            <span className="finance-required" aria-hidden="true">
              *
            </span>
          </label>
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
            {transferDraftOpen && !bank
              ? 'Hiện lại tài khoản nhận tiền'
              : 'Xem tài khoản nhận tiền'}
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
        transferDraftOpen &&
        (!item.submission || item.submission.status === 'REJECTED') && (
          <div className="business-form">
            <p>
              {item.submission?.status === 'REJECTED'
                ? 'Chứng từ trước đó bị từ chối. Vui lòng kiểm tra lại và gửi chứng từ chuyển khoản mới (tối đa 3 lần gửi lại).'
                : 'Chỉ gửi xác nhận sau khi bạn đã tự chuyển khoản đúng số tiền và tài khoản trên.'}
            </p>
            <label htmlFor={`refund-reference-${id}`}>
              Mã giao dịch ngân hàng{' '}
              <span className="finance-required" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id={`refund-reference-${id}`}
              minLength={3}
              maxLength={100}
              value={providerReference}
              onChange={(event) => setProviderReference(event.target.value)}
            />
            <label htmlFor={`refund-time-${id}`}>
              Thời điểm chuyển khoản{' '}
              <span className="finance-required" aria-hidden="true">
                *
              </span>
            </label>
            <VietnamDateInput
              id={`refund-time-${id}`}
              kind="datetime-local"
              label="Thời điểm chuyển khoản"
              required
              value={transferredAt}
              onValueChange={setTransferredAt}
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
            {!bank && (
              <div>
                <p>Bản nháp vẫn còn. Hiện lại tài khoản để đối chiếu trước khi gửi.</p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={reason.trim().length < 5 || reveal.isPending}
                  onClick={() => reveal.mutate()}
                >
                  {reveal.isPending ? 'Đang lấy tài khoản…' : 'Hiện lại tài khoản nhận tiền'}
                </Button>
              </div>
            )}
            <Button
              disabled={
                submit.isPending ||
                detail.isError ||
                !bank ||
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const refunds = useQuery({
    queryKey: ['seller-refunds', sellerId, page],
    enabled: Boolean(sellerId),
    queryFn: () => request<Page>(`/sellers/${sellerId}/refunds?page=${page}&pageSize=10`),
  });
  if (!sellerId) return <p role="alert">Tài khoản chưa liên kết với shop.</p>;
  return (
    <RefreshRegion className="seller-finance">
      <section className="business-panel seller-refunds">
        <div className="business-heading">
          <div>
            <h2>Danh sách khoản hoàn</h2>
          </div>
          <IconActionButton
            variant="outline"
            onClick={() => refunds.refetch()}
            disabled={refunds.isFetching}
            action="reload"
            label="Làm mới"
          />
        </div>
        {refunds.isError && <p role="alert">{refunds.error.message}</p>}
        {refunds.isPending ? (
          <p role="status">Đang tải khoản hoàn…</p>
        ) : refunds.data?.items.length ? (
          <div className="business-table-scroll">
            <table className="business-table">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Số tiền hoàn</th>
                  <th>Trạng thái</th>
                  <th>
                    <span className="sr-only">Chi tiết</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {refunds.data.items.map((item) => (
                  <tr
                    key={item.id}
                    className="finance-clickable-row"
                    tabIndex={0}
                    onClick={() => setSelectedId(item.id)}
                    onKeyDown={(event) => {
                      if (
                        event.target === event.currentTarget &&
                        (event.key === 'Enter' || event.key === ' ')
                      ) {
                        event.preventDefault();
                        setSelectedId(item.id);
                      }
                    }}
                  >
                    <td>
                      <strong>{item.orderCode}</strong>
                    </td>
                    <td className="finance-money">{money(item.amount)}</td>
                    <td>
                      <span className="finance-status" data-finance-state={item.status}>
                        {refundStatusLabel(item)}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="finance-open"
                        aria-label={`Xem khoản hoàn ${item.orderCode}`}
                      >
                        →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !refunds.isError ? (
          <p>Chưa có khoản hoàn trực tiếp.</p>
        ) : null}
        {refunds.data && (page > 1 || refunds.data.hasMore) && (
          <SellerPagination
            page={page}
            hasMore={refunds.data.hasMore}
            busy={refunds.isFetching}
            onPageChange={setPage}
          />
        )}
      </section>
      {selectedId && (
        <Modal
          open
          size="lg"
          title="Chi tiết khoản hoàn"
          className="seller-finance-panel seller-refund-modal"
          onClose={() => setSelectedId(null)}
        >
          <RefreshRegion>
            <RefundCard id={selectedId} sellerId={sellerId} />
          </RefreshRegion>
        </Modal>
      )}
    </RefreshRegion>
  );
}
