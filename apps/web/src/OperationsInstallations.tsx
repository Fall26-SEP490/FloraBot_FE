'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, CircleAlert, Check, RefreshCw, ClipboardList, Eye, X, Lock } from '@florabot/ui';
import { ApiError, queryClient, request, type Session } from './api';
import type {
  KioskApplicationResponse,
  KioskApplicationPage,
  KioskApplicationDetailResponse,
  EligibleKioskResponse,
  EnrollKioskRequest,
  EnrollKioskResponse,
  ProvisionKioskKeyResponse,
  IncidentPhoto,
} from './kioskApplicationTypes';
import { KIOSK_STATUS_LABELS } from './kioskApplicationTypes';
import type { AccountDirectoryItem } from './AccountManagement';
import { Modal } from './dashboard/Modal';
import './kiosk-shared.css';
import './operations-installations.css';

interface OperationsInstallationsProps {
  session: Session;
}

interface DetailCardProps {
  appId: string;
  session: Session;
  isManager: boolean;
  onClose: () => void;
  onOpenEnroll: (walkIn: number, preorder: number) => void;
  onShowProvisionedKey: (info: { kioskId: string; code: string; apiKey: string }) => void;
  onInvalidateQueue: () => void;
}

function OperationsEvidenceImage({
  appId,
  evidenceId,
  label,
}: {
  appId: string;
  evidenceId: string;
  label: string;
}) {
  const [loadError, setLoadError] = useState(false);
  const src = `/api/operations/kiosk-applications/${appId}/evidence/${evidenceId}`;

  return (
    <div className="evidence-thumb-card">
      <span className="thumb-label">{label}</span>
      {!loadError ? (
        <img
          src={src}
          alt={label}
          loading="lazy"
          className="evidence-actual-img"
          onError={() => setLoadError(true)}
        />
      ) : (
        <div className="evidence-fallback-box">
          <CircleAlert size={16} aria-hidden="true" />
          <small>Không tải được ảnh</small>
        </div>
      )}
      <small className="thumb-ref">{evidenceId.slice(0, 8)}</small>
    </div>
  );
}

function OperationsDetailCard({
  appId,
  session,
  isManager,
  onClose,
  onOpenEnroll,
  onShowProvisionedKey,
  onInvalidateQueue,
}: DetailCardProps) {
  const [confirmNote, setConfirmNote] = useState('');
  const [reworkReason, setReworkReason] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [platformFailureReason, setPlatformFailureReason] = useState('');
  const [techDraft, setSelectedTechId] = useState<string>();
  const [kioskDraft, setSelectedKioskId] = useState<string>();
  const [dateDraft, setScheduledDate] = useState<string>();
  const [windowDraft, setTimeWindow] = useState<string>();
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    panelRef.current?.focus();
  }, [appId]);

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const confirmNoteId = useId();
  const reworkReasonId = useId();
  const rejectReasonId = useId();
  const failureReasonId = useId();
  const techSelectId = useId();
  const kioskSelectId = useId();
  const scheduleDateId = useId();
  const timeWindowId = useId();

  // Query: Selected Application Detail (returns wrapper { application, evidencePhotos })
  const selectedAppQuery = useQuery({
    queryKey: ['operations-kiosk-application-detail', session.id, appId],
    queryFn: () =>
      request<KioskApplicationDetailResponse>(`/operations/kiosk-applications/${appId}`),
  });

  const detailData = selectedAppQuery.data;
  const appDetail: KioskApplicationResponse | null = detailData?.application ?? null;
  const evidencePhotos: IncidentPhoto[] = detailData?.evidencePhotos ?? [];
  const selectedTechId = techDraft ?? appDetail?.assignedTechnicianId ?? '';
  const selectedKioskId = kioskDraft ?? appDetail?.assignedKioskId ?? '';
  const scheduledDate = dateDraft ?? appDetail?.scheduledDate?.slice(0, 10) ?? '';
  const timeWindow = windowDraft ?? appDetail?.timeWindow ?? '09:00 - 12:00';
  const needsSchedule = appDetail?.status === 'CONFIRMED' || appDetail?.status === 'SCHEDULED';

  // Query: Active Technicians Directory
  const techniciansQuery = useQuery({
    queryKey: ['account-directory', 'TECHNICIAN', 'platform', '/operations/technicians'],
    queryFn: () => request<AccountDirectoryItem[]>('/operations/technicians'),
    enabled: isManager && needsSchedule,
  });

  const activeTechnicians = (techniciansQuery.data || []).filter((t) => t.status === 'ACTIVE');

  // Query: Eligible Kiosks for this package
  const eligibleKiosksQuery = useQuery({
    queryKey: ['eligible-kiosks', session.id, appDetail?.packageId],
    queryFn: () =>
      request<EligibleKioskResponse[]>(
        `/operations/eligible-kiosks?packageId=${appDetail?.packageId}`,
      ),
    enabled: isManager && needsSchedule && !!appDetail?.packageId,
  });

  const eligibleKiosks = eligibleKiosksQuery.data || [];

  const invalidateSelf = () => {
    onInvalidateQueue();
    void queryClient.invalidateQueries({
      queryKey: ['operations-kiosk-application-detail', session.id, appId],
    });
    void queryClient.invalidateQueries({
      queryKey: ['eligible-kiosks', session.id, appDetail?.packageId],
    });
  };

  const confirmMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      request<KioskApplicationResponse>(`/operations/kiosk-applications/${id}/confirm`, { note }),
    onSuccess: (res) => {
      setActionSuccess(`Đã xác nhận liên hệ cho shop ${res.shopName}. Trạng thái: CONFIRMED.`);
      setActionError(null);
      setConfirmNote('');
      invalidateSelf();
    },
    onError: (err) => {
      setActionError(err instanceof ApiError ? err.message : 'Chưa xác nhận được liên hệ.');
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: ({
      id,
      technicianId,
      kioskId,
      scheduledDate,
      timeWindow,
    }: {
      id: string;
      technicianId: string;
      kioskId: string;
      scheduledDate: string;
      timeWindow: string;
    }) =>
      request<KioskApplicationResponse>(`/operations/kiosk-applications/${id}/schedule`, {
        technicianId,
        kioskId,
        scheduledDate,
        timeWindow,
      }),
    onSuccess: (res) => {
      setActionSuccess(`Đã phân công KTV và lên lịch cho shop ${res.shopName}.`);
      setActionError(null);
      invalidateSelf();
    },
    onError: (err) => {
      setActionError(err instanceof ApiError ? err.message : 'Chưa lưu được lịch lắp đặt.');
    },
  });

  const handoverMutation = useMutation({
    mutationFn: (id: string) =>
      request<KioskApplicationResponse>(`/operations/kiosk-applications/${id}/handover`, {}),
    onSuccess: (res) => {
      setActionSuccess(`Đã nghiệm thu bàn giao và kích hoạt Chủ shop cho ${res.shopName}!`);
      setActionError(null);
      invalidateSelf();
    },
    onError: (err) => {
      setActionError(
        err instanceof ApiError
          ? err.message
          : 'Chưa hoàn tất bàn giao. Cần có ít nhất 1 ảnh minh chứng hợp lệ.',
      );
    },
  });

  const reworkMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      request<KioskApplicationResponse>(`/operations/kiosk-applications/${id}/rework`, { reason }),
    onSuccess: () => {
      setActionSuccess('Đã yêu cầu kỹ thuật viên kiểm tra / sửa lại.');
      setActionError(null);
      setReworkReason('');
      invalidateSelf();
    },
    onError: (err) => {
      setActionError(err instanceof ApiError ? err.message : 'Chưa gửi được yêu cầu sửa lại.');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      request<KioskApplicationResponse>(`/operations/kiosk-applications/${id}/reject`, { reason }),
    onSuccess: () => {
      setActionSuccess('Đã từ chối hồ sơ. Khoản thanh toán (nếu có) đã chuyển sang hoàn tiền.');
      setActionError(null);
      setRejectReason('');
      invalidateSelf();
    },
    onError: (err) => {
      setActionError(err instanceof ApiError ? err.message : 'Chưa từ chối được hồ sơ.');
    },
  });

  const platformFailureMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      request<KioskApplicationResponse>(`/operations/kiosk-applications/${id}/platform-failure`, {
        reason,
      }),
    onSuccess: () => {
      setActionSuccess('Đã ghi nhận sự cố bất khả kháng. Hồ sơ chuyển sang hoàn tiền.');
      setActionError(null);
      setPlatformFailureReason('');
      invalidateSelf();
    },
    onError: (err) => {
      setActionError(
        err instanceof ApiError ? err.message : 'Chưa xử lý được sự cố bất khả kháng.',
      );
    },
  });

  // Provision / rotate key mutation
  const provisionKeyMutation = useMutation({
    mutationFn: (kioskId: string) =>
      request<ProvisionKioskKeyResponse>(`/operations/kiosks/${kioskId}/provision-key`, {}),
    onSuccess: (res) => {
      onShowProvisionedKey({
        kioskId: res.kioskId,
        code: appDetail?.assignedKioskCode || res.kioskId.slice(0, 8),
        apiKey: res.apiKey,
      });
    },
    onError: (err) => {
      setActionError(err instanceof ApiError ? err.message : 'Chưa cấp được khóa thiết bị.');
    },
  });

  const actionPending = [
    confirmMutation,
    scheduleMutation,
    handoverMutation,
    reworkMutation,
    rejectMutation,
    platformFailureMutation,
    provisionKeyMutation,
  ].some((mutation) => mutation.isPending);
  const activeStep =
    appDetail?.status === 'PAID_REVIEW'
      ? 0
      : needsSchedule
        ? 1
        : ['INSTALLING', 'AWAITING_HANDOVER'].includes(appDetail?.status ?? '')
          ? 2
          : appDetail?.status === 'ACTIVE'
            ? 3
            : -1;

  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      className="operations-detail-panel"
      aria-labelledby="detail-panel-title"
    >
      <div className="detail-panel-header">
        <div>
          <span className="kiosk-status-pill" data-status={appDetail?.status}>
            {appDetail ? KIOSK_STATUS_LABELS[appDetail.status] || appDetail.status : 'Đang tải...'}
          </span>
          <h2 id="detail-panel-title">
            {appDetail ? `Chi tiết: ${appDetail.shopName}` : 'Đang tải hồ sơ...'}
          </h2>
        </div>
        <button
          type="button"
          className="kiosk-modal-close"
          onClick={onClose}
          aria-label="Đóng chi tiết"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      {actionSuccess && (
        <div role="status" className="status-notice notice-success">
          <Check size={18} aria-hidden="true" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div role="alert" className="kiosk-field-error-banner">
          <CircleAlert size={18} aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      )}

      {selectedAppQuery.isLoading && (
        <p role="status" className="kiosk-status-loading">
          <RefreshCw className="spin" size={16} aria-hidden="true" /> Đang tải chi tiết...
        </p>
      )}

      {selectedAppQuery.isError && (
        <div role="alert" className="kiosk-field-error-banner">
          <span>
            {selectedAppQuery.error instanceof ApiError
              ? selectedAppQuery.error.message
              : 'Không tải được chi tiết hồ sơ.'}
          </span>
          <Button variant="outline" onClick={() => void selectedAppQuery.refetch()}>
            Thử lại chi tiết
          </Button>
        </div>
      )}

      {appDetail && !selectedAppQuery.isError && (
        <div className="detail-panel-content">
          <ol className="operations-detail-progress" aria-label="Tiến độ hồ sơ">
            {['Xác nhận liên hệ', 'Xếp lịch lắp đặt', 'Nghiệm thu', 'Bàn giao'].map(
              (label, index) => (
                <li key={label} aria-current={activeStep === index ? 'step' : undefined}>
                  {index + 1}. {label}
                </li>
              ),
            )}
          </ol>
          {/* Basic Meta Grid */}
          <dl className="detail-info-grid">
            <div>
              <dt>Gói đăng ký</dt>
              <dd>
                <strong>{appDetail.packageName}</strong> (
                {Number(appDetail.annualFee).toLocaleString('vi-VN')} đ/năm)
                <br />
                {appDetail.walkInSlots} ô vãng lai + {appDetail.preorderSlots} ô đặt trước (
                {appDetail.totalSlots} ô tổng)
              </dd>
            </div>
            <div>
              <dt>Thông tin liên hệ</dt>
              <dd>
                <a className="detail-contact-link" href={`tel:${appDetail.phone}`}>
                  {appDetail.phone}
                </a>
                <br />
                <a className="detail-contact-link" href={`mailto:${appDetail.contactEmail}`}>
                  {appDetail.contactEmail}
                </a>
              </dd>
            </div>
            <div>
              <dt>Địa chỉ đề xuất</dt>
              <dd>
                {appDetail.installationAddress}
                <br />
                <small>
                  Tọa độ: {Number(appDetail.latitude).toFixed(6)},{' '}
                  {Number(appDetail.longitude).toFixed(6)}
                </small>
              </dd>
            </div>
            <div>
              <dt>Tài khoản nhận tiền</dt>
              <dd>
                {appDetail.bankName} - ****{appDetail.bankAccountSuffix} ({appDetail.bankHolder})
              </dd>
            </div>
          </dl>

          {appDetail.assignedTechnicianId && (
            <div className="status-notice notice-info">
              <div>
                <strong>Lịch lắp đặt</strong>
                <p>
                  {appDetail.assignedTechnicianName || 'Kỹ thuật viên đã phân công'} ·{' '}
                  {appDetail.scheduledDate
                    ? new Date(
                        `${appDetail.scheduledDate.slice(0, 10)}T00:00:00`,
                      ).toLocaleDateString('vi-VN')
                    : 'Chưa có ngày'}{' '}
                  · {appDetail.timeWindow || 'Chưa có khung giờ'}
                </p>
              </div>
            </div>
          )}

          <fieldset disabled={actionPending} aria-busy={actionPending}>
            <legend className="sr-only">Xử lý hồ sơ</legend>

            {appDetail.reviewNote && (
              <div className="status-notice notice-info">
                <strong>Ghi chú xác nhận liên hệ:</strong>
                <p>{appDetail.reviewNote}</p>
              </div>
            )}

            {/* Provision Key Option for assigned kiosk */}
            {appDetail.assignedKioskId && isManager && (
              <div
                className="status-notice notice-info operations-kiosk-assignment"
                style={{ justifyContent: 'space-between' }}
              >
                <div>
                  <strong>Tủ đã phân bổ: {appDetail.assignedKioskCode}</strong>
                  <p>Bạn có thể cấp lại khóa API thiết bị nếu cần nạp lại cấu hình phần cứng.</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (
                      confirm(
                        'Cấp lại khóa API sẽ vô hiệu hóa khóa cũ của tủ. Bạn có chắc chắn muốn cấp lại không?',
                      )
                    ) {
                      provisionKeyMutation.mutate(appDetail.assignedKioskId!);
                    }
                  }}
                  disabled={provisionKeyMutation.isPending}
                >
                  <Lock size={16} aria-hidden="true" />
                  {provisionKeyMutation.isPending ? 'Đang cấp...' : 'Cấp lại khóa API'}
                </Button>
              </div>
            )}

            {/* ACTION: PAID_REVIEW -> CONFIRM CONTACT */}
            {appDetail.status === 'AWAITING_PAYMENT' && isManager && (
              <div className="operations-action-card">
                <h3>Hồ sơ đang chờ khách thanh toán</h3>
                <p>
                  Chỉ xác nhận liên hệ và xếp lịch sau khi hệ thống xác minh thanh toán thành công.
                </p>
                <details>
                  <summary>Từ chối hồ sơ không đủ điều kiện</summary>
                  <div className="kiosk-form-field">
                    <label htmlFor={rejectReasonId}>Lý do từ chối (tối thiểu 5 ký tự):</label>
                    <textarea
                      id={rejectReasonId}
                      value={rejectReason}
                      onChange={(event) => setRejectReason(event.target.value)}
                      rows={2}
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (rejectReason.trim().length < 5) {
                        setActionError('Lý do từ chối cần ít nhất 5 ký tự.');
                        return;
                      }
                      rejectMutation.mutate({ id: appDetail.id, reason: rejectReason.trim() });
                    }}
                  >
                    Từ chối hồ sơ
                  </Button>
                </details>
              </div>
            )}
            {appDetail.status === 'PAID_REVIEW' && isManager && (
              <div className="operations-action-card">
                <h3>Bước 1: Xác nhận liên hệ với chủ shop</h3>
                <p>
                  Quản lý vận hành gọi điện xác nhận địa chỉ lắp đặt và vị trí nguồn điện. Sau bước
                  này, khách không thể tự ý hủy hồ sơ.
                </p>
                <div className="kiosk-form-field">
                  <label htmlFor={confirmNoteId}>Ghi chú xác nhận liên hệ (bắt buộc):</label>
                  <textarea
                    id={confirmNoteId}
                    rows={2}
                    value={confirmNote}
                    onChange={(e) => setConfirmNote(e.target.value)}
                    placeholder="Ví dụ: Đã gọi điện xác nhận địa chỉ và vị trí đặt kiosk với chủ shop..."
                  />
                </div>
                <div className="action-buttons-row">
                  <Button
                    onClick={() => {
                      if (confirmNote.trim().length < 5) {
                        setActionError('Ghi chú xác nhận liên hệ cần ít nhất 5 ký tự.');
                        return;
                      }
                      confirmMutation.mutate({ id: appDetail.id, note: confirmNote.trim() });
                    }}
                    disabled={confirmMutation.isPending}
                  >
                    <Check size={18} aria-hidden="true" />
                    {confirmMutation.isPending ? 'Đang xác nhận...' : 'Xác nhận liên hệ'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (rejectReason.trim().length < 5) {
                        setActionError('Lý do từ chối cần ít nhất 5 ký tự.');
                        return;
                      }
                      rejectMutation.mutate({ id: appDetail.id, reason: rejectReason.trim() });
                    }}
                    disabled={rejectMutation.isPending}
                  >
                    Từ chối hồ sơ
                  </Button>
                </div>
                <div className="kiosk-form-field" style={{ marginTop: '0.75rem' }}>
                  <label htmlFor={rejectReasonId}>Lý do từ chối (nếu không đạt):</label>
                  <input
                    id={rejectReasonId}
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Lý do từ chối nếu vị trí không đủ điều kiện an toàn..."
                  />
                </div>
              </div>
            )}

            {/* ACTION: CONFIRMED or SCHEDULED -> SCHEDULE TECHNICIAN & KIOSK */}
            {(appDetail.status === 'CONFIRMED' || appDetail.status === 'SCHEDULED') &&
              isManager && (
                <div className="operations-action-card">
                  <h3>Bước 2: Phân công Kỹ thuật viên & Cấp phát Tủ Kiosk</h3>
                  <p>
                    Chọn một kỹ thuật viên đang hoạt động và một tủ kiosk trống có đúng cấu hình{' '}
                    {appDetail.walkInSlots} ô vãng lai + {appDetail.preorderSlots} ô đặt trước.
                  </p>

                  <div className="form-fields-grid-2">
                    <div className="kiosk-form-field">
                      <label htmlFor={techSelectId}>Kỹ thuật viên phụ trách (ACTIVE):</label>
                      <select
                        id={techSelectId}
                        value={selectedTechId}
                        onChange={(e) => setSelectedTechId(e.target.value)}
                      >
                        <option value="">-- Chọn kỹ thuật viên --</option>
                        {activeTechnicians.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.fullName} ({t.phone || t.email})
                          </option>
                        ))}
                      </select>
                      {techniciansQuery.isError && (
                        <p role="alert" className="kiosk-field-error">
                          Không tải được kỹ thuật viên.{' '}
                          <button type="button" onClick={() => void techniciansQuery.refetch()}>
                            Thử lại
                          </button>
                        </p>
                      )}
                      {techniciansQuery.isPending && (
                        <small role="status">Đang tải kỹ thuật viên…</small>
                      )}
                      {techniciansQuery.isSuccess && activeTechnicians.length === 0 && (
                        <small className="kiosk-field-error">
                          Không có kỹ thuật viên ACTIVE nào. Vui lòng kích hoạt trong mục Kỹ thuật
                          viên.
                        </small>
                      )}
                    </div>

                    <div className="kiosk-form-field">
                      <div className="field-label-with-action">
                        <label htmlFor={kioskSelectId}>Tủ Kiosk cấp phát:</label>
                        <button
                          type="button"
                          className="link-inline-btn"
                          onClick={() =>
                            onOpenEnroll(
                              Number(appDetail.walkInSlots),
                              Number(appDetail.preorderSlots),
                            )
                          }
                        >
                          + Thêm tủ mới (Asset Enrollment)
                        </button>
                      </div>
                      <select
                        id={kioskSelectId}
                        value={selectedKioskId}
                        onChange={(e) => setSelectedKioskId(e.target.value)}
                      >
                        <option value="">-- Chọn tủ kiosk phù hợp --</option>
                        {appDetail.status === 'SCHEDULED' &&
                          appDetail.assignedKioskId &&
                          !eligibleKiosks.some((k) => k.id === appDetail.assignedKioskId) && (
                            <option value={appDetail.assignedKioskId}>
                              {appDetail.assignedKioskCode} · Tủ đang phân công cho hồ sơ này
                            </option>
                          )}
                        {eligibleKiosks.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.code} - {k.name} ({k.walkInSlots}W + {k.preorderSlots}P) [{k.status}]
                          </option>
                        ))}
                      </select>
                      {eligibleKiosksQuery.isError && (
                        <p role="alert" className="kiosk-field-error">
                          Không tải được tủ khả dụng.{' '}
                          <button type="button" onClick={() => void eligibleKiosksQuery.refetch()}>
                            Thử lại
                          </button>
                        </p>
                      )}
                      {eligibleKiosksQuery.isPending && (
                        <small role="status">Đang tải tủ phù hợp…</small>
                      )}
                      {eligibleKiosksQuery.isSuccess &&
                        eligibleKiosks.length === 0 &&
                        !appDetail.assignedKioskId && (
                          <small className="kiosk-field-error">
                            Chưa có tủ kiosk nào khả dụng với {appDetail.walkInSlots} ô W và{' '}
                            {appDetail.preorderSlots} ô P. Nhấn Thêm tủ mới để đăng ký thiết bị.
                          </small>
                        )}
                    </div>
                  </div>

                  <div className="form-fields-grid-2">
                    <div className="kiosk-form-field">
                      <label htmlFor={scheduleDateId}>Ngày dự kiến lắp đặt:</label>
                      <input
                        id={scheduleDateId}
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                      />
                    </div>
                    <div className="kiosk-form-field">
                      <label htmlFor={timeWindowId}>Khung giờ:</label>
                      <input
                        id={timeWindowId}
                        type="text"
                        value={timeWindow}
                        onChange={(e) => setTimeWindow(e.target.value)}
                        placeholder="09:00 - 12:00"
                      />
                    </div>
                  </div>

                  <div className="action-buttons-row">
                    <Button
                      onClick={() => {
                        if (!selectedTechId) {
                          setActionError('Vui lòng chọn Kỹ thuật viên.');
                          return;
                        }
                        if (!selectedKioskId) {
                          setActionError('Vui lòng chọn Tủ Kiosk cấp phát.');
                          return;
                        }
                        if (!scheduledDate) {
                          setActionError('Vui lòng chọn ngày lắp đặt.');
                          return;
                        }
                        if (
                          !/^([01]\d|2[0-3]):[0-5]\d - ([01]\d|2[0-3]):[0-5]\d$/.test(
                            timeWindow.trim(),
                          ) ||
                          timeWindow.trim().slice(0, 5) >= timeWindow.trim().slice(8, 13)
                        ) {
                          setActionError(
                            'Nhập khung giờ HH:mm - HH:mm, giờ kết thúc phải sau giờ bắt đầu.',
                          );
                          return;
                        }
                        scheduleMutation.mutate({
                          id: appDetail.id,
                          technicianId: selectedTechId,
                          kioskId: selectedKioskId,
                          scheduledDate,
                          timeWindow: timeWindow.trim(),
                        });
                      }}
                      disabled={
                        scheduleMutation.isPending ||
                        techniciansQuery.isPending ||
                        techniciansQuery.isError ||
                        eligibleKiosksQuery.isPending ||
                        eligibleKiosksQuery.isError
                      }
                    >
                      <ClipboardList size={18} aria-hidden="true" />
                      {scheduleMutation.isPending ? 'Đang lưu...' : 'Lưu lịch & Phân công'}
                    </Button>
                  </div>
                </div>
              )}

            {/* ACTION: AWAITING_HANDOVER -> REVIEW EVIDENCE & HANDOVER */}
            {appDetail.status === 'AWAITING_HANDOVER' && (
              <div className="operations-action-card">
                <h3>Bước 3: Nghiệm thu kết quả lắp đặt & Bàn giao</h3>
                <div className="report-display-box">
                  <strong>Báo cáo từ Kỹ thuật viên ({appDetail.assignedTechnicianName}):</strong>
                  <p>{appDetail.technicianReport || 'Chưa ghi nhận nội dung báo cáo chi tiết.'}</p>
                </div>

                {/* Real Evidence Photos display using authenticated endpoint */}
                <div className="evidence-review-section">
                  <h4>Ảnh minh chứng hiện trường thực tế:</h4>
                  {evidencePhotos.length > 0 ? (
                    <div className="evidence-thumbnails-grid">
                      {evidencePhotos.map((ev, idx) => (
                        <OperationsEvidenceImage
                          key={ev.id}
                          appId={appDetail.id}
                          evidenceId={ev.id}
                          label={`Minh chứng #${idx + 1}`}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="kiosk-help-text">
                      Đang lấy ảnh minh chứng từ phiếu lắp đặt. Cần có ít nhất 1 ảnh để tiến hành
                      bàn giao.
                    </p>
                  )}
                </div>

                {isManager && (
                  <>
                    <div className="action-buttons-row">
                      <Button
                        onClick={() => handoverMutation.mutate(appDetail.id)}
                        disabled={
                          handoverMutation.isPending ||
                          evidencePhotos.length === 0 ||
                          !appDetail.technicianReport?.trim()
                        }
                      >
                        <Check size={18} aria-hidden="true" />
                        {handoverMutation.isPending
                          ? 'Đang kích hoạt...'
                          : 'Nghiệm thu Đạt & Bàn giao Kiosk'}
                      </Button>
                    </div>

                    {/* Rework option */}
                    <div className="rework-sub-section">
                      <h4>Yêu cầu kỹ thuật viên kiểm tra / sửa lại:</h4>
                      <div className="kiosk-form-field">
                        <label htmlFor={reworkReasonId}>Lý do yêu cầu làm lại:</label>
                        <input
                          id={reworkReasonId}
                          type="text"
                          value={reworkReason}
                          onChange={(e) => setReworkReason(e.target.value)}
                          placeholder="Ví dụ: Ảnh chụp chưa rõ mã QR, yêu cầu chụp lại góc chính diện..."
                        />
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (reworkReason.trim().length < 5) {
                            setActionError('Lý do yêu cầu sửa lại cần ít nhất 5 ký tự.');
                            return;
                          }
                          reworkMutation.mutate({ id: appDetail.id, reason: reworkReason.trim() });
                        }}
                        disabled={reworkMutation.isPending}
                      >
                        Gửi yêu cầu làm lại (Chuyển về INSTALLING)
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Exceptional platform failure remediation */}
            {['CONFIRMED', 'SCHEDULED', 'INSTALLING', 'AWAITING_HANDOVER'].includes(
              appDetail.status,
            ) &&
              isManager && (
                <details className="kiosk-platform-failure-details">
                  <summary>Không thể tiếp tục lắp đặt?</summary>
                  <p className="kiosk-help-text">
                    Nếu mặt bằng từ chối cấp phép hoặc không thể lắp đặt vì lý do an toàn kỹ thuật,
                    quản lý có thể kích hoạt hủy ngoại lệ để hoàn tiền cho khách.
                  </p>
                  <div className="kiosk-form-field">
                    <label htmlFor={failureReasonId}>Lý do hủy do sự cố bất khả kháng:</label>
                    <input
                      id={failureReasonId}
                      type="text"
                      value={platformFailureReason}
                      onChange={(e) => setPlatformFailureReason(e.target.value)}
                      placeholder="Ví dụ: Ban quản lý tòa nhà từ chối cấp phép đặt kiosk ngoài trời..."
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (platformFailureReason.trim().length < 5) {
                        setActionError('Lý do sự cố bất khả kháng cần ít nhất 5 ký tự.');
                        return;
                      }
                      platformFailureMutation.mutate({
                        id: appDetail.id,
                        reason: platformFailureReason.trim(),
                      });
                    }}
                    disabled={platformFailureMutation.isPending}
                  >
                    Ghi nhận sự cố & Chuyển sang hoàn tiền
                  </Button>
                </details>
              )}
          </fieldset>
        </div>
      )}
    </section>
  );
}

export default function OperationsInstallations({ session }: OperationsInstallationsProps) {
  const searchParams = useSearchParams();
  const isManager = session.role === 'OPERATIONS_MANAGER';
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const lastDetailTrigger = useRef<HTMLButtonElement | null>(null);
  const [selectedAppDraft, setSelectedAppId] = useState<string | null>();
  const selectedAppId =
    selectedAppDraft === undefined ? searchParams.get('application') : selectedAppDraft;

  // Enroll modal state
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [newKioskCode, setNewKioskCode] = useState('');
  const [newKioskName, setNewKioskName] = useState('');
  const [newHardwareId, setNewHardwareId] = useState('');
  const [newMqttClientId, setNewMqttClientId] = useState('');
  const [newRegion, setNewRegion] = useState('HCM');
  const [newWalkInSlots, setNewWalkInSlots] = useState(1);
  const [newPreorderSlots, setNewPreorderSlots] = useState(1);
  const [enrollError, setEnrollError] = useState('');
  const [enrollSuccess, setEnrollSuccess] = useState<string | null>(null);

  // Once-only Provisioned Key Modal State (Memory only, never persisted)
  const [provisionedKeyInfo, setProvisionedKeyInfo] = useState<{
    kioskId: string;
    code: string;
    apiKey: string;
  } | null>(null);
  const [copySuccess, setCopySuccess] = useState('');
  const closeEnroll = useCallback(() => setEnrollModalOpen(false), []);
  const closeKey = useCallback(() => setProvisionedKeyInfo(null), []);

  // Query 1: Applications Queue scoped by identity
  const queryPath = `/operations/kiosk-applications?page=${page}&limit=10${
    statusFilter !== 'ALL' ? `&status=${encodeURIComponent(statusFilter)}` : ''
  }`;

  const applicationsQuery = useQuery({
    queryKey: ['operations-kiosk-applications', session.id, statusFilter, page],
    queryFn: () => request<KioskApplicationPage>(queryPath),
  });

  const invalidateQueue = () => {
    void queryClient.invalidateQueries({
      queryKey: ['operations-kiosk-applications', session.id],
    });
  };

  const enrollKioskMutation = useMutation({
    mutationFn: (data: EnrollKioskRequest) =>
      request<EnrollKioskResponse>('/operations/kiosks/enroll', data),
    onSuccess: (created) => {
      setEnrollModalOpen(false);
      setNewKioskCode('');
      setNewKioskName('');
      setNewHardwareId('');
      setNewMqttClientId('');
      setEnrollError('');
      setEnrollSuccess(
        `Đã ghi nhận thiết bị Kiosk mới: ${created.code} (${created.name}) - Ban đầu: OFFLINE.`,
      );
      void queryClient.invalidateQueries({ queryKey: ['eligible-kiosks', session.id] });

      // Deliver once-only API key to memory state
      if (created.apiKey) {
        setProvisionedKeyInfo({
          kioskId: created.id,
          code: created.code,
          apiKey: created.apiKey,
        });
        setCopySuccess('');
      }
    },
    onError: (err) => {
      setEnrollError(err instanceof ApiError ? err.message : 'Chưa thêm được thiết bị kiosk.');
    },
  });

  const handleEnrollSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKioskCode.trim() || !newKioskName.trim() || !newHardwareId.trim()) {
      setEnrollError('Vui lòng điền đầy đủ mã tủ, tên tủ và Hardware ID.');
      return;
    }
    if (
      newKioskCode.trim().length < 2 ||
      newKioskName.trim().length < 2 ||
      newKioskName.trim().length > 120 ||
      newHardwareId.trim().length < 2
    ) {
      setEnrollError('Mã tủ và Hardware ID cần ít nhất 2 ký tự; tên tủ từ 2 đến 120 ký tự.');
      return;
    }
    if (
      !Number.isInteger(newWalkInSlots) ||
      !Number.isInteger(newPreorderSlots) ||
      newWalkInSlots < 1 ||
      newPreorderSlots < 1 ||
      newWalkInSlots + newPreorderSlots > 50
    ) {
      setEnrollError('Mỗi loại ô cần ít nhất 1 ô; tổng số ô không vượt quá 50.');
      return;
    }
    enrollKioskMutation.mutate({
      code: newKioskCode.trim(),
      name: newKioskName.trim(),
      hardwareId: newHardwareId.trim(),
      mqttClientId: newMqttClientId.trim() || `kiosk-${newKioskCode.trim().toLowerCase()}`,
      region: newRegion,
      walkInSlots: newWalkInSlots,
      preorderSlots: newPreorderSlots,
    });
  };

  const handleOpenEnroll = (walkIn: number, preorder: number) => {
    setNewWalkInSlots(walkIn);
    setNewPreorderSlots(preorder);
    setEnrollError('');
    setEnrollSuccess(null);
    setEnrollModalOpen(true);
  };

  return (
    <div className="operations-installations-view">
      {!isManager && (
        <div role="status" className="status-notice notice-info">
          <CircleAlert size={18} aria-hidden="true" />
          <p>
            <strong>Chế độ giám sát (Admin):</strong> Bạn có thể theo dõi hàng đợi và xem chi tiết
            hồ sơ. Theo phân quyền hệ thống, các thao tác nghiệp vụ (xác nhận, xếp lịch, nghiệm thu)
            chỉ dành cho Quản lý vận hành.
          </p>
        </div>
      )}

      {enrollSuccess && (
        <div role="status" className="status-notice notice-success">
          <Check size={18} aria-hidden="true" />
          <span>{enrollSuccess}</span>
        </div>
      )}

      {/* Filter and Queue Section */}
      <section className="operations-queue-section" aria-labelledby="queue-heading">
        <div className="operations-section-heading">
          <div>
            <h2 id="queue-heading">Hàng đợi hồ sơ</h2>
            <p>Chọn một hồ sơ để kiểm tra thông tin và thực hiện bước tiếp theo.</p>
          </div>
          {isManager && (
            <Button
              variant="outline"
              onClick={() => handleOpenEnroll(1, 1)}
              disabled={enrollKioskMutation.isPending}
            >
              + Thêm tủ mới
            </Button>
          )}
        </div>
        <div className="operations-stage-tabs" role="group" aria-label="Lọc nhanh hồ sơ">
          {(
            [
              ['ALL', 'Tất cả'],
              ['PAID_REVIEW', 'Chờ xác nhận'],
              ['CONFIRMED', 'Chờ xếp lịch'],
              ['AWAITING_HANDOVER', 'Chờ nghiệm thu'],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              key={value}
              aria-pressed={statusFilter === value}
              onClick={() => {
                setStatusFilter(value);
                setPage(1);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="queue-filter-bar">
          <div className="filter-group">
            <label htmlFor="status-filter-select">Lọc theo trạng thái:</label>
            <select
              id="status-filter-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="AWAITING_PAYMENT">Chờ thanh toán</option>
              <option value="PAID_REVIEW">Đã thanh toán - Chờ duyệt</option>
              <option value="UNDER_REVIEW">Đang xem xét</option>
              <option value="CONFIRMED">Đã xác nhận - Chờ xếp lịch</option>
              <option value="SCHEDULED">Đã xếp lịch</option>
              <option value="INSTALLING">Đang lắp đặt</option>
              <option value="AWAITING_HANDOVER">Chờ nghiệm thu</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="REFUND_PENDING">Đang hoàn tiền</option>
              <option value="CANCELLED">Đã hủy</option>
              <option value="REJECTED">Đã từ chối</option>
              <option value="REFUNDED">Đã hoàn tiền</option>
            </select>
          </div>

          <Button
            variant="outline"
            className="refresh-btn"
            onClick={() => {
              void applicationsQuery.refetch();
              if (selectedAppId) {
                void queryClient.invalidateQueries({
                  queryKey: ['operations-kiosk-application-detail', session.id, selectedAppId],
                });
              }
            }}
            disabled={applicationsQuery.isFetching}
          >
            <RefreshCw
              className={applicationsQuery.isFetching ? 'spin' : ''}
              size={16}
              aria-hidden="true"
            />
            Làm mới
          </Button>
        </div>

        {applicationsQuery.isLoading && (
          <p role="status" className="kiosk-status-loading">
            <RefreshCw className="spin" size={16} aria-hidden="true" />
            Đang tải danh sách hồ sơ kiosk...
          </p>
        )}

        {applicationsQuery.isError && (
          <div role="alert" className="kiosk-field-error-banner">
            <CircleAlert size={18} aria-hidden="true" />
            <span>Không thể tải danh sách hồ sơ. Vui lòng thử lại.</span>
          </div>
        )}

        {applicationsQuery.data && !applicationsQuery.isError && (
          <div className="table-responsive">
            <table className="kiosk-data-table" aria-label="Danh sách hồ sơ thuê kiosk">
              <thead>
                <tr>
                  <th scope="col">Shop & Liên hệ</th>
                  <th scope="col">Gói thuê</th>
                  <th scope="col">Địa chỉ lắp đặt</th>
                  <th scope="col">Ngày tạo</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {applicationsQuery.data.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="table-empty-cell">
                      <div className="operations-empty">
                        <ClipboardList size={32} aria-hidden="true" />
                        <h3>Chưa có hồ sơ phù hợp</h3>
                        <p>
                          Thử chọn trạng thái khác hoặc làm mới để kiểm tra hồ sơ vừa tiếp nhận.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  applicationsQuery.data.items.map((item) => (
                    <tr
                      key={item.id}
                      className={selectedAppId === item.id ? 'is-selected-row' : ''}
                    >
                      <td data-label="Shop & liên hệ">
                        <strong>{item.shopName}</strong>
                        <div className="table-sub-text">{item.phone}</div>
                      </td>
                      <td data-label="Gói thuê">
                        <strong>{item.packageName}</strong>
                        <div className="table-sub-text">
                          {item.walkInSlots}W + {item.preorderSlots}P ({item.totalSlots} ô)
                        </div>
                      </td>
                      <td data-label="Địa chỉ lắp đặt">
                        <span className="address-truncate" title={item.installationAddress}>
                          {item.installationAddress}
                        </span>
                      </td>
                      <td data-label="Ngày tiếp nhận">
                        {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                      </td>
                      <td data-label="Trạng thái">
                        <span className="kiosk-status-pill" data-status={item.status}>
                          {KIOSK_STATUS_LABELS[item.status] || item.status}
                        </span>
                      </td>
                      <td data-label="">
                        <Button
                          variant={selectedAppId === item.id ? 'default' : 'outline'}
                          onClick={(event) => {
                            lastDetailTrigger.current = event.currentTarget;
                            setSelectedAppId(selectedAppId === item.id ? null : item.id);
                          }}
                        >
                          <Eye size={16} aria-hidden="true" />
                          {selectedAppId === item.id ? 'Đang xem' : 'Chi tiết'}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="table-pagination-row">
              <Button
                variant="outline"
                disabled={page <= 1 || applicationsQuery.isFetching}
                onClick={() => setPage((p) => p - 1)}
              >
                Trang trước
              </Button>
              <span>Trang {page}</span>
              <Button
                variant="outline"
                disabled={!applicationsQuery.data.hasMore || applicationsQuery.isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                Trang sau
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Selected Application Detail Panel with stable key */}
      {selectedAppId && (
        <OperationsDetailCard
          key={`${session.id}-${selectedAppId}`}
          appId={selectedAppId}
          session={session}
          isManager={isManager}
          onClose={() => {
            setSelectedAppId(null);
            lastDetailTrigger.current?.focus();
          }}
          onOpenEnroll={handleOpenEnroll}
          onShowProvisionedKey={(info) => {
            setProvisionedKeyInfo(info);
            setCopySuccess('');
          }}
          onInvalidateQueue={invalidateQueue}
        />
      )}

      {/* Enroll Kiosk Asset Modal */}
      <Modal
        open={enrollModalOpen}
        title="Đăng ký thiết bị kiosk mới"
        onClose={closeEnroll}
        closeDisabled={enrollKioskMutation.isPending}
      >
        <form onSubmit={handleEnrollSubmit}>
          <div className="status-notice notice-info">
            <CircleAlert size={16} aria-hidden="true" />
            <p>
              Thiết bị được tạo với trạng thái ban đầu là <strong>OFFLINE</strong>. Hệ thống không
              tạo cảm biến hay nhịp tim giả lập. Khóa API thiết bị sẽ được cấp một lần duy nhất sau
              khi lưu.
            </p>
          </div>

          {enrollError && (
            <p role="alert" className="kiosk-field-error">
              {enrollError}
            </p>
          )}

          <div className="form-fields-grid-2">
            <div className="kiosk-form-field">
              <label htmlFor="new-kiosk-code">Mã tủ (Code) *</label>
              <input
                id="new-kiosk-code"
                type="text"
                value={newKioskCode}
                onChange={(e) => setNewKioskCode(e.target.value)}
                placeholder="K-HCM-03"
                required
              />
            </div>
            <div className="kiosk-form-field">
              <label htmlFor="new-kiosk-name">Tên tủ *</label>
              <input
                id="new-kiosk-name"
                type="text"
                value={newKioskName}
                onChange={(e) => setNewKioskName(e.target.value)}
                placeholder="Kiosk Bình Thạnh"
                required
              />
            </div>
          </div>

          <div className="form-fields-grid-2">
            <div className="kiosk-form-field">
              <label htmlFor="new-hardware-id">Hardware ID (Serial) *</label>
              <input
                id="new-hardware-id"
                type="text"
                value={newHardwareId}
                onChange={(e) => setNewHardwareId(e.target.value)}
                placeholder="ESP32-SN-998811"
                required
              />
            </div>
            <div className="kiosk-form-field">
              <label htmlFor="new-region-select">Khu vực (Region)</label>
              <select
                id="new-region-select"
                value={newRegion}
                onChange={(e) => setNewRegion(e.target.value)}
              >
                <option value="HCM">TP. Hồ Chí Minh (HCM)</option>
                <option value="HN">Hà Nội (HN)</option>
                <option value="DN">Đà Nẵng (DN)</option>
              </select>
            </div>
          </div>

          <div className="form-fields-grid-2">
            <div className="kiosk-form-field">
              <label htmlFor="new-walkin-slots">Số ô vãng lai (Walk-in)</label>
              <input
                id="new-walkin-slots"
                type="number"
                min={1}
                max={49}
                value={newWalkInSlots}
                onChange={(e) => setNewWalkInSlots(Number(e.target.value))}
                required
              />
            </div>
            <div className="kiosk-form-field">
              <label htmlFor="new-preorder-slots">Số ô đặt trước (Pre-order)</label>
              <input
                id="new-preorder-slots"
                type="number"
                min={1}
                max={49}
                value={newPreorderSlots}
                onChange={(e) => setNewPreorderSlots(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div className="kiosk-modal-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEnrollModalOpen(false)}
              disabled={enrollKioskMutation.isPending}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={enrollKioskMutation.isPending}>
              {enrollKioskMutation.isPending ? 'Đang thêm...' : 'Đăng ký thiết bị (OFFLINE)'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Once-Only Provisioned Key Delivery Panel */}
      <Modal
        open={!!provisionedKeyInfo}
        title="Cấu hình khóa thiết bị Kiosk (API Key)"
        onClose={closeKey}
      >
        {provisionedKeyInfo && (
          <>
            <div className="status-notice notice-info">
              <CircleAlert size={18} aria-hidden="true" />
              <div>
                <p>
                  <strong>Lưu ý bảo mật quan trọng:</strong> Khóa API này chỉ hiển thị{' '}
                  <strong>duy nhất một lần</strong>. Máy chủ chỉ lưu bản băm SHA-256 để xác thực.
                  Hãy sao chép và cấu hình vào firmware thiết bị ngay. Sau khi đóng bảng này, khóa
                  sẽ không thể xem lại.
                </p>
              </div>
            </div>

            <div className="kiosk-provision-panel">
              <div className="provision-field-row">
                <span>Mã tủ:</span>
                <strong>{provisionedKeyInfo.code}</strong>
              </div>
              <div className="provision-field-row">
                <span>Kiosk ID:</span>
                <code>{provisionedKeyInfo.kioskId}</code>
              </div>
              <div className="kiosk-form-field">
                <label htmlFor="device-api-key-input">Khóa bí mật thiết bị (Device API Key):</label>
                <input
                  id="device-api-key-input"
                  type="text"
                  readOnly
                  value={provisionedKeyInfo.apiKey}
                  style={{ fontFamily: 'monospace', fontWeight: 600, background: '#f8faf6' }}
                />
              </div>

              <div className="action-buttons-row">
                <Button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        JSON.stringify(
                          {
                            kioskId: provisionedKeyInfo.kioskId,
                            kioskCode: provisionedKeyInfo.code,
                            apiKey: provisionedKeyInfo.apiKey,
                          },
                          null,
                          2,
                        ),
                      );
                      setCopySuccess('Đã sao chép cấu hình JSON vào bộ nhớ tạm!');
                    } catch {
                      setCopySuccess(
                        'Không sao chép được. Hãy chọn và sao chép khóa trong ô phía trên.',
                      );
                    }
                  }}
                >
                  <Check size={18} aria-hidden="true" />
                  Sao chép cấu hình JSON
                </Button>
              </div>
              {copySuccess && (
                <p
                  role="status"
                  className="kiosk-field-hint"
                  style={{ color: '#237804', marginTop: '0.5rem' }}
                >
                  {copySuccess}
                </p>
              )}
            </div>

            <div className="kiosk-modal-actions">
              <Button onClick={() => setProvisionedKeyInfo(null)}>
                Tôi đã sao chép khóa - Đóng bảng này
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
