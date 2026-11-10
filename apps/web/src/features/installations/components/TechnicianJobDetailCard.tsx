import { useId, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Check, CircleAlert, ListChecks, MapPin } from '@florabot/ui';
import { request, type Session } from '@/shared/lib/api';
import { buildGoogleMapsDirectionsUrl } from '../../kiosk-location/kiosk-location.utils';
import { KIOSK_STATUS_LABELS, TECHNICIAN_PROGRESS_STEPS } from '../installations.constants';
import type { StaffEvidenceItem, TechnicianInstallationDetail } from '../installations.types';
import { formatDateVN, getTechnicianStepIndex, validateReportText } from '../installations.utils';
import { useTechnicianActions } from '../hooks/useTechnicianActions';
import { Esp32ConfigurationPanel } from '../../kiosk-management/Esp32ConfigurationPanel';
import { TechnicianEvidenceGallery, TechnicianEvidenceSection } from './TechnicianEvidenceSection';

interface TechnicianJobDetailCardProps {
  job: TechnicianInstallationDetail;
  session: Session;
  onInvalidate: () => void;
}

export function TechnicianJobDetailCard({
  job: selectedJob,
  session,
  onInvalidate,
}: TechnicianJobDetailCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reportInputId = useId();
  const evidenceInputId = useId();

  // Query: Attached evidence for selected job
  const evidenceQuery = useQuery({
    queryKey: ['technician-installation-evidence', session.id, selectedJob.id],
    queryFn: () =>
      request<StaffEvidenceItem[]>(`/staff/kiosk-installations/${selectedJob.id}/evidence`),
  });

  const evidenceItems = evidenceQuery.data || [];

  const {
    reportText,
    setReportText,
    selectedFile,
    setSelectedFile,
    uploadStatus,
    actionError,
    setActionError,
    actionSuccess,
    uploading,
    startMutation,
    handleUploadPhoto,
    submitReportMutation,
  } = useTechnicianActions({
    session,
    jobId: selectedJob.id,
    onInvalidate,
    fileInputRef,
  });

  const hasCoordinates =
    selectedJob.latitude != null &&
    selectedJob.longitude != null &&
    String(selectedJob.latitude).trim() !== '' &&
    String(selectedJob.longitude).trim() !== '' &&
    Number.isFinite(Number(selectedJob.latitude)) &&
    Number.isFinite(Number(selectedJob.longitude)) &&
    Math.abs(Number(selectedJob.latitude)) <= 90 &&
    Math.abs(Number(selectedJob.longitude)) <= 180;
  const currentStep = getTechnicianStepIndex(selectedJob.status);

  const handleSubmitReport = () => {
    if (
      selectedJob.status !== 'INSTALLING' ||
      uploading ||
      submitReportMutation.isPending ||
      evidenceQuery.isError ||
      evidenceQuery.isPending
    )
      return;

    const validation = validateReportText(reportText);
    if (!validation.valid) {
      setActionError(validation.error || 'Báo cáo cần ít nhất 10 ký tự.');
      return;
    }
    if (evidenceItems.length === 0) {
      setActionError('Bạn cần tải lên ít nhất 1 ảnh minh chứng trước khi nộp báo cáo.');
      return;
    }

    submitReportMutation.mutate({
      jobId: selectedJob.id,
      report: reportText.trim(),
    });
  };

  return (
    <section className="tech-job-detail-card" aria-labelledby="job-detail-title">
      <div className="job-detail-top">
        <div>
          <span className="kiosk-status-pill" data-status={selectedJob.status}>
            {KIOSK_STATUS_LABELS[selectedJob.status] || selectedJob.status}
          </span>
          <h2 id="job-detail-title">{selectedJob.shopName}</h2>
          <p className="job-address-primary">{selectedJob.installationAddress}</p>
          <p className="job-code-subtitle">
            Mã tủ phân bổ: <strong>{selectedJob.kioskCode}</strong>
          </p>
        </div>

        {hasCoordinates && (
          <div className="job-directions-action">
            <a
              href={buildGoogleMapsDirectionsUrl(
                Number(selectedJob.latitude),
                Number(selectedJob.longitude),
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="button button-outline directions-btn"
            >
              <MapPin size={16} aria-hidden="true" />
              Chỉ đường Google Maps
            </a>
          </div>
        )}
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

      {/* Rework alert if manager requested rework */}
      {selectedJob.reworkReason && (
        <div role="alert" className="kiosk-field-error-banner">
          <CircleAlert size={20} aria-hidden="true" />
          <div>
            <strong>Yêu cầu chỉnh sửa / bổ sung từ Quản lý:</strong>
            <p>{selectedJob.reworkReason}</p>
          </div>
        </div>
      )}

      <p className="technician-next-step">
        {selectedJob.status === 'SCHEDULED'
          ? 'Đến đúng địa điểm và bắt đầu khi sẵn sàng lắp đặt.'
          : selectedJob.status === 'INSTALLING'
            ? 'Tải ít nhất một ảnh, sau đó ghi kết quả và gửi báo cáo.'
            : selectedJob.status === 'AWAITING_HANDOVER'
              ? 'Đã gửi báo cáo. Chờ Quản lý vận hành kiểm tra và bàn giao.'
              : 'Quản lý vận hành đã bàn giao kiosk cho shop.'}
      </p>
      {/* Contact Information & Stepper */}
      <ol className="installation-progress" aria-label="Tiến độ lắp đặt">
        {TECHNICIAN_PROGRESS_STEPS.map((label, index) => (
          <li
            key={label}
            data-complete={index < currentStep || undefined}
            aria-current={index === currentStep ? 'step' : undefined}
          >
            <span aria-hidden="true">
              {index < currentStep ? <Check size={16} aria-hidden="true" /> : index + 1}
            </span>
            <strong>{label}</strong>
          </li>
        ))}
      </ol>

      <div className="tech-contact-box">
        <div>
          <strong>Điện thoại liên hệ:</strong>
          <p>
            <a href={`tel:${selectedJob.phone}`}>{selectedJob.phone}</a>
          </p>
        </div>
        <div>
          <strong>Email thông báo:</strong>
          <p>{selectedJob.contactEmail}</p>
        </div>
        <div>
          <strong>Địa chỉ lắp đặt:</strong>
          <p>{selectedJob.installationAddress}</p>
        </div>
        <div>
          <strong>Thời gian hẹn:</strong>
          <p>
            {formatDateVN(selectedJob.scheduledDate)} ({selectedJob.timeWindow})
          </p>
        </div>
      </div>

      {/* STEP 1: START VISIT */}
      {['SCHEDULED', 'INSTALLING', 'AWAITING_HANDOVER'].includes(selectedJob.status) && (
        <Esp32ConfigurationPanel
          actorId={session.id}
          scope="technician"
          resourceId={selectedJob.id}
        />
      )}

      {selectedJob.status === 'SCHEDULED' && (
        <div className="tech-action-step">
          <h3>Bắt đầu lắp đặt</h3>
          <p>
            Khi bạn đã có mặt tại điểm lắp đặt và chuẩn bị thiết bị, hãy bấm nút bắt đầu để cập nhật
            trạng thái làm việc.
          </p>
          <Button
            onClick={() => startMutation.mutate(selectedJob.id)}
            disabled={startMutation.isPending}
          >
            <ListChecks size={18} aria-hidden="true" />
            {startMutation.isPending ? 'Đang cập nhật...' : 'Bắt đầu lắp đặt'}
          </Button>
        </div>
      )}

      {/* STEP 2: PHOTO EVIDENCE UPLOAD & REPORT SUBMIT */}
      {selectedJob.status === 'INSTALLING' && (
        <div className="tech-action-step">
          <h3>Ảnh và báo cáo lắp đặt</h3>

          <TechnicianEvidenceSection
            jobId={selectedJob.id}
            evidenceInputId={evidenceInputId}
            fileInputRef={fileInputRef}
            selectedFile={selectedFile}
            onSelectFile={(file) => {
              if (!file) return;
              setSelectedFile(file);
              void handleUploadPhoto(file);
            }}
            uploadStatus={uploadStatus}
            uploading={uploading}
            submitPending={submitReportMutation.isPending}
            onUploadPhoto={() => void handleUploadPhoto()}
            evidenceItems={evidenceItems}
            evidenceLoading={evidenceQuery.isPending}
            evidenceError={evidenceQuery.isError}
            onRefetchEvidence={() => void evidenceQuery.refetch()}
          />

          {/* Report text & submit */}
          <div className="report-submit-block">
            <h4>2. Báo cáo hoàn thành lắp đặt</h4>
            <div className="kiosk-form-field">
              <label htmlFor={reportInputId}>Nội dung báo cáo chi tiết:</label>
              <textarea
                disabled={submitReportMutation.isPending}
                aria-describedby={`${reportInputId}-hint`}
                id={reportInputId}
                rows={3}
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder="Mô tả công việc: đã kết nối nguồn điện ổn định, cảm biến cửa hoạt động tốt, khóa cơ hoạt động trơn tru..."
              />
              <p id={`${reportInputId}-hint`} className="kiosk-help-text">
                Viết ít nhất 10 ký tự. Cần đính kèm thành công ít nhất 1 ảnh trước khi gửi.
              </p>
            </div>

            <Button
              onClick={handleSubmitReport}
              disabled={
                submitReportMutation.isPending ||
                uploading ||
                evidenceQuery.isError ||
                evidenceQuery.isPending ||
                evidenceItems.length === 0 ||
                !validateReportText(reportText).valid
              }
            >
              <Check size={18} aria-hidden="true" />
              {submitReportMutation.isPending ? 'Đang gửi...' : 'Nộp báo cáo hoàn thành'}
            </Button>
          </div>
        </div>
      )}

      {(selectedJob.status === 'AWAITING_HANDOVER' || selectedJob.status === 'ACTIVE') &&
        selectedJob.technicianReport && (
          <div className="report-display-box">
            <strong>Báo cáo đã gửi</strong>
            <p>{selectedJob.technicianReport}</p>
          </div>
        )}

      {(selectedJob.status === 'AWAITING_HANDOVER' || selectedJob.status === 'ACTIVE') && (
        <section aria-label="Ảnh lắp đặt đã gửi" className="technician-sent-evidence">
          <h3>Ảnh lắp đặt đã gửi</h3>
          <TechnicianEvidenceGallery
            jobId={selectedJob.id}
            evidenceItems={evidenceItems}
            evidenceLoading={evidenceQuery.isPending}
            evidenceError={evidenceQuery.isError}
            onRefetchEvidence={() => void evidenceQuery.refetch()}
          />
        </section>
      )}
      {/* STEP 3: AWAITING HANDOVER NOTICE */}
      {selectedJob.status === 'AWAITING_HANDOVER' && (
        <div className="status-notice notice-info">
          <Check size={20} aria-hidden="true" />
          <div>
            <strong>Đã nộp báo cáo thành công!</strong>
            <p>
              Chờ Quản lý vận hành kiểm tra ảnh và báo cáo để bàn giao kiosk cho shop. Bạn không cần
              gửi lại báo cáo.
            </p>
          </div>
        </div>
      )}

      {selectedJob.status === 'ACTIVE' && (
        <div className="status-notice notice-success">
          <Check size={20} aria-hidden="true" />
          <div>
            <strong>Đã bàn giao kiosk cho shop</strong>
            <p>Hồ sơ đã được Quản lý nghiệm thu và bàn giao thành công cho Chủ shop.</p>
          </div>
        </div>
      )}
    </section>
  );
}
