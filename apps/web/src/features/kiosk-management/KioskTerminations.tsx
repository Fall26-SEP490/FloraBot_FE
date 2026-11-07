'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import type { components } from '../../../../../packages/contracts/src/generated/api';
import EvidenceUpload from '@/shared/components/EvidenceUpload';
import { ApiError, queryClient, request, type Session } from '@/shared/lib/api';
import type { KioskLocationChangeResponse, SellerKioskItem } from './kiosk-management.types';
import '../finance/styles/commerce-subscriptions.css';

interface SlotLayoutRequestView {
  id: string;
  kioskId: string;
  sellerId: string;
  walkInSlots: number;
  preorderSlots: number;
  reason: string;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
}

type Termination = components['schemas']['KioskTerminationResponse'];
type Page = components['schemas']['KioskTerminationPage'];
const statusLabel: Record<string, string> = {
  REQUESTED: 'Chờ xem xét',
  ACCEPTED: 'Đã chấp thuận, chờ bàn giao',
  REJECTED: 'Đã từ chối',
  WITHDRAWN: 'Đã rút yêu cầu',
  COMPLETED: 'Đã bàn giao',
};
const textError = (error: unknown) =>
  error instanceof Error ? error.message : 'Không xử lý được yêu cầu.';

function SellerTerminationCard({ kiosk, sellerId }: { kiosk: SellerKioskItem; sellerId: string }) {
  const [reason, setReason] = useState('');
  const [withdrawReason, setWithdrawReason] = useState('');
  const [notice, setNotice] = useState('');
  const key = ['seller-termination', sellerId, kiosk.id];
  const current = useQuery({
    queryKey: key,
    queryFn: async () => {
      try {
        return await request<Termination>(
          `/sellers/${sellerId}/kiosks/${kiosk.id}/termination-requests/current`,
        );
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
  });
  const create = useMutation({
    mutationFn: () =>
      request<Termination>(
        `/sellers/${sellerId}/kiosks/${kiosk.id}/termination-requests`,
        { reason: reason.trim() },
        true,
        'POST',
      ),
    onSuccess: async () => {
      setReason('');
      setNotice(
        'Đã gửi yêu cầu. Kiosk chưa được chấm dứt cho tới khi đội vận hành xác nhận bàn giao.',
      );
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });
  const withdraw = useMutation({
    mutationFn: (item: Termination) =>
      request<Termination>(
        `/sellers/${sellerId}/kiosks/${kiosk.id}/termination-requests/${item.id}/withdraw`,
        { version: item.version, reason: withdrawReason.trim() },
        true,
        'POST',
      ),
    onSuccess: async () => {
      setWithdrawReason('');
      setNotice('Đã rút yêu cầu chấm dứt thuê kiosk.');
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });
  return (
    <article className="business-card">
      <h3>
        {kiosk.name} · {kiosk.code}
      </h3>
      <p>{kiosk.address}</p>
      {current.isPending ? (
        <p role="status">Đang tải hồ sơ…</p>
      ) : current.isError ? (
        <p role="alert">{textError(current.error)}</p>
      ) : current.data ? (
        <>
          <p>
            <strong>{statusLabel[current.data.status] || current.data.status}</strong>
          </p>
          <p>Lý do: {current.data.reason}</p>
          {current.data.reviewReason && <p>Phản hồi: {current.data.reviewReason}</p>}
          {current.data.status === 'REQUESTED' && (
            <form
              className="business-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (current.data && withdrawReason.trim().length >= 10) {
                  withdraw.mutate(current.data);
                }
              }}
            >
              <label htmlFor={`termination-withdraw-${kiosk.id}`}>
                Lý do rút yêu cầu chấm dứt thuê (10–2.000 ký tự)
              </label>
              <textarea
                id={`termination-withdraw-${kiosk.id}`}
                minLength={10}
                maxLength={2000}
                required
                value={withdrawReason}
                onChange={(event) => setWithdrawReason(event.target.value)}
              />
              <Button
                type="submit"
                variant="outline"
                disabled={withdraw.isPending || withdrawReason.trim().length < 10}
              >
                {withdraw.isPending ? 'Đang rút yêu cầu…' : 'Rút yêu cầu chấm dứt'}
              </Button>
            </form>
          )}
        </>
      ) : (
        <form
          className="business-form"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <label htmlFor={`termination-reason-${kiosk.id}`}>Lý do chấm dứt thuê</label>
          <textarea
            id={`termination-reason-${kiosk.id}`}
            minLength={10}
            maxLength={2000}
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <Button type="submit" disabled={create.isPending}>
            Gửi yêu cầu
          </Button>
        </form>
      )}
      {notice && <p role="status">{notice}</p>}
      {(create.isError || withdraw.isError) && (
        <p role="alert">{textError(create.error || withdraw.error)}</p>
      )}
    </article>
  );
}

export function SellerTerminations({ session }: { session: Session }) {
  const sellerId = session.sellerId;
  const kiosks = useQuery({
    queryKey: ['seller-termination-kiosks', sellerId],
    enabled: Boolean(sellerId),
    queryFn: () => request<SellerKioskItem[]>('/me/kiosks'),
  });
  if (!sellerId) return <p role="alert">Tài khoản chưa liên kết với shop.</p>;
  return (
    <section className="business-panel">
      <h2>Yêu cầu chấm dứt thuê kiosk</h2>
      <p>
        Gửi yêu cầu để đội vận hành kiểm tra. Shop vẫn quản lý kiosk cho tới khi bàn giao được hoàn
        tất.
      </p>
      {kiosks.isPending ? (
        <p role="status">Đang tải kiosk…</p>
      ) : kiosks.isError ? (
        <p role="alert">{textError(kiosks.error)}</p>
      ) : kiosks.data?.length ? (
        <div className="business-card-list">
          {kiosks.data.map((item) => (
            <SellerTerminationCard key={item.id} kiosk={item} sellerId={sellerId} />
          ))}
        </div>
      ) : (
        <p>Shop chưa có kiosk đang quản lý.</p>
      )}
    </section>
  );
}

function ManagerTerminationCard({ item }: { item: Termination }) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [evidenceReference, setEvidenceReference] = useState('');
  const [notice, setNotice] = useState('');
  const review = useMutation({
    mutationFn: (action: 'ACCEPT' | 'REJECT') =>
      request<Termination>(
        `/operations/kiosk-termination-requests/${item.id}/review`,
        { action, reason: reason.trim() },
        true,
        'POST',
      ),
    onSuccess: async () => {
      setNotice('Đã cập nhật kết quả xem xét.');
      await queryClient.invalidateQueries({ queryKey: ['operations-terminations'] });
    },
  });
  const complete = useMutation({
    mutationFn: () =>
      request<Termination>(
        `/operations/kiosk-termination-requests/${item.id}/complete`,
        { notes: notes.trim() || null, evidenceReference: evidenceReference || null },
        true,
        'POST',
      ),
    onSuccess: async () => {
      setNotice('Đã ghi nhận bàn giao kiosk.');
      await queryClient.invalidateQueries({ queryKey: ['operations-terminations'] });
    },
  });
  return (
    <article className="business-card">
      <h3>
        {item.kioskName || item.kioskCode} · {item.shopName}
      </h3>
      <p>
        <strong>{statusLabel[item.status] || item.status}</strong> · Yêu cầu lúc{' '}
        {new Date(item.requestedAt).toLocaleString('vi-VN')}
      </p>
      <p>Lý do của shop: {item.reason}</p>
      {item.status === 'REQUESTED' && (
        <form className="business-form" onSubmit={(event) => event.preventDefault()}>
          <label htmlFor={`term-review-${item.id}`}>Lý do xem xét (10–2.000 ký tự)</label>
          <textarea
            id={`term-review-${item.id}`}
            minLength={10}
            maxLength={2000}
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="business-inline">
            <Button
              disabled={review.isPending || reason.trim().length < 10}
              onClick={() => review.mutate('ACCEPT')}
            >
              Chấp thuận
            </Button>
            <Button
              variant="outline"
              disabled={review.isPending || reason.trim().length < 10}
              onClick={() => review.mutate('REJECT')}
            >
              Từ chối
            </Button>
          </div>
        </form>
      )}
      {item.status === 'ACCEPTED' && (
        <div className="business-form">
          <p>
            Chỉ hoàn tất sau khi đã kiểm tra và bàn giao tủ. BE sẽ kiểm tra điều kiện còn lại trước
            khi chấm dứt.
          </p>
          <EvidenceUpload
            id={`term-evidence-${item.id}`}
            endpoint={`/api/operations/kiosk-termination-requests/${item.id}/evidence/upload`}
            onReference={setEvidenceReference}
          />
          <label htmlFor={`term-notes-${item.id}`}>Ghi chú bàn giao</label>
          <textarea
            id={`term-notes-${item.id}`}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
          <Button
            disabled={complete.isPending || !evidenceReference}
            onClick={() => complete.mutate()}
          >
            Xác nhận đã bàn giao
          </Button>
        </div>
      )}
      {item.reviewReason && <p>Kết quả xem xét: {item.reviewReason}</p>}
      {notice && <p role="status">{notice}</p>}
      {(review.isError || complete.isError) && (
        <p role="alert">{textError(review.error || complete.error)}</p>
      )}
    </article>
  );
}

function ManagerLocationRequestCard({ item }: { item: KioskLocationChangeResponse }) {
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState('');
  const review = useMutation({
    mutationFn: (decision: 'APPROVED' | 'REJECTED') =>
      request<KioskLocationChangeResponse>(
        `/operations/kiosk-location-requests/${item.id}/review`,
        { decision, note: note.trim() || null },
        true,
        'POST',
      ),
    onSuccess: async () => {
      setNotice('Đã cập nhật kết quả duyệt đổi vị trí kiosk.');
      await queryClient.invalidateQueries({ queryKey: ['operations-location-requests'] });
    },
  });
  return (
    <article className="business-card">
      <h3>
        Kiosk {item.kioskId} · {item.status}
      </h3>
      <p>
        Địa chỉ mới: <strong>{item.address}</strong> ({item.latitude}, {item.longitude})
      </p>
      <p>Lý do: {item.reason}</p>
      {item.status === 'PENDING' && (
        <div className="business-form">
          <label htmlFor={`loc-review-note-${item.id}`}>Ghi chú xem xét</label>
          <textarea
            id={`loc-review-note-${item.id}`}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="business-inline">
            <Button disabled={review.isPending} onClick={() => review.mutate('APPROVED')}>
              Duyệt vị trí mới
            </Button>
            <Button
              variant="outline"
              disabled={review.isPending}
              onClick={() => review.mutate('REJECTED')}
            >
              Từ chối
            </Button>
          </div>
        </div>
      )}
      {item.reviewNote && <p>Ghi chú duyệt: {item.reviewNote}</p>}
      {notice && <p role="status">{notice}</p>}
      {review.isError && <p role="alert">{textError(review.error)}</p>}
    </article>
  );
}

function ManagerLayoutRequestCard({ item }: { item: SlotLayoutRequestView }) {
  const [preorderIdsInput, setPreorderIdsInput] = useState('');
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState('');
  const review = useMutation({
    mutationFn: (approve: boolean) => {
      const parsedIds = approve
        ? preorderIdsInput
            .split(/[\s,]+/)
            .map((s) => s.trim())
            .filter(Boolean)
        : null;
      return request<SlotLayoutRequestView>(
        `/operations/kiosk-layout-requests/${item.id}/review`,
        { preorderSlotIds: parsedIds, note: note.trim() || null },
        true,
        'POST',
      );
    },
    onSuccess: async () => {
      setNotice('Đã cập nhật kết quả duyệt cơ cấu ô kiosk.');
      await queryClient.invalidateQueries({ queryKey: ['operations-layout-requests'] });
    },
  });
  return (
    <article className="business-card">
      <h3>
        Kiosk {item.kioskId} · {item.walkInSlots} Walk-in / {item.preorderSlots} Pre-order ·{' '}
        {item.status}
      </h3>
      <p>Lý do của shop: {item.reason}</p>
      {item.status === 'PENDING' && (
        <div className="business-form">
          <label htmlFor={`layout-slot-ids-${item.id}`}>
            Danh sách ID ô Pre-order ({item.preorderSlots} ô, cách nhau bởi dấu phẩy khi duyệt)
          </label>
          <input
            id={`layout-slot-ids-${item.id}`}
            value={preorderIdsInput}
            onChange={(e) => setPreorderIdsInput(e.target.value)}
            placeholder="Nhập các UUID của ô Pre-order…"
          />
          <label htmlFor={`layout-review-note-${item.id}`}>Ghi chú xem xét</label>
          <textarea
            id={`layout-review-note-${item.id}`}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="business-inline">
            <Button disabled={review.isPending} onClick={() => review.mutate(true)}>
              Duyệt đổi cơ cấu ô
            </Button>
            <Button
              variant="outline"
              disabled={review.isPending}
              onClick={() => review.mutate(false)}
            >
              Từ chối
            </Button>
          </div>
        </div>
      )}
      {item.reviewNote && <p>Ghi chú duyệt: {item.reviewNote}</p>}
      {notice && <p role="status">{notice}</p>}
      {review.isError && <p role="alert">{textError(review.error)}</p>}
    </article>
  );
}

export function OperationsTerminations() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [locationOpen, setLocationOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const records = useQuery({
    queryKey: ['operations-terminations', status, page],
    queryFn: () =>
      request<Page>(
        `/operations/kiosk-termination-requests?page=${page}&limit=20${status ? `&status=${status}` : ''}`,
      ),
  });
  const locationRequests = useQuery({
    queryKey: ['operations-location-requests'],
    queryFn: () =>
      request<KioskLocationChangeResponse[]>('/operations/kiosk-location-requests?status=PENDING'),
    enabled: locationOpen,
  });
  const layoutRequests = useQuery({
    queryKey: ['operations-layout-requests'],
    queryFn: () =>
      request<SlotLayoutRequestView[]>('/operations/kiosk-layout-requests?status=PENDING'),
    enabled: layoutOpen,
  });
  return (
    <section className="business-panel">
      <div className="business-heading">
        <div>
          <h2>Hồ sơ chấm dứt thuê kiosk</h2>
          <p>Xem xét yêu cầu, kiểm tra bàn giao rồi xác nhận hoàn tất.</p>
        </div>
        <Button variant="outline" onClick={() => void records.refetch()}>
          Làm mới
        </Button>
      </div>
      <label htmlFor="termination-filter">Trạng thái </label>
      <select
        id="termination-filter"
        value={status}
        onChange={(event) => {
          setStatus(event.target.value);
          setPage(1);
        }}
      >
        <option value="">Tất cả</option>
        <option value="REQUESTED">Chờ xem xét</option>
        <option value="ACCEPTED">Chờ bàn giao</option>
        <option value="REJECTED">Đã từ chối</option>
        <option value="COMPLETED">Đã bàn giao</option>
      </select>
      {records.isPending ? (
        <p role="status">Đang tải hồ sơ…</p>
      ) : records.isError ? (
        <p role="alert">{textError(records.error)}</p>
      ) : records.data?.items.length ? (
        <div className="business-card-list">
          {records.data.items.map((item) => (
            <ManagerTerminationCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <p>Không có hồ sơ trong trạng thái này.</p>
      )}
      {records.data && (
        <div className="business-pagination">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Trước
          </Button>
          <span>Trang {page}</span>
          <Button
            variant="outline"
            disabled={!records.data.hasMore}
            onClick={() => setPage(page + 1)}
          >
            Sau
          </Button>
        </div>
      )}

      <details
        className="business-card"
        style={{ marginTop: '1rem' }}
        open={locationOpen}
        onToggle={(e) => setLocationOpen(e.currentTarget.open)}
      >
        <summary>
          <strong>Yêu cầu đổi vị trí kiosk chờ duyệt</strong>
        </summary>
        {locationOpen && (
          <div style={{ marginTop: '0.75rem' }}>
            {locationRequests.isPending ? (
              <p role="status">Đang tải yêu cầu đổi vị trí…</p>
            ) : locationRequests.isError ? (
              <p role="alert">{textError(locationRequests.error)}</p>
            ) : locationRequests.data?.length ? (
              <div className="business-card-list">
                {locationRequests.data.map((item) => (
                  <ManagerLocationRequestCard key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <p>Không có yêu cầu đổi vị trí kiosk đang chờ duyệt.</p>
            )}
          </div>
        )}
      </details>

      <details
        className="business-card"
        style={{ marginTop: '0.75rem' }}
        open={layoutOpen}
        onToggle={(e) => setLayoutOpen(e.currentTarget.open)}
      >
        <summary>
          <strong>Yêu cầu đổi cơ cấu ô (Walk-in / Pre-order) chờ duyệt</strong>
        </summary>
        {layoutOpen && (
          <div style={{ marginTop: '0.75rem' }}>
            {layoutRequests.isPending ? (
              <p role="status">Đang tải yêu cầu đổi cơ cấu ô…</p>
            ) : layoutRequests.isError ? (
              <p role="alert">{textError(layoutRequests.error)}</p>
            ) : layoutRequests.data?.length ? (
              <div className="business-card-list">
                {layoutRequests.data.map((item) => (
                  <ManagerLayoutRequestCard key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <p>Không có yêu cầu đổi cơ cấu ô đang chờ duyệt.</p>
            )}
          </div>
        )}
      </details>
    </section>
  );
}
