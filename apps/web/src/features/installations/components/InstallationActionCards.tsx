import { useId, useState } from 'react';
import { Button, Check, Lock } from '@florabot/ui';
import type { UseQueryResult } from '@tanstack/react-query';
import type { AccountDirectoryItem } from '../../account-management/account-management.types';
import { DEFAULT_TIME_WINDOW } from '../installations.constants';
import type {
  EligibleKioskResponse,
  IncidentPhoto,
  KioskApplicationResponse,
} from '../installations.types';
import { InstallationHandoverPanel } from './InstallationHandoverPanel';
import { InstallationScheduleForm } from './InstallationScheduleForm';

interface InstallationActionCardsProps {
  appDetail: KioskApplicationResponse;
  isManager: boolean;
  actionPending: boolean;
  activeTechnicians: AccountDirectoryItem[];
  techniciansQuery: UseQueryResult<AccountDirectoryItem[], Error>;
  eligibleKiosks: EligibleKioskResponse[];
  eligibleKiosksQuery: UseQueryResult<EligibleKioskResponse[], Error>;
  evidencePhotos: IncidentPhoto[];
  onOpenEnroll: (slotCount: number) => void;
  onSubmitConfirm: (note: string, onSuccess: () => void) => void;
  onSubmitReject: (reason: string, onSuccess: () => void) => void;
  onSubmitSchedule: (payload: {
    techId: string;
    kioskId: string;
    date: string;
    window: string;
  }) => void;
  onSubmitRework: (reason: string, onSuccess: () => void) => void;
  onHandover: () => void;
  onProvisionKey: (kioskId: string) => void;
  onSubmitPlatformFailure: (reason: string, onSuccess: () => void) => void;
  confirmPending: boolean;
  rejectPending: boolean;
  schedulePending: boolean;
  handoverPending: boolean;
  reworkPending: boolean;
  provisionKeyPending: boolean;
  platformFailurePending: boolean;
}

export function InstallationActionCards({
  appDetail,
  isManager,
  actionPending,
  activeTechnicians,
  techniciansQuery,
  eligibleKiosks,
  eligibleKiosksQuery,
  evidencePhotos,
  onOpenEnroll,
  onSubmitConfirm,
  onSubmitReject,
  onSubmitSchedule,
  onSubmitRework,
  onHandover,
  onProvisionKey,
  onSubmitPlatformFailure,
  confirmPending,
  rejectPending,
  schedulePending,
  handoverPending,
  reworkPending,
  provisionKeyPending,
  platformFailurePending,
}: InstallationActionCardsProps) {
  const [confirmNote, setConfirmNote] = useState('');
  const [reworkReason, setReworkReason] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [platformFailureReason, setPlatformFailureReason] = useState('');
  const [techDraft, setSelectedTechId] = useState<string>();
  const [kioskDraft, setSelectedKioskId] = useState<string>();
  const [dateDraft, setScheduledDate] = useState<string>();
  const [windowDraft, setTimeWindow] = useState<string>();

  const confirmNoteId = useId();
  const rejectReasonId = useId();
  const failureReasonId = useId();

  const selectedTechId = techDraft ?? (appDetail.assignedTechnicianId || '');
  const selectedKioskId = kioskDraft ?? (appDetail.assignedKioskId || '');
  const scheduledDate = dateDraft ?? appDetail.scheduledDate?.slice(0, 10) ?? '';
  const timeWindow = windowDraft ?? appDetail.timeWindow ?? DEFAULT_TIME_WINDOW;

  return (
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
                onProvisionKey(appDetail.assignedKioskId!);
              }
            }}
            disabled={provisionKeyPending}
          >
            <Lock size={16} aria-hidden="true" />
            {provisionKeyPending ? 'Đang cấp...' : 'Cấp lại khóa API'}
          </Button>
        </div>
      )}

      {/* ACTION: PAID_REVIEW -> CONFIRM CONTACT */}
      {appDetail.status === 'AWAITING_PAYMENT' && isManager && (
        <div className="operations-action-card">
          <h3>Hồ sơ đang chờ khách thanh toán</h3>
          <p>Chỉ xác nhận liên hệ và xếp lịch sau khi hệ thống xác minh thanh toán thành công.</p>
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
              onClick={() => onSubmitReject(rejectReason, () => setRejectReason(''))}
              disabled={rejectPending}
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
            Quản lý vận hành gọi điện xác nhận địa chỉ lắp đặt và vị trí nguồn điện. Sau bước này,
            khách không thể tự ý hủy hồ sơ.
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
              onClick={() => onSubmitConfirm(confirmNote, () => setConfirmNote(''))}
              disabled={confirmPending}
            >
              <Check size={18} aria-hidden="true" />
              {confirmPending ? 'Đang xác nhận...' : 'Xác nhận liên hệ'}
            </Button>
            <Button
              variant="outline"
              onClick={() => onSubmitReject(rejectReason, () => setRejectReason(''))}
              disabled={rejectPending}
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
      {(appDetail.status === 'CONFIRMED' || appDetail.status === 'SCHEDULED') && isManager && (
        <InstallationScheduleForm
          appDetail={appDetail}
          selectedTechId={selectedTechId}
          onSelectTechId={setSelectedTechId}
          selectedKioskId={selectedKioskId}
          onSelectKioskId={setSelectedKioskId}
          scheduledDate={scheduledDate}
          onScheduledDateChange={setScheduledDate}
          timeWindow={timeWindow}
          onTimeWindowChange={setTimeWindow}
          activeTechnicians={activeTechnicians}
          techniciansQuery={techniciansQuery}
          eligibleKiosks={eligibleKiosks}
          eligibleKiosksQuery={eligibleKiosksQuery}
          onOpenEnroll={onOpenEnroll}
          onSubmit={() =>
            onSubmitSchedule({
              techId: selectedTechId,
              kioskId: selectedKioskId,
              date: scheduledDate,
              window: timeWindow,
            })
          }
          isPending={schedulePending}
        />
      )}

      {/* ACTION: AWAITING_HANDOVER -> REVIEW EVIDENCE & HANDOVER */}
      {appDetail.status === 'AWAITING_HANDOVER' && (
        <InstallationHandoverPanel
          appDetail={appDetail}
          evidencePhotos={evidencePhotos}
          isManager={isManager}
          reworkReason={reworkReason}
          onReworkReasonChange={setReworkReason}
          onHandover={onHandover}
          onRework={() => onSubmitRework(reworkReason, () => setReworkReason(''))}
          handoverPending={handoverPending}
          reworkPending={reworkPending}
        />
      )}

      {/* Exceptional platform failure remediation */}
      {['CONFIRMED', 'SCHEDULED', 'INSTALLING', 'AWAITING_HANDOVER'].includes(appDetail.status) &&
        isManager && (
          <details className="kiosk-platform-failure-details">
            <summary>Không thể tiếp tục lắp đặt?</summary>
            <p className="kiosk-help-text">
              Nếu mặt bằng từ chối cấp phép hoặc không thể lắp đặt vì lý do an toàn kỹ thuật, quản
              lý có thể kích hoạt hủy ngoại lệ để hoàn tiền cho khách.
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
              onClick={() =>
                onSubmitPlatformFailure(platformFailureReason, () => setPlatformFailureReason(''))
              }
              disabled={platformFailurePending}
            >
              Ghi nhận sự cố & Chuyển sang hoàn tiền
            </Button>
          </details>
        )}
    </fieldset>
  );
}
