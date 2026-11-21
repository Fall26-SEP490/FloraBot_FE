'use client';
import WorkspaceTable from '@/features/portal/components/WorkspaceTable';
import { Modal } from '@/shared/components/Modal';
import '@/features/portal/styles/operations-registers.css';
import { liveListOptions } from '@/shared/lib/live-list';

import IconActionButton from '@/shared/components/IconActionButton';
import RefreshRegion from '@/shared/components/RefreshRegion';
import { createPortal } from 'react-dom';
import '../finance/styles/seller-rental.css';
import Select from '@/shared/components/Select';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, MapPin } from '@florabot/ui';
import type { components } from '../../../../../packages/contracts/src/generated/api';
import EvidenceUpload from '@/shared/components/EvidenceUpload';
import { ApiError, queryClient, request, type Session } from '@/shared/lib/api';
import StaffEvidence from '../task-management/components/StaffEvidence';
import StaffTaskDetails from '../task-management/components/StaffTaskDetails';
import type { StaffDirectoryMember, TaskDetail } from '../task-management/task-management.types';
import type { KioskLocationChangeResponse, SellerKioskItem } from './kiosk-management.types';
import '../finance/styles/commerce-subscriptions.css';
import { terminationNextStep } from './termination-progress';
import { requiresOutcomeCheck } from '@/shared/lib/mutation-outcome';
import './styles/operations-usability.css';

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
  const [detailOpen, setDetailOpen] = useState(false);
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
      setNotice('Đã gửi yêu cầu chấm dứt.');
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
    <>
      <tr
        className="rental-data-row"
        tabIndex={0}
        onClick={() => setDetailOpen(true)}
        onKeyDown={(event) => {
          if (event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) {
            event.preventDefault();
            setDetailOpen(true);
          }
        }}
      >
        <td>
          <strong>{kiosk.name || kiosk.code}</strong>
          <small>Mã: {kiosk.code}</small>
        </td>
        <td>{kiosk.address || '—'}</td>
        <td>
          <span className="seller-termination-badge" data-status={current.data?.status}>
            {current.isPending
              ? 'Đang tải…'
              : current.isError
                ? 'Chưa tải được'
                : current.data
                  ? statusLabel[current.data.status] || current.data.status
                  : 'Đang thuê'}
          </span>
        </td>
        <td>
          {current.data
            ? lifecycleLabel[current.data.lifecycleStatus || ''] ||
              removalTaskLabel[current.data.removalTaskStatus || ''] ||
              '—'
            : '—'}
        </td>
        <td>
          <button
            type="button"
            className="button button-outline"
            onClick={() => setDetailOpen(true)}
          >
            Xem
          </button>
        </td>
      </tr>
      {detailOpen &&
        createPortal(
          <Modal
            open
            title={`Chấm dứt thuê: ${kiosk.name || kiosk.code}`}
            size="lg"
            className="rental-detail-modal"
            onClose={() => setDetailOpen(false)}
          >
            <article className="seller-termination-card" aria-label={kiosk.name || kiosk.code}>
              <div className="seller-termination-main">
                <div className="seller-termination-info">
                  <h3 className="seller-termination-kiosk-name">{kiosk.name || kiosk.code}</h3>
                  <div className="seller-termination-badges">
                    <span className="subscription-kiosk-code">Mã: {kiosk.code}</span>
                    {current.data ? (
                      <span className="seller-termination-badge" data-status={current.data.status}>
                        {statusLabel[current.data.status] || current.data.status}
                      </span>
                    ) : (
                      <span className="seller-termination-badge is-active">Đang thuê vận hành</span>
                    )}
                  </div>
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
                      onClick={() => {
                        setNotice('');
                        setIsFormOpen(true);
                      }}
                    >
                      Yêu cầu chấm dứt
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
                        <span className="seller-termination-info-label">
                          Phản hồi từ ban quản lý:
                        </span>
                        <span className="seller-termination-info-val">
                          {current.data.reviewReason}
                        </span>
                      </div>
                    )}
                    {!['CANCELLED', 'REJECTED'].includes(current.data.status) &&
                      (current.data.lifecycleStatus || current.data.removalTaskStatus) && (
                        <div className="seller-termination-info-row">
                          <span className="seller-termination-info-label">Tiến độ xử lý:</span>
                          <span className="seller-termination-info-val">
                            {lifecycleLabel[current.data.lifecycleStatus || ''] ||
                              removalTaskLabel[current.data.removalTaskStatus || ''] ||
                              statusLabel[current.data.status] ||
                              current.data.status}
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
                        <label htmlFor={`termination-withdraw-${kiosk.id}`}>
                          Lý do rút yêu cầu{' '}
                          <span className="rental-required" aria-hidden="true">
                            *
                          </span>
                        </label>
                      </div>
                      <textarea
                        id={`termination-withdraw-${kiosk.id}`}
                        minLength={10}
                        maxLength={2000}
                        required
                        rows={3}
                        placeholder="Nhập lý do rút yêu cầu…"
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
                  <label htmlFor={`termination-reason-${kiosk.id}`}>
                    Lý do chấm dứt thuê{' '}
                    <span className="rental-required" aria-hidden="true">
                      *
                    </span>
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
              {notice && !isFormOpen && !isWithdrawOpen && (
                <p role="status" className="seller-termination-notice">
                  {notice}
                </p>
              )}
              {(create.isError || withdraw.isError) && (
                <p role="alert" className="error seller-termination-error">
                  {textError(create.error || withdraw.error)}
                </p>
              )}
              {isPendingReview && !isWithdrawOpen && (
                <div className="seller-termination-action seller-termination-footer">
                  <Button
                    type="button"
                    variant="outline"
                    className="seller-termination-withdraw-trigger-btn"
                    onClick={() => {
                      setNotice('');
                      setIsWithdrawOpen(true);
                    }}
                  >
                    Rút yêu cầu chấm dứt
                  </Button>
                </div>
              )}
            </article>
          </Modal>,
          document.body,
        )}
    </>
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
    <RefreshRegion className="seller-rental">
      <section className="business-panel seller-terminations-panel">
        <div className="seller-terminations-head">
          <div>
            <h2>Kiosk đang thuê</h2>
            <p>Shop quản lý kiosk đến khi hoàn tất bàn giao.</p>
          </div>
          <IconActionButton
            action="reload"
            label="Tải lại yêu cầu chấm dứt"
            disabled={kiosks.isFetching}
            onClick={() =>
              Promise.all([
                kiosks.refetch(),
                queryClient.refetchQueries({ queryKey: ['seller-termination', sellerId] }),
              ])
            }
          />
        </div>
        {kiosks.isPending ? (
          <p role="status">Đang tải kiosk…</p>
        ) : kiosks.isError ? (
          <p role="alert">{textError(kiosks.error)}</p>
        ) : kiosks.data?.length ? (
          <div className="business-table-scroll">
            <table className="business-table rental-data-table">
              <thead>
                <tr>
                  <th>Kiosk</th>
                  <th>Địa chỉ</th>
                  <th>Trạng thái</th>
                  <th>Tiến độ bàn giao</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {kiosks.data.map((item) => (
                  <SellerTerminationCard key={item.id} kiosk={item} sellerId={sellerId} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="seller-empty-state">Shop chưa có kiosk đang quản lý.</p>
        )}
      </section>
    </RefreshRegion>
  );
}

function ManagerTerminationCard({
  item,
  technicians,
  onReviewed,
  expanded,
  onToggle,
  inDialog = false,
}: {
  inDialog?: boolean;
  expanded: boolean;
  onToggle: () => void;
  item: Termination;
  technicians: StaffDirectoryMember[];
  onReviewed: () => void;
}) {
  const [reason, setReason] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [instructions, setInstructions] = useState('');
  const [notes, setNotes] = useState('');
  const [evidenceReference, setEvidenceReference] = useState('');
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [notice, setNotice] = useState('');
  const [needsOutcomeCheck, setNeedsOutcomeCheck] = useState(false);
  const [checkingOutcome, setCheckingOutcome] = useState(false);
  const [outcomeCheckError, setOutcomeCheckError] = useState('');
  const markUncertainOutcome = (error: unknown) => {
    if (requiresOutcomeCheck(error)) {
      setNeedsOutcomeCheck(true);
      setConfirmArchive(false);
      setNotice('');
    }
  };
  const managerRole = 'OPERATIONS_MANAGER' as const;
  const kioskState = useQuery({
    queryKey: ['termination-kiosk-state', item.kioskId, item.correlatedTaskId],
    queryFn: () => request<TaskDetail>(`/operations/staff-tasks/${item.correlatedTaskId}`),
    enabled: item.status === 'COMPLETED' && Boolean(item.correlatedTaskId),
    refetchInterval: 30_000,
  });

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
    onError: markUncertainOutcome,
    onSuccess: async () => {
      setNotice('Đã cập nhật kết quả xem xét.');
      onReviewed();
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
    onError: markUncertainOutcome,
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
    onError: markUncertainOutcome,
    onSuccess: async () => {
      setNotice(
        'Đã xác nhận bàn giao. Tiếp tục bước 4 để ngừng sử dụng và lưu trữ tủ khi đủ điều kiện.',
      );
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
    onError: markUncertainOutcome,
    onSuccess: async () => {
      setConfirmArchive(false);
      setNotice(
        `Đã ngừng sử dụng và lưu trữ tủ ${item.kioskCode || item.kioskName || item.kioskId}. Tủ không còn trong kho khả dụng; lịch sử được giữ lại.`,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['operations-terminations'] }),
        queryClient.invalidateQueries({ queryKey: ['termination-kiosk-state', item.kioskId] }),
        queryClient.invalidateQueries({ queryKey: ['available-kiosks-inventory'] }),
        queryClient.invalidateQueries({ queryKey: ['eligible-kiosks'] }),
      ]);
    },
  });
  async function checkLatestOutcome() {
    if (checkingOutcome) return;
    setCheckingOutcome(true);
    setOutcomeCheckError('');
    try {
      await queryClient.refetchQueries(
        { queryKey: ['operations-terminations'], type: 'active' },
        { throwOnError: true },
      );
      if (item.status === 'COMPLETED' && item.correlatedTaskId)
        await kioskState.refetch({ throwOnError: true });
      await queryClient.invalidateQueries({ queryKey: ['staff-tasks'] });
      review.reset();
      assign.reset();
      complete.reset();
      archive.reset();
      setNeedsOutcomeCheck(false);
      setNotice(
        'Đã tải trạng thái mới nhất. Kiểm tra tiến trình và điều kiện còn thiếu trước khi thao tác tiếp.',
      );
    } catch (error) {
      setOutcomeCheckError(textError(error));
    } finally {
      setCheckingOutcome(false);
    }
  }
  const archived = archive.isSuccess || kioskState.data?.kioskStatus === 'DISABLED';
  const awaitingKioskState =
    item.status === 'COMPLETED' && Boolean(item.correlatedTaskId) && kioskState.isPending;
  const mustGoOffline = Boolean(
    kioskState.data && !['OFFLINE', 'DISABLED'].includes(kioskState.data.kioskStatus),
  );
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
  const nextStep = terminationNextStep({
    status: item.status,
    removalTaskStatus: item.correlatedTaskId ? item.removalTaskStatus : null,
    archived,
    kioskStatus: kioskState.data?.kioskStatus,
  });

  return (
    <article className="business-card termination-card">
      {!inDialog && (
        <>
          <div className="termination-card-head">
            <div>
              <div className="termination-card-title">
                {item.kioskCode && <span className="termination-code-pill">{item.kioskCode}</span>}
                <h3>
                  {item.kioskName || item.kioskCode} · {item.shopName}
                </h3>
              </div>
              <p className="termination-meta-time">
                Yêu cầu lúc{' '}
                {new Date(item.requestedAt).toLocaleString('vi-VN', {
                  timeZone: 'Asia/Ho_Chi_Minh',
                })}
              </p>
            </div>
            <span className="termination-status-pill" data-status={item.status}>
              {archived ? 'Đã lưu trữ tủ' : statusLabel[item.status] || item.status}
            </span>
          </div>

          <div className="termination-next-action">
            <div>
              {!archived && (
                <>
                  <span className="termination-owner">{nextStep.owner}</span>
                  <p>{nextStep.text}</p>
                </>
              )}
            </div>
            <Button
              type="button"
              variant={nextStep.attention && !expanded ? 'default' : 'outline'}
              aria-expanded={expanded}
              aria-controls={`termination-body-${item.id}`}
              aria-label={`${expanded ? 'Thu gọn' : 'Mở'} hồ sơ ${item.kioskCode || item.kioskName}`}
              onClick={onToggle}
            >
              {expanded ? 'Thu gọn' : nextStep.action}
            </Button>
          </div>
        </>
      )}
      <div id={`termination-body-${item.id}`} hidden={!expanded}>
        {item.status !== 'REJECTED' && item.status !== 'CANCELLED' && (
          <ol className="termination-stepper" aria-label="Tiến trình chấm dứt thuê">
            <li className="termination-step" data-state={step1State}>
              <strong>1 · Duyệt yêu cầu</strong>
              <span>{item.status === 'REQUESTED' ? 'Chờ xem xét' : 'Đã chấp thuận'}</span>
            </li>
            <li className="termination-step" data-state={step2State}>
              <strong>2 · Tháo dỡ</strong>
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
              <strong>3 · Bàn giao</strong>
              <span>
                {item.status === 'COMPLETED'
                  ? 'Đã bàn giao'
                  : canComplete
                    ? 'Chờ quản lý kiểm tra'
                    : 'Chờ báo cáo tháo dỡ'}
              </span>
            </li>
            <li
              className="termination-step"
              data-state={archived ? 'done' : item.status === 'COMPLETED' ? 'active' : 'idle'}
            >
              <strong>4 · Lưu trữ</strong>
              <span>
                {archived
                  ? 'Đã lưu trữ, kết thúc luồng'
                  : item.status === 'COMPLETED'
                    ? 'Kiểm tra điều kiện lưu trữ'
                    : 'Chờ hoàn tất bàn giao'}
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
          {!archived && (item.lifecycleStatus || item.removalTaskStatus) && (
            <p>
              <strong>Trạng thái chi tiết:</strong>{' '}
              {archived
                ? 'Tủ đã ngừng sử dụng, không còn trong kho khả dụng'
                : lifecycleLabel[item.lifecycleStatus || ''] ||
                  statusLabel[item.status] ||
                  item.status}
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
                disabled={review.isPending || needsOutcomeCheck || reason.trim().length < 10}
                onClick={() => review.mutate('ACCEPT')}
              >
                Chấp thuận
              </Button>
              <Button
                variant="outline"
                disabled={review.isPending || needsOutcomeCheck || reason.trim().length < 10}
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
              if (
                !needsOutcomeCheck &&
                !assign.isPending &&
                assigneeId &&
                instructions.trim().length >= 10
              ) {
                assign.mutate();
              }
            }}
          >
            <h4>Phân công kỹ thuật viên tháo dỡ</h4>

            <label htmlFor={`term-assignee-${item.id}`}>Kỹ thuật viên phụ trách</label>
            <Select
              id={`term-assignee-${item.id}`}
              required
              value={assigneeId}
              onChange={(event) => setAssigneeId(event.target.value)}
              disabled={assign.isPending || needsOutcomeCheck}
            >
              <option value="">Chọn kỹ thuật viên</option>
              {technicians.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.name}
                </option>
              ))}
            </Select>
            <label htmlFor={`term-instructions-${item.id}`}>
              Hướng dẫn tháo dỡ (10–2.000 ký tự)
            </label>
            <textarea
              id={`term-instructions-${item.id}`}
              minLength={10}
              maxLength={2000}
              required
              rows={3}
              placeholder="Nhập hướng dẫn kiểm tra, tháo dỡ và thu hồi kiosk tại điểm đặt…"
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              disabled={assign.isPending || needsOutcomeCheck}
            />
            <div>
              <Button
                type="submit"
                disabled={
                  assign.isPending ||
                  needsOutcomeCheck ||
                  !assigneeId ||
                  instructions.trim().length < 10
                }
              >
                {assign.isPending ? 'Đang phân công…' : 'Phân công tháo dỡ'}
              </Button>
            </div>
          </form>
        )}
        {item.status === 'ACCEPTED' && !needsAssignment && !canComplete && (
          <div className="termination-waiting-box" role="status">
            <strong>Đang chờ kỹ thuật viên tháo dỡ & gửi báo cáo</strong>
          </div>
        )}
        {item.correlatedTaskId && (
          <div className="termination-task-box">
            <StaffEvidence
              key={`${item.correlatedTaskId}:${item.version}:${item.removalTaskStatus}`}
              taskId={item.correlatedTaskId}
              version={Number(item.version) || 1}
              apiBase="/operations/staff-tasks"
              role={managerRole}
              mode="manager"
              admin
              active={false}
            />
            <StaffTaskDetails
              key={`${item.correlatedTaskId}:${item.removalTaskStatus}`}
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
              Kiểm tra ảnh, báo cáo và thực tế tại tủ trước khi bàn giao. Tủ cần sạch hoa, ô khóa và
              việc tồn đọng.
            </p>
            <label htmlFor={`term-notes-${item.id}`}>Ghi chú bàn giao (tùy chọn)</label>
            <textarea
              id={`term-notes-${item.id}`}
              value={notes}
              disabled={complete.isPending || needsOutcomeCheck}
              onChange={(event) => setNotes(event.target.value)}
            />
            <details className="termination-optional-evidence">
              <summary>Đính kèm thêm ảnh biên bản từ quản lý (không bắt buộc)</summary>
              <div style={{ marginTop: '0.6rem' }}>
                <EvidenceUpload
                  id={`term-evidence-${item.id}`}
                  endpoint={`/api/operations/kiosk-termination-requests/${item.id}/evidence/upload`}
                  disabled={complete.isPending || needsOutcomeCheck}
                  onReference={setEvidenceReference}
                />
              </div>
            </details>
            <div>
              <Button
                disabled={complete.isPending || needsOutcomeCheck}
                onClick={() => complete.mutate()}
              >
                {complete.isPending ? 'Đang xác nhận…' : 'Xác nhận đã bàn giao'}
              </Button>
            </div>
          </div>
        )}
        {item.status === 'COMPLETED' && (
          <div className="business-form termination-action-panel">
            {item.completionNotes && <p>Ghi chú bàn giao: {item.completionNotes}</p>}
            {archived ? (
              <div role="status">
                <p>Lịch sử được giữ lại.</p>
              </div>
            ) : (
              <>
                <h4>Bước 4 · Ngừng sử dụng và lưu trữ tủ</h4>
                <p>Lưu trữ để ngừng sử dụng tủ. Lịch sử được giữ lại.</p>
                {awaitingKioskState && <p role="status">Đang kiểm tra trạng thái tủ…</p>}
                {kioskState.data && (
                  <p>
                    Trạng thái kết nối: <strong>{kioskState.data.kioskStatus}</strong>.
                  </p>
                )}
                {mustGoOffline && <p>Tủ phải OFFLINE trước khi lưu trữ.</p>}
                {kioskState.isError && (
                  <p role="alert">
                    Chưa đọc được trạng thái tủ. Tải lại trạng thái để kiểm tra trước khi lưu trữ.
                  </p>
                )}
                {item.correlatedTaskId && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={kioskState.isFetching || archive.isPending}
                    onClick={() => void kioskState.refetch()}
                  >
                    Cập nhật trạng thái tủ
                  </Button>
                )}
                {!confirmArchive ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      archive.isPending ||
                      needsOutcomeCheck ||
                      awaitingKioskState ||
                      mustGoOffline ||
                      kioskState.isError
                    }
                    onClick={() => setConfirmArchive(true)}
                  >
                    Lưu trữ tủ {item.kioskCode || item.kioskName || ''}
                  </Button>
                ) : (
                  <div>
                    <p>
                      <strong>
                        Xác nhận ngừng sử dụng và lưu trữ tủ{' '}
                        {item.kioskCode || item.kioskName || item.kioskId}?
                      </strong>{' '}
                      Tủ phải OFFLINE, không còn gán shop/hợp đồng đang hiệu lực, hoa, ô khóa, đơn
                      hàng, thanh toán, sự cố hoặc công việc chưa kết thúc. Lịch sử được giữ lại. Tủ
                      đã lưu trữ sẽ không xuất hiện trong kho khả dụng.
                    </p>
                    <div className="business-inline">
                      <Button
                        type="button"
                        disabled={
                          archive.isPending ||
                          needsOutcomeCheck ||
                          awaitingKioskState ||
                          mustGoOffline ||
                          kioskState.isError
                        }
                        onClick={() => archive.mutate()}
                      >
                        {archive.isPending ? 'Đang lưu trữ…' : 'Xác nhận lưu trữ tủ'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={archive.isPending}
                        onClick={() => setConfirmArchive(false)}
                      >
                        Quay lại
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        {needsOutcomeCheck && (
          <div className="termination-outcome-check" role="alert">
            <strong>Cần kiểm tra lại trạng thái trước khi gửi tiếp</strong>
            <p>
              Phản hồi trước chưa xác nhận được kết quả hoặc hồ sơ đã thay đổi. Không bấm gửi lại để
              tránh xử lý trùng.
            </p>
            <Button
              variant="outline"
              disabled={checkingOutcome}
              onClick={() => void checkLatestOutcome()}
            >
              {checkingOutcome ? 'Đang kiểm tra…' : 'Kiểm tra kết quả mới nhất'}
            </Button>
            {outcomeCheckError && <p>{outcomeCheckError}</p>}
          </div>
        )}
        {notice && <p role="status">{notice}</p>}
        {(review.isError || assign.isError || complete.isError || archive.isError) && (
          <p role="alert">
            {textError(review.error || assign.error || complete.error || archive.error)}
          </p>
        )}
      </div>
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
        Kiosk {item.kioskId} · {item.walkInSlots} ô bán sẵn / {item.preorderSlots} ô đặt trước ·{' '}
        {item.status}
      </h3>
      <p>Lý do của shop: {item.reason}</p>
      {item.status === 'PENDING' && (
        <div className="business-form">
          {item.preorderSlots === 0 ? (
            <p>Tất cả ô sẽ chuyển sang bán sẵn. Các ô đổi loại phải trống và không giữ đơn.</p>
          ) : (
            <fieldset aria-describedby={`layout-slot-hint-${item.id}`}>
              <legend>Chọn {item.preorderSlots} ô đặt trước</legend>
              <p id={`layout-slot-hint-${item.id}`}>
                Đã chọn {preorderSlotIds.length}/{item.preorderSlots} ô. Các ô đổi loại phải trống
                và không giữ đơn.
              </p>
              {slotDirectory.isPending ? (
                <p role="status">Đang tải danh sách ô…</p>
              ) : slotDirectory.isError ? (
                <>
                  <p role="alert">Chưa tải được danh sách ô của kiosk.</p>
                  <IconActionButton
                    type="button"
                    variant="outline"
                    onClick={() => void slotDirectory.refetch()}
                    action="reload"
                    label="Tải lại danh sách ô"
                  />
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [locationOpen, setLocationOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const records = useQuery({
    ...liveListOptions(!expandedId),
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
          <h2 className="sr-only">Hồ sơ chấm dứt thuê kiosk</h2>
        </div>
        {records.isError && (
          <IconActionButton
            variant="outline"
            onClick={() => void records.refetch()}
            action="reload"
            label="Làm mới"
          />
        )}
      </div>
      <div className="termination-list-tools">
        <div>
          <label htmlFor="termination-search">Tìm hồ sơ trong trang</label>
          <input
            id="termination-search"
            type="search"
            value={search}
            placeholder="Mã tủ, tên kiosk hoặc shop…"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="termination-filter">Trạng thái </label>
          <Select
            id="termination-filter"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
              setExpandedId(null);
              setSearch('');
            }}
          >
            <option value="">Tất cả</option>
            <option value="REQUESTED">Chờ xem xét</option>
            <option value="ACCEPTED">Chờ bàn giao</option>
            <option value="REJECTED">Đã từ chối</option>
            <option value="CANCELLED">Đã rút yêu cầu</option>
            <option value="COMPLETED">Đã bàn giao</option>
          </Select>
        </div>
      </div>
      {records.isPending ? (
        <p role="status">Đang tải hồ sơ…</p>
      ) : records.isError ? (
        <p role="alert">{textError(records.error)}</p>
      ) : records.data?.items.length ? (
        <WorkspaceTable label="Hồ sơ chấm dứt thuê kiosk">
          <table className="operations-termination-table">
            <thead>
              <tr>
                <th scope="col">Kiosk / Shop</th>
                <th scope="col">Ngày yêu cầu</th>
                <th scope="col">Trạng thái</th>
                <th scope="col">Tháo dỡ</th>
                <th scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {records.data.items
                .filter((item) =>
                  [item.kioskCode, item.kioskName, item.shopName]
                    .filter(Boolean)
                    .join(' ')
                    .toLocaleLowerCase('vi')
                    .includes(search.trim().toLocaleLowerCase('vi')),
                )
                .map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.kioskName || item.kioskCode}</strong>
                      <span className="table-secondary">
                        {item.kioskCode} · {item.shopName}
                      </span>
                    </td>
                    <td>
                      <time dateTime={item.requestedAt}>
                        {new Date(item.requestedAt).toLocaleDateString('vi-VN', {
                          timeZone: 'Asia/Ho_Chi_Minh',
                        })}
                      </time>
                    </td>
                    <td>
                      <span className="table-badge" data-state={item.status}>
                        {statusLabel[item.status] || item.status}
                      </span>
                    </td>
                    <td>
                      {item.removalTaskStatus
                        ? removalTaskLabel[item.removalTaskStatus] || item.removalTaskStatus
                        : '—'}
                    </td>
                    <td>
                      <Button
                        variant="outline"
                        aria-label={`Mở hồ sơ ${item.kioskCode || item.kioskName}`}
                        onClick={() => setExpandedId(item.id)}
                      >
                        Xem
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {search.trim() &&
            !records.data.items.some((item) =>
              [item.kioskCode, item.kioskName, item.shopName]
                .filter(Boolean)
                .join(' ')
                .toLocaleLowerCase('vi')
                .includes(search.trim().toLocaleLowerCase('vi')),
            ) && (
              <p className="operations-register-empty">Không có hồ sơ phù hợp trong trang này.</p>
            )}
        </WorkspaceTable>
      ) : (
        <p>Không có hồ sơ trong trạng thái này.</p>
      )}
      <Modal
        open={!!expandedId}
        onClose={() => setExpandedId(null)}
        title={
          records.data?.items.find((item) => item.id === expandedId)?.kioskCode ||
          'Hồ sơ chấm dứt thuê'
        }
        size="lg"
        description={
          records.data?.items.find((item) => item.id === expandedId)?.shopName ?? undefined
        }
        className="termination-record-dialog"
      >
        {records.data?.items
          .filter((item) => item.id === expandedId)
          .map((item) => (
            <ManagerTerminationCard
              key={item.id}
              item={item}
              expanded
              inDialog
              onToggle={() => setExpandedId(null)}
              technicians={technicians.data ?? []}
              onReviewed={() => {
                setStatus('');
                setPage(1);
              }}
            />
          ))}
      </Modal>
      {records.data && (
        <div
          className="business-pagination termination-pagination"
          aria-label="Phân trang hồ sơ chấm dứt"
        >
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
          <strong>Đổi vị trí kiosk</strong>
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
          <strong>Đổi cơ cấu ô</strong>
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
