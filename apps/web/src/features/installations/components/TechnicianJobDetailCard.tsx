import { useId, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Check, CircleAlert, ListChecks, MapPin } from '@florabot/ui';
import { request, type Session } from '@/shared/lib/api';
import { buildGoogleMapsDirectionsUrl } from '../../kiosk-location/kiosk-location.utils';
import { KIOSK_STATUS_LABELS, TECHNICIAN_PROGRESS_STEPS } from '../installations.constants';
import type { StaffEvidenceItem, TechnicianInstallationDetail } from '../installations.types';
import { formatDateVN, getTechnicianStepIndex, validateReportText } from '../installations.utils';
import { useTechnicianActions } from '../hooks/useTechnicianActions';
import { TechnicianEvidenceSection } from './TechnicianEvidenceSection';

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
    setUploadStatus,
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
          <p className="job-code-subtitle">
            Mã tủ phân bổ: <strong>{selectedJob.kioskCode}</strong>
          </p>
        </div>

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

      {/* Contact Information & Stepper */}
      <ol className="installation-progress" aria-label="Tiến độ lắp đặt">
        {TECHNICIAN_PROGRESS_STEPS.map((label, index) => (
          <li
            key={label}
            data-complete={index < currentStep || undefined}
            aria-current={index === currentStep ? 'step' : undefined}
          >
            <span aria-hidden="true">
              {index < currentStep ? '✓' : String(index + 1).padStart(2, '0')}
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
      {selectedJob.status === 'SCHEDULED' && (
        <div className="tech-action-step">
          <h3>Bắt đầu tiến hành lắp đặt</h3>
          <p>
            Khi bạn đã có mặt tại điểm lắp đặt và chuẩn bị thiết bị, hãy bấm nút bắt đầu để cập nhật
            trạng thái làm việc.
          </p>
          <Button
            onClick={() => startMutation.mutate(selectedJob.id)}
            disabled={startMutation.isPending}
          >
            <ListChecks size={18} aria-hidden="true" />
            {startMutation.isPending ? 'Đang cập nhật...' : 'Bắt đầu khảo sát & Lắp đặt'}
          </Button>
        </div>
      )}

      {/* STEP 2: PHOTO EVIDENCE UPLOAD & REPORT SUBMIT */}
      {selectedJob.status === 'INSTALLING' && (
        <div className="tech-action-step">
          <h3>Ghi nhận minh chứng & Nộp báo cáo</h3>

          <TechnicianEvidenceSection
            jobId={selectedJob.id}
            evidenceInputId={evidenceInputId}
            fileInputRef={fileInputRef}
            selectedFile={selectedFile}
            onSelectFile={(file) => {
              setSelectedFile(file);
              setUploadStatus('');
            }}
            uploadStatus={uploadStatus}
            uploading={uploading}
            submitPending={submitReportMutation.isPending}
            onUploadPhoto={handleUploadPhoto}
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

      {/* STEP 3: AWAITING HANDOVER NOTICE */}
      {selectedJob.status === 'AWAITING_HANDOVER' && (
        <div className="status-notice notice-info">
          <Check size={20} aria-hidden="true" />
          <div>
            <strong>Đã nộp báo cáo thành công!</strong>
            <p>
              Hồ sơ đã chuyển sang trạng thái <strong>Chờ nghiệm thu bàn giao</strong>. Quản lý vận
              hành sẽ kiểm tra hình ảnh minh chứng và báo cáo của bạn để kích hoạt tủ và tài khoản
              Chủ shop cho khách hàng.
            </p>
          </div>
        </div>
      )}

      {selectedJob.status === 'ACTIVE' && (
        <div className="status-notice notice-success">
          <Check size={20} aria-hidden="true" />
          <div>
            <strong>Tủ Kiosk đã hoạt động!</strong>
            <p>Hồ sơ đã được Quản lý nghiệm thu và bàn giao thành công cho Chủ shop.</p>
          </div>
        </div>
      )}
    </section>
  );
}
