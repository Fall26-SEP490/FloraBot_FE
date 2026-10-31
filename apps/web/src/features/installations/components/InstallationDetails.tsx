import { useEffect, useRef } from 'react';
import { Button, Check, CircleAlert, RefreshCw, X } from '@florabot/ui';
import { ApiError, type Session } from '@/shared/lib/api';
import { KIOSK_STATUS_LABELS } from '../installations.constants';
import type { ProvisionedKeyInfo } from '../installations.types';
import { formatDateVN, getOperationsActiveStep } from '../installations.utils';
import { useInstallationActions } from '../hooks/useInstallationActions';
import { useInstallationDetails } from '../hooks/useInstallationDetails';
import { InstallationActionCards } from './InstallationActionCards';

interface InstallationDetailsProps {
  appId: string;
  session: Session;
  isManager: boolean;
  onClose: () => void;
  onOpenEnroll: (slotCount: number) => void;
  onShowProvisionedKey: (info: ProvisionedKeyInfo) => void;
  onInvalidateQueue: () => void;
}

export function InstallationDetails({
  appId,
  session,
  isManager,
  onClose,
  onOpenEnroll,
  onShowProvisionedKey,
  onInvalidateQueue,
}: InstallationDetailsProps) {
  const panelRef = useRef<HTMLElement>(null);

  const {
    selectedAppQuery,
    appDetail,
    evidencePhotos,
    needsSchedule,
    techniciansQuery,
    activeTechnicians,
    eligibleKiosksQuery,
    eligibleKiosks,
    invalidateSelf,
  } = useInstallationDetails({
    appId,
    session,
    isManager,
    onInvalidateQueue,
  });

  const {
    actionError,
    actionSuccess,
    actionPending,
    confirmMutation,
    scheduleMutation,
    handoverMutation,
    reworkMutation,
    rejectMutation,
    platformFailureMutation,
    provisionKeyMutation,
    submitConfirm,
    submitReject,
    submitSchedule,
    submitRework,
    submitPlatformFailure,
  } = useInstallationActions({
    invalidateSelf,
    onShowProvisionedKey,
    assignedKioskCode: appDetail?.assignedKioskCode,
  });

  const activeStep = appDetail ? getOperationsActiveStep(appDetail.status, needsSchedule) : -1;

  useEffect(() => {
    if (!appDetail?.id) return;
    panelRef.current?.focus({ preventScroll: true });
    panelRef.current?.scrollIntoView({ block: 'start' });
  }, [appDetail?.id]);

  return (
    <section
      id="installation-detail"
      ref={panelRef}
      tabIndex={-1}
      className="operations-detail-panel"
      aria-labelledby="detail-panel-title"
    >
      <div className="detail-panel-header">
        <div>
          <span className="installation-eyebrow">Hồ sơ triển khai kiosk</span>
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

      {selectedAppQuery.isPending && (
        <div role="status" aria-live="polite">
          <p>Đang tải thông tin chi tiết hồ sơ…</p>
        </div>
      )}

      {selectedAppQuery.isError && (
        <div role="alert" className="detail-error-box">
          <CircleAlert size={20} aria-hidden="true" />
          <p>
            {selectedAppQuery.error instanceof ApiError
              ? selectedAppQuery.error.message
              : 'Không thể tải chi tiết hồ sơ. Vui lòng thử lại.'}
          </p>
          <Button variant="outline" onClick={() => void selectedAppQuery.refetch()}>
            <RefreshCw size={16} aria-hidden="true" />
            Thử lại chi tiết
          </Button>
        </div>
      )}

      {appDetail && (
        <div className="detail-panel-content">
          <ol
            className="installation-progress operations-detail-progress"
            aria-label="Tiến độ hồ sơ"
          >
            {['Xác nhận liên hệ', 'Xếp lịch lắp đặt', 'Nghiệm thu', 'Bàn giao'].map(
              (label, index) => (
                <li
                  key={label}
                  data-complete={index < activeStep || appDetail.status === 'ACTIVE' || undefined}
                  aria-current={activeStep === index ? 'step' : undefined}
                >
                  <span aria-hidden="true">
                    {index < activeStep || appDetail.status === 'ACTIVE' ? (
                      <Check size={15} />
                    ) : (
                      String(index + 1).padStart(2, '0')
                    )}
                  </span>
                  <strong>{label}</strong>
                </li>
              ),
            )}
          </ol>

          <h3 className="installation-section-title">Thông tin đăng ký</h3>
          <dl className="detail-info-grid">
            <div>
              <dt>Gói đăng ký</dt>
              <dd>
                <strong>{appDetail.packageName}</strong> (
                {Number(appDetail.annualFee).toLocaleString('vi-VN')} đ/năm)
                <br />
                Tổng số ô: {appDetail.totalSlots}
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
            <div className="installation-appointment" aria-label="Lịch lắp đặt đã phân công">
              <div>
                <span>Kỹ thuật viên</span>
                <strong>{appDetail.assignedTechnicianName || 'Đã phân công'}</strong>
              </div>
              <div>
                <span>Thời gian lắp đặt</span>
                <strong>{formatDateVN(appDetail.scheduledDate)}</strong>
                <small>{appDetail.timeWindow || 'Chưa có khung giờ'}</small>
              </div>
              <div>
                <span>Kiosk được phân công</span>
                <strong>{appDetail.assignedKioskCode || 'Chưa có mã tủ'}</strong>
              </div>
            </div>
          )}

          <InstallationActionCards
            appDetail={appDetail}
            isManager={isManager}
            actionPending={actionPending}
            activeTechnicians={activeTechnicians}
            techniciansQuery={techniciansQuery}
            eligibleKiosks={eligibleKiosks}
            eligibleKiosksQuery={eligibleKiosksQuery}
            evidencePhotos={evidencePhotos}
            onOpenEnroll={onOpenEnroll}
            onSubmitConfirm={(note, onDone) => submitConfirm(appDetail.id, note, onDone)}
            onSubmitReject={(reason, onDone) => submitReject(appDetail.id, reason, onDone)}
            onSubmitSchedule={(params) => submitSchedule(appDetail.id, params)}
            onSubmitRework={(reason, onDone) => submitRework(appDetail.id, reason, onDone)}
            onHandover={() => handoverMutation.mutate(appDetail.id)}
            onProvisionKey={(kioskId) => provisionKeyMutation.mutate(kioskId)}
            onSubmitPlatformFailure={(reason, onDone) =>
              submitPlatformFailure(appDetail.id, reason, onDone)
            }
            confirmPending={confirmMutation.isPending}
            rejectPending={rejectMutation.isPending}
            schedulePending={scheduleMutation.isPending}
            handoverPending={handoverMutation.isPending}
            reworkPending={reworkMutation.isPending}
            provisionKeyPending={provisionKeyMutation.isPending}
            platformFailurePending={platformFailureMutation.isPending}
          />
        </div>
      )}
    </section>
  );
}
