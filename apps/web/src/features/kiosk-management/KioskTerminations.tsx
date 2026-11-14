'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, MapPin } from '@florabot/ui';
import type { components } from '../../../../../packages/contracts/src/generated/api';
import EvidenceUpload from '@/shared/components/EvidenceUpload';
import { ApiError, queryClient, request, type Session } from '@/shared/lib/api';
import StaffEvidence from '../task-management/components/StaffEvidence';
import StaffTaskDetails from '../task-management/components/StaffTaskDetails';
import type { StaffDirectoryMember } from '../task-management/task-management.types';
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

type Termination = components['schemas']['KioskTerminationResponse'] & {
  removalTaskStatus?: string | null;
  lifecycleStatus?: string;
};
type Page = Omit<components['schemas']['KioskTerminationPage'], 'items'> & {
  items: Termination[];
};
const statusLabel: Record<string, string> = {
  REQUESTED: 'Chờ xem xét',
  ACCEPTED: 'Đã chấp thuận, chờ bàn giao',
  REJECTED: 'Đã từ chối',
  CANCELLED: 'Đã rút yêu cầu',
  COMPLETED: 'Đã bàn giao',
};
const lifecycleLabel: Record<string, string> = {
  TERMINATION_REQUESTED: 'Chờ quản lý xem xét',
  DISMANTLING_PENDING_ASSIGNMENT: 'Chờ phân công kỹ thuật viên tháo dỡ',
  DISMANTLING: 'Đang thực hiện tháo dỡ',
  AWAITING_MANAGER_CONFIRMATION: 'Kỹ thuật viên đã báo cáo, chờ quản lý xác nhận bàn giao',
  TERMINATION_COMPLETED: 'Đã hoàn tất tháo dỡ và bàn giao',
  NORMAL: 'Đang vận hành bình thường',
};
const removalTaskLabel: Record<string, string> = {
  ASSIGNED: 'Chờ kỹ thuật viên bắt đầu',
  IN_PROGRESS: 'Đang tháo dỡ tại điểm đặt',
  SUBMITTED: 'Kỹ thuật viên đã gửi báo cáo tháo dỡ',
  COMPLETED: 'Đã xác nhận tháo dỡ',
  CANCELLED: 'Công việc tháo dỡ đã hủy',
};
const textError = (error: unknown) =>
  error instanceof Error ? error.message : 'Không xử lý được yêu cầu.';

function SellerTerminationCard({ kiosk, sellerId }: { kiosk: SellerKioskItem; sellerId: string }) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
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
      setIsFormOpen(false);
      setNotice(
        'Đã gửi yêu cầu chấm dứt. Đội vận hành sẽ liên hệ để xác nhận quy trình bàn giao kiosk.',
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
      setIsWithdrawOpen(false);
      setNotice('Đã rút yêu cầu chấm dứt thuê kiosk.');
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });

  const hasRequest = Boolean(current.data);
  const isPendingReview = current.data?.status === 'REQUESTED';

  return (
    <article className="seller-termination-card" aria-label={kiosk.name || kiosk.code}>
      <div className="seller-termination-main">
        <div className="seller-termination-info">
          <div className="seller-termination-badges">
            <span className="subscription-kiosk-code">{kiosk.code}</span>
            {current.data ? (
              <span className="seller-termination-badge" data-status={current.data.status}>
                {statusLabel[current.data.status] || current.data.status}
              </span>
            ) : (
              <span className="seller-termination-badge is-active">Đang thuê vận hành</span>
            )}
          </div>
          <h3 className="seller-termination-kiosk-name">{kiosk.name}</h3>
          {kiosk.address && (
            <p className="seller-termination-kiosk-address">
              <MapPin size={15} aria-hidden="true" />
              <span>{kiosk.address}</span>
            </p>
          )}
        </div>

        <div className="seller-termination-action">
          {!hasRequest && !isFormOpen && (
            <Button
              type="button"
              variant="outline"
              className="seller-termination-trigger-btn"
              onClick={() => setIsFormOpen(true)}
            >
              Yêu cầu chấm dứt
            </Button>
          )}
          {isPendingReview && !isWithdrawOpen && (
            <Button
              type="button"
              variant="outline"
              className="seller-termination-withdraw-trigger-btn"
              onClick={() => setIsWithdrawOpen(true)}
            >
              Rút yêu cầu chấm dứt
            </Button>
          )}
        </div>
      </div>

      {current.isPending ? (
        <p role="status">Đang tải hồ sơ…</p>
      ) : current.isError ? (
        <p role="alert">{textError(current.error)}</p>
      ) : current.data ? (
        <div className="seller-termination-content">
          <div className="seller-termination-info-box">
            <div className="seller-termination-info-row">
              <span className="seller-termination-info-label">Lý do chấm dứt:</span>
              <span className="seller-termination-info-val">{current.data.reason}</span>
            </div>
            {current.data.reviewReason && (
              <div className="seller-termination-info-row">
                <span className="seller-termination-info-label">Phản hồi từ ban quản lý:</span>
                <span className="seller-termination-info-val">{current.data.reviewReason}</span>
              </div>
            )}
            {(current.data.lifecycleStatus || current.data.removalTaskStatus) && (
              <div className="seller-termination-info-row">
                <span className="seller-termination-info-label">Tiến độ tháo dỡ:</span>
                <span className="seller-termination-info-val">
                  {lifecycleLabel[current.data.lifecycleStatus || ''] ||
                    removalTaskLabel[current.data.removalTaskStatus || ''] ||
                    statusLabel[current.data.status] ||
                    current.data.status}
                  {current.data.removalTaskStatus &&
                  removalTaskLabel[current.data.removalTaskStatus] &&
                  current.data.lifecycleStatus
                    ? ` (${removalTaskLabel[current.data.removalTaskStatus]})`
                    : ''}
                </span>
              </div>
            )}
          </div>

          {isPendingReview && isWithdrawOpen && (
            <form
              className="seller-termination-form-panel"
              onSubmit={(event) => {
                event.preventDefault();
                if (current.data && withdrawReason.trim().length >= 10) {
                  withdraw.mutate(current.data);
                }
              }}
            >
              <div className="seller-termination-form-header">
                <strong>Rút lại yêu cầu chấm dứt</strong>
                <span>Nhập lý do rút yêu cầu (10–2.000 ký tự)</span>
              </div>
              <textarea
                id={`termination-withdraw-${kiosk.id}`}
                minLength={10}
                maxLength={2000}
                required
                rows={3}
                placeholder="Nhập lý do rút lại yêu cầu chấm dứt thuê kiosk này…"
                value={withdrawReason}
                onChange={(event) => setWithdrawReason(event.target.value)}
              />
              <div className="seller-termination-form-actions">
                <Button
                  type="submit"
                  disabled={withdraw.isPending || withdrawReason.trim().length < 10}
                >
                  {withdraw.isPending ? 'Đang xử lý…' : 'Xác nhận rút yêu cầu'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsWithdrawOpen(false);
                    setWithdrawReason('');
                  }}
                >
                  Hủy bỏ
                </Button>
              </div>
            </form>
          )}
        </div>
      ) : null}

      {!hasRequest && isFormOpen && (
        <form
          className="seller-termination-form-panel"
          onSubmit={(event) => {
            event.preventDefault();
            if (reason.trim().length >= 10) {
              create.mutate();
            }
          }}
        >
          <div className="seller-termination-form-header">
            <strong>Gửi yêu cầu chấm dứt thuê kiosk</strong>
            <span>
              Đội vận hành sẽ tiếp nhận và liên hệ thỏa thuận thời gian kiểm tra bàn giao.
            </span>
          </div>
          <label htmlFor={`termination-reason-${kiosk.id}`}>
            Lý do chấm dứt thuê <span className="seller-form-hint">(tối thiểu 10 ký tự)</span>
          </label>
          <textarea
            id={`termination-reason-${kiosk.id}`}
            minLength={10}
            maxLength={2000}
            required
            rows={3}
            placeholder="Mô tả lý do bạn muốn dừng thuê kiosk này…"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="seller-termination-form-actions">
            <Button type="submit" disabled={create.isPending || reason.trim().length < 10}>
              {create.isPending ? 'Đang gửi…' : 'Gửi yêu cầu'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsFormOpen(false);
                setReason('');
              }}
            >
              Hủy bỏ
            </Button>
          </div>
        </form>
      )}
      {notice && (
        <p role="status" className="seller-termination-notice">
          {notice}
        </p>
      )}
      {(create.isError || withdraw.isError) && (
        <p role="alert" className="error seller-termination-error">
          {textError(create.error || withdraw.error)}
        </p>
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
    <section className="business-panel seller-terminations-panel">
      <div className="seller-terminations-head">
        <h2>Yêu cầu chấm dứt thuê kiosk</h2>
        <p>
          Gửi yêu cầu để đội vận hành kiểm tra. Shop vẫn quản lý kiosk cho tới khi bàn giao được
          hoàn tất.
        </p>
      </div>
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
        <p className="seller-empty-state">Shop chưa có kiosk đang quản lý.</p>
      )}
    </section>
  );
}

function ManagerTerminationCard({
  item,
  technicians,
}: {
  item: Termination;
  technicians: StaffDirectoryMember[];
}) {
  const [reason, setReason] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [instructions, setInstructions] = useState('');
  const [notes, setNotes] = useState('');
  const [evidenceReference, setEvidenceReference] = useState('');
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [notice, setNotice] = useState('');
  const managerRole = 'OPERATIONS_MANAGER' as const;
  const needsAssignment =
    item.status === 'ACCEPTED' &&
    (!item.correlatedTaskId || !item.removalTaskStatus || item.removalTaskStatus === 'CANCELLED');
  const canComplete = item.status === 'ACCEPTED' && item.removalTaskStatus === 'SUBMITTED';
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
  const assign = useMutation({
    mutationFn: () =>
      request<{ id: string }>(
        `/operations/kiosk-termination-requests/${item.id}/assign`,
        { assigneeId, instructions: instructions.trim() },
        true,
        'POST',
      ),
    onSuccess: async () => {
      setInstructions('');
      setNotice('Đã phân công kỹ thuật viên tháo dỡ kiosk.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['operations-terminations'] }),
        queryClient.invalidateQueries({ queryKey: ['staff-tasks'] }),
      ]);
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['operations-terminations'] }),
        queryClient.invalidateQueries({ queryKey: ['staff-tasks'] }),
      ]);
    },
  });
  const archive = useMutation({
    mutationFn: () =>
      request<void>(
        `/operations/kiosks/${encodeURIComponent(item.kioskId)}`,
        undefined,
        true,
        'DELETE',
      ),
    onSuccess: async () => {
      setConfirmArchive(false);
      setNotice(
        `Đã lưu trữ tủ ${item.kioskCode || item.kioskName || item.kioskId}. Lịch sử đơn hàng, thanh toán và vận hành được giữ lại.`,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['operations-terminations'] }),
        queryClient.invalidateQueries({ queryKey: ['available-kiosks-inventory'] }),
        queryClient.invalidateQueries({ queryKey: ['eligible-kiosks'] }),
      ]);
    },
  });
  const step1State =
    item.status === 'REQUESTED'
      ? 'active'
      : item.status === 'ACCEPTED' || item.status === 'COMPLETED'
        ? 'done'
        : 'idle';
  const step2State =
    item.status === 'COMPLETED' || item.removalTaskStatus === 'SUBMITTED'
      ? 'done'
      : item.status === 'ACCEPTED'
        ? 'active'
        : 'idle';
  const step3State = item.status === 'COMPLETED' ? 'done' : canComplete ? 'active' : 'idle';

  return (
    <article className="business-card termination-card">
      <div className="termination-card-head">
        <div>
          <div className="termination-card-title">
            {item.kioskCode && <span className="termination-code-pill">{item.kioskCode}</span>}
            <h3>
              {item.kioskName || item.kioskCode} · {item.shopName}
            </h3>
          </div>
          <p className="termination-meta-time">
            Yêu cầu lúc {new Date(item.requestedAt).toLocaleString('vi-VN')}
          </p>
        </div>
        <span className="termination-status-pill" data-status={item.status}>
          {statusLabel[item.status] || item.status}
        </span>
      </div>

      {item.status !== 'REJECTED' && item.status !== 'CANCELLED' && (
        <ol className="termination-stepper" aria-label="Tiến trình chấm dứt thuê">
          <li className="termination-step" data-state={step1State}>
            <strong>Bước 1 · Duyệt yêu cầu</strong>
            <span>{item.status === 'REQUESTED' ? 'Chờ xem xét' : 'Đã chấp thuận'}</span>
          </li>
          <li className="termination-step" data-state={step2State}>
            <strong>Bước 2 · Tháo dỡ kiosk</strong>
            <span>
              {item.status === 'COMPLETED'
                ? 'Đã hoàn tất'
                : needsAssignment
                  ? 'Chờ phân công kỹ thuật viên'
                  : item.removalTaskStatus
                    ? removalTaskLabel[item.removalTaskStatus] || item.removalTaskStatus
                    : 'Chờ thực hiện'}
            </span>
          </li>
          <li className="termination-step" data-state={step3State}>
            <strong>Bước 3 · Xác nhận bàn giao</strong>
            <span>
              {item.status === 'COMPLETED'
                ? 'Đã bàn giao'
                : canComplete
                  ? 'Sẵn sàng xác nhận'
                  : 'Chờ báo cáo tháo dỡ'}
            </span>
          </li>
        </ol>
      )}

      <div className="termination-info-box">
        <p>
          <strong>Lý do của shop:</strong> {item.reason}
        </p>
        {item.reviewReason && (
          <p>
            <strong>Kết quả xem xét:</strong> {item.reviewReason}
          </p>
        )}
        {(item.lifecycleStatus || item.removalTaskStatus) && (
          <p>
            <strong>Trạng thái chi tiết:</strong>{' '}
            {lifecycleLabel[item.lifecycleStatus || ''] || statusLabel[item.status] || item.status}
          </p>
        )}
      </div>

      {item.status === 'REQUESTED' && (
        <form
          className="business-form termination-action-panel"
          onSubmit={(event) => event.preventDefault()}
        >
          <h4>Xem xét yêu cầu chấm dứt</h4>
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
      {needsAssignment && (
        <form
          className="business-form termination-action-panel"
          onSubmit={(event) => {
            event.preventDefault();
            if (assigneeId && instructions.trim().length >= 10) {
              assign.mutate();
            }
          }}
        >
          <h4>Phân công kỹ thuật viên tháo dỡ</h4>
          <p>
            Giao công việc tháo dỡ để kỹ thuật viên kiểm tra hiện trường, thu hồi thiết bị và gửi
            báo cáo/ảnh minh chứng trước khi hoàn tất bàn giao.
          </p>
          <label htmlFor={`term-assignee-${item.id}`}>Kỹ thuật viên phụ trách</label>
          <select
            id={`term-assignee-${item.id}`}
            required
            value={assigneeId}
            onChange={(event) => setAssigneeId(event.target.value)}
            disabled={assign.isPending}
          >
            <option value="">Chọn kỹ thuật viên</option>
            {technicians.map((tech) => (
              <option key={tech.id} value={tech.id}>
                {tech.name}
              </option>
            ))}
          </select>
          <label htmlFor={`term-instructions-${item.id}`}>Hướng dẫn tháo dỡ (10–2.000 ký tự)</label>
          <textarea
            id={`term-instructions-${item.id}`}
            minLength={10}
            maxLength={2000}
            required
            rows={3}
            placeholder="Nhập hướng dẫn kiểm tra, tháo dỡ và thu hồi kiosk tại điểm đặt…"
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            disabled={assign.isPending}
          />
          <div>
            <Button
              type="submit"
              disabled={assign.isPending || !assigneeId || instructions.trim().length < 10}
            >
              {assign.isPending ? 'Đang phân công…' : 'Phân công tháo dỡ'}
            </Button>
          </div>
        </form>
      )}
      {item.status === 'ACCEPTED' && !needsAssignment && !canComplete && (
        <div className="termination-waiting-box" role="status">
          <strong>Đang chờ kỹ thuật viên tháo dỡ & gửi báo cáo</strong>
          <p>
            Sau khi kỹ thuật viên hoàn thành tháo dỡ và gửi báo cáo bên ứng dụng Kỹ thuật viên, mục
            xác nhận bàn giao sẽ tự động mở tại đây.
          </p>
        </div>
      )}
      {item.correlatedTaskId && (
        <div className="termination-task-box">
          <StaffEvidence
            key={`${item.correlatedTaskId}:${item.version}`}
            taskId={item.correlatedTaskId}
            version={Number(item.version) || 1}
            apiBase="/operations/staff-tasks"
            role={managerRole}
            mode="manager"
            admin
            active={false}
          />
          <StaffTaskDetails
            taskId={item.correlatedTaskId}
            version={Number(item.version) || 1}
            apiBase="/operations/staff-tasks"
            role={managerRole}
            admin
          />
        </div>
      )}
      {canComplete && (
        <div className="business-form termination-action-panel">
          <h4>Xác nhận hoàn tất bàn giao</h4>
          <p>
            Kỹ thuật viên đã gửi báo cáo tháo dỡ. Hãy kiểm tra ảnh/báo cáo của kỹ thuật viên ở mục
            trên rồi bấm xác nhận hoàn tất bàn giao.
          </p>
          <label htmlFor={`term-notes-${item.id}`}>Ghi chú bàn giao (tùy chọn)</label>
          <textarea
            id={`term-notes-${item.id}`}
            value={notes}
            disabled={complete.isPending}
            onChange={(event) => setNotes(event.target.value)}
          />
          <details className="termination-optional-evidence">
            <summary>Đính kèm thêm ảnh biên bản từ quản lý (không bắt buộc)</summary>
            <div style={{ marginTop: '0.6rem' }}>
              <EvidenceUpload
                id={`term-evidence-${item.id}`}
                endpoint={`/api/operations/kiosk-termination-requests/${item.id}/evidence/upload`}
                disabled={complete.isPending}
                onReference={setEvidenceReference}
              />
            </div>
          </details>
          <div>
            <Button disabled={complete.isPending} onClick={() => complete.mutate()}>
              {complete.isPending ? 'Đang xác nhận…' : 'Xác nhận đã bàn giao'}
            </Button>
          </div>
        </div>
      )}
      {item.status === 'COMPLETED' && (
        <div className="business-form termination-action-panel">
          {item.completionNotes && <p>Ghi chú bàn giao: {item.completionNotes}</p>}
          {!confirmArchive ? (
            <div>
              <Button
                type="button"
                variant="outline"
                disabled={archive.isPending}
                onClick={() => setConfirmArchive(true)}
              >
                Lưu trữ tủ {item.kioskCode || item.kioskName || ''}
              </Button>
            </div>
          ) : (
            <div>
              <p>
                <strong>
                  Xác nhận lưu trữ mềm tủ {item.kioskCode || item.kioskName || item.kioskId}?
                </strong>{' '}
                Tủ phải ở trạng thái OFFLINE và không còn hàng, đơn hoặc công việc đang chờ. Lịch sử
                đơn hàng, thanh toán và vận hành được giữ lại.
              </p>
              <div className="business-inline">
                <Button type="button" disabled={archive.isPending} onClick={() => archive.mutate()}>
                  {archive.isPending ? 'Đang lưu trữ…' : 'Xác nhận lưu trữ tủ'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={archive.isPending}
                  onClick={() => setConfirmArchive(false)}
                >
                  Hủy
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      {(review.isError || assign.isError || complete.isError || archive.isError) && (
        <p role="alert">
          {textError(review.error || assign.error || complete.error || archive.error)}
        </p>
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
      {item.status === 'REQUESTED' && (
        <div className="business-form">
          <label htmlFor={`loc-review-note-${item.id}`}>
            Ghi chú xem xét (lý do từ chối ít nhất 5 ký tự)
          </label>
          <input
            id={`loc-review-note-${item.id}`}
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="business-inline">
            <Button disabled={review.isPending} onClick={() => review.mutate('APPROVED')}>
              Duyệt vị trí mới
            </Button>
            <Button
              variant="outline"
              disabled={review.isPending || note.trim().length < 5}
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
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState('');
  const slotDirectory = useQuery({
    queryKey: ['flower-presence', item.kioskId],
    queryFn: () =>
      request<components['schemas']['FlowerPresenceResponse']>(
        `/kiosks/${item.kioskId}/flower-presence`,
      ),
    enabled: item.status === 'PENDING' && item.preorderSlots > 0,
  });
  const slots = slotDirectory.data?.slots ?? [];
  const preorderSlotIds = selectedSlots.filter((id) => slots.some((slot) => slot.slotId === id));
  const validSelection =
    item.preorderSlots === 0 ||
    (!slotDirectory.isError && preorderSlotIds.length === item.preorderSlots);
  const review = useMutation({
    mutationFn: (approve: boolean) =>
      request<{ status: 'APPROVED' | 'REJECTED' }>(
        `/operations/kiosk-layout-requests/${item.id}/review`,
        { preorderSlotIds: approve ? preorderSlotIds : null, note: note.trim() || null },
        true,
        'POST',
      ),
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
          {item.preorderSlots === 0 ? (
            <p>Tất cả ô sẽ chuyển sang Walk-in. Các ô đổi loại phải trống và không giữ đơn.</p>
          ) : (
            <fieldset aria-describedby={`layout-slot-hint-${item.id}`}>
              <legend>Chọn {item.preorderSlots} ô Pre-order</legend>
              <p id={`layout-slot-hint-${item.id}`}>
                Đã chọn {preorderSlotIds.length}/{item.preorderSlots} ô. Các ô đổi loại phải trống
                và không giữ đơn.
              </p>
              {slotDirectory.isPending ? (
                <p role="status">Đang tải danh sách ô…</p>
              ) : slotDirectory.isError ? (
                <>
                  <p role="alert">Chưa tải được danh sách ô của kiosk.</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void slotDirectory.refetch()}
                  >
                    Tải lại danh sách ô
                  </Button>
                </>
              ) : slots.length ? (
                <div className="business-inline">
                  {slots.map((slot) => {
                    const checked = preorderSlotIds.includes(slot.slotId);
                    return (
                      <label key={slot.slotId}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={
                            review.isPending ||
                            (!checked && preorderSlotIds.length >= item.preorderSlots)
                          }
                          onChange={(event) => {
                            setSelectedSlots(
                              event.target.checked
                                ? [...preorderSlotIds, slot.slotId]
                                : preorderSlotIds.filter((id) => id !== slot.slotId),
                            );
                          }}
                        />{' '}
                        Ô {slot.slotCode}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p>Chưa có danh sách ô cho kiosk này.</p>
              )}
            </fieldset>
          )}
          <label htmlFor={`layout-review-note-${item.id}`}>
            Ghi chú xem xét (bắt buộc khi từ chối)
          </label>
          <textarea
            id={`layout-review-note-${item.id}`}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="business-inline">
            <Button
              disabled={review.isPending || !validSelection}
              onClick={() => review.mutate(true)}
            >
              Duyệt đổi cơ cấu ô
            </Button>
            <Button
              variant="outline"
              disabled={review.isPending || !note.trim()}
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
  const hasAssignableTermination = Boolean(
    records.data?.items.some(
      (item) =>
        item.status === 'ACCEPTED' &&
        (!item.correlatedTaskId ||
          !item.removalTaskStatus ||
          item.removalTaskStatus === 'CANCELLED'),
    ),
  );
  const technicians = useQuery({
    queryKey: ['operations-termination-technicians'],
    queryFn: () => request<StaffDirectoryMember[]>('/operations/staff'),
    enabled: hasAssignableTermination,
  });
  const locationRequests = useQuery({
    queryKey: ['operations-location-requests'],
    queryFn: () =>
      request<KioskLocationChangeResponse[]>(
        '/operations/kiosk-location-requests?status=REQUESTED',
      ),
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
        <option value="CANCELLED">Đã rút yêu cầu</option>
        <option value="COMPLETED">Đã bàn giao</option>
      </select>
      {records.isPending ? (
        <p role="status">Đang tải hồ sơ…</p>
      ) : records.isError ? (
        <p role="alert">{textError(records.error)}</p>
      ) : records.data?.items.length ? (
        <div className="business-card-list">
          {records.data.items.map((item) => (
            <ManagerTerminationCard
              key={item.id}
              item={item}
              technicians={technicians.data ?? []}
            />
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
