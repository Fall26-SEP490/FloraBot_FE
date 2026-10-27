'use client';

import { useId, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Button,
  CircleAlert,
  Check,
  RefreshCw,
  MapPin,
  ClipboardList,
  ListChecks,
  Plus,
} from '@florabot/ui';
import { ApiError, queryClient, request, type Session } from './api';
import { buildGoogleMapsDirectionsUrl } from './features/kiosk-location/kiosk-location.utils';
import type {
  TechnicianInstallationSummary,
  TechnicianInstallationDetail,
  StaffEvidenceItem,
  EvidenceUploadResponse,
} from './kioskApplicationTypes';
import { KIOSK_STATUS_LABELS } from './kioskApplicationTypes';
import './kiosk-shared.css';
import './technician-installations.css';

interface TechnicianInstallationsProps {
  session: Session;
}

interface JobDetailCardProps {
  job: TechnicianInstallationDetail;
  session: Session;
  onInvalidate: () => void;
}

function TechEvidenceImage({
  jobId,
  evidenceId,
  label,
}: {
  jobId: string;
  evidenceId: string;
  label: string;
}) {
  const [loadError, setLoadError] = useState(false);
  const src = `/api/staff/kiosk-installations/${jobId}/evidence/${evidenceId}`;

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
          <small>Ảnh minh chứng #{evidenceId.slice(0, 8)}</small>
        </div>
      )}
    </div>
  );
}

function TechJobDetailCard({ job: selectedJob, session, onInvalidate }: JobDetailCardProps) {
  const [reportText, setReportText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [currentAttachmentId, setCurrentAttachmentId] = useState<string>(() => crypto.randomUUID());
  const [uploadStatus, setUploadStatus] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

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

  // Start visit mutation
  const startMutation = useMutation({
    mutationFn: (jobId: string) =>
      request<TechnicianInstallationDetail>(`/staff/kiosk-installations/${jobId}/start`, {}),
    onSuccess: (updated) => {
      setActionSuccess(`Đã bắt đầu công việc tại điểm: ${updated.shopName}`);
      setActionError(null);
      onInvalidate();
    },
    onError: (err) => {
      setActionError(err instanceof ApiError ? err.message : 'Chưa bắt đầu được công việc.');
    },
  });

  // Upload & attach photo evidence
  const [uploading, setUploading] = useState(false);
  const handleUploadPhoto = async () => {
    if (!selectedFile || uploading) return;

    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(selectedFile.type) ||
      selectedFile.size === 0 ||
      selectedFile.size > 5 * 1024 * 1024
    ) {
      setUploadStatus('Vui lòng chọn file ảnh PNG, JPEG hoặc WebP với dung lượng dưới 5 MB.');
      return;
    }

    setUploading(true);
    setUploadStatus('Đang tải ảnh minh chứng...');
    setActionError(null);

    try {
      // Step 1: Upload binary photo using secure patterns (no-store, no-referrer, abort timeout)
      const uploadRes = await fetch(
        `/api/staff/kiosk-installations/${selectedJob.id}/evidence/upload`,
        {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
          referrerPolicy: 'no-referrer',
          headers: { 'Content-Type': selectedFile.type },
          body: selectedFile,
          signal: AbortSignal.timeout(30000),
        },
      );

      if (!uploadRes.ok) {
        const errJson = (await uploadRes.json().catch(() => ({}))) as {
          detail?: string;
          message?: string;
        };
        throw new Error(errJson.detail || errJson.message || 'Lỗi khi tải ảnh lên máy chủ.');
      }

      const uploadData = (await uploadRes.json()) as EvidenceUploadResponse;
      if (
        !uploadData.reference ||
        typeof uploadData.reference !== 'string' ||
        !uploadData.reference.startsWith('evidence:v1:')
      ) {
        throw new Error(
          'Máy chủ không trả về mã vé minh chứng hợp lệ (yêu cầu prefix evidence:v1:).',
        );
      }

      const evidenceTicket = uploadData.reference;

      // Step 2: Attach ticket to installation using stable attachment ID (retry preserves ID)
      await request(`/staff/kiosk-installations/${selectedJob.id}/evidence`, {
        id: currentAttachmentId,
        reference: evidenceTicket,
      });

      // Clear ticket and generate a NEW UUID only after successful attachment!
      setUploadStatus(`Đã tải lên và đính kèm ảnh ${selectedFile.name} thành công.`);
      setSelectedFile(null);
      setCurrentAttachmentId(crypto.randomUUID());
      if (fileInputRef.current) fileInputRef.current.value = '';
      void queryClient.invalidateQueries({
        queryKey: ['technician-installation-evidence', session.id, selectedJob.id],
      });
    } catch (err) {
      setUploadStatus(err instanceof Error ? err.message : 'Chưa tải được ảnh minh chứng.');
    } finally {
      setUploading(false);
    }
  };

  // Submit report mutation
  const submitReportMutation = useMutation({
    mutationFn: ({ jobId, report }: { jobId: string; report: string }) =>
      request<TechnicianInstallationDetail>(`/staff/kiosk-installations/${jobId}/submit`, {
        report,
      }),
    onSuccess: (updated) => {
      setActionSuccess(
        `Đã nộp báo cáo lắp đặt cho ${updated.shopName}. Hồ sơ chuyển sang Chờ nghiệm thu.`,
      );
      setActionError(null);
      setReportText('');
      onInvalidate();
    },
    onError: (err) => {
      setActionError(
        err instanceof ApiError
          ? err.message
          : 'Chưa nộp được báo cáo. Bạn cần tải lên ít nhất 1 ảnh minh chứng trước khi nộp.',
      );
    },
  });

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

      {/* Contact Information */}
      <ol className="platform-installation-steps" aria-label="Tiến độ lắp đặt">
        {['Được phân công', 'Thực hiện', 'Chờ nghiệm thu', 'Hoàn tất'].map((label, index) => {
          const current = Math.max(
            0,
            ['SCHEDULED', 'INSTALLING', 'AWAITING_HANDOVER', 'ACTIVE'].indexOf(selectedJob.status),
          );
          return (
            <li
              key={label}
              data-complete={index < current || undefined}
              aria-current={index === current ? 'step' : undefined}
            >
              <span aria-hidden="true">
                {index < current ? '✓' : String(index + 1).padStart(2, '0')}
              </span>
              <strong>{label}</strong>
            </li>
          );
        })}
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
            {selectedJob.scheduledDate} ({selectedJob.timeWindow})
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
            {startMutation.isPending
              ? 'Đang cập nhật...'
              : 'Bắt đầu khảo sát & Lắp đặt (INSTALLING)'}
          </Button>
        </div>
      )}

      {/* STEP 2: PHOTO EVIDENCE UPLOAD & REPORT SUBMIT */}
      {selectedJob.status === 'INSTALLING' && (
        <div className="tech-action-step">
          <h3>Ghi nhận minh chứng & Nộp báo cáo</h3>

          {/* Photo Upload Section */}
          <div className="evidence-upload-block">
            <h4>1. Tải ảnh minh chứng hiện trường (bắt buộc)</h4>
            <p className="kiosk-help-text">
              Ảnh chụp thực tế tủ sau khi lắp ráp, kết nối nguồn điện và góc chụp rõ tem/mã QR tủ.
              Tối đa 5 MB mỗi ảnh.
            </p>

            <div className="file-input-row">
              <label htmlFor={evidenceInputId} className="sr-only">
                Ảnh minh chứng lắp đặt
              </label>
              <input
                id={evidenceInputId}
                className="sr-only"
                tabIndex={-1}
                ref={fileInputRef}
                type="file"
                disabled={uploading || submitReportMutation.isPending}
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setSelectedFile(file);
                  setUploadStatus('');
                }}
              />
              <div className="platform-upload-picker">
                <ClipboardList size={26} aria-hidden="true" />
                <div>
                  <strong>{selectedFile?.name || 'Chọn ảnh minh chứng'}</strong>
                  <small>PNG, JPEG hoặc WebP · Tối đa 5 MB</small>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  aria-controls={evidenceInputId}
                  disabled={uploading || submitReportMutation.isPending}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {selectedFile ? 'Thay ảnh' : 'Chọn ảnh'}
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleUploadPhoto}
                disabled={!selectedFile || uploading || submitReportMutation.isPending}
              >
                <Plus size={16} aria-hidden="true" />
                {uploading ? 'Đang tải...' : 'Tải ảnh lên'}
              </Button>
            </div>

            {uploadStatus && (
              <p role="status" className="kiosk-field-hint" style={{ marginTop: '0.5rem' }}>
                {uploadStatus}
              </p>
            )}

            {/* Evidence List */}
            <div className="attached-evidence-list">
              <strong>Danh sách minh chứng đã đính kèm ({evidenceItems.length}):</strong>
              {evidenceQuery.isPending ? (
                <p role="status">Đang tải minh chứng…</p>
              ) : evidenceQuery.isError ? (
                <div role="alert">
                  <p>Chưa đọc được minh chứng lắp đặt.</p>
                  <Button variant="outline" onClick={() => void evidenceQuery.refetch()}>
                    Tải lại minh chứng
                  </Button>
                </div>
              ) : evidenceItems.length === 0 ? (
                <p className="empty-sub-text">
                  Chưa có ảnh nào được đính kèm. Vui lòng tải lên ít nhất 1 ảnh.
                </p>
              ) : (
                <div className="evidence-thumbnails-grid">
                  {evidenceItems.map((ev, i) => (
                    <TechEvidenceImage
                      key={ev.id || i}
                      jobId={selectedJob.id}
                      evidenceId={ev.id}
                      label={`Ảnh #${i + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Report text & submit */}
          <div className="report-submit-block">
            <h4>2. Báo cáo hoàn thành lắp đặt</h4>
            <div className="kiosk-form-field">
              <label htmlFor={reportInputId}>Nội dung báo cáo chi tiết:</label>
              <textarea
                id={reportInputId}
                rows={3}
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder="Mô tả công việc: đã kết nối nguồn điện ổn định, cảm biến cửa hoạt động tốt, khóa cơ hoạt động trơn tru..."
              />
            </div>

            <Button
              onClick={() => {
                if (uploading || evidenceQuery.isError || evidenceQuery.isPending) return;
                if (reportText.trim().length < 10) {
                  setActionError('Báo cáo cần ít nhất 10 ký tự.');
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
              }}
              disabled={
                submitReportMutation.isPending ||
                uploading ||
                evidenceQuery.isError ||
                evidenceQuery.isPending ||
                evidenceItems.length === 0
              }
            >
              <Check size={18} aria-hidden="true" />
              {submitReportMutation.isPending ? 'Đang gửi...' : 'Nộp báo cáo hoàn thành'}
            </Button>
          </div>
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

export default function TechnicianInstallations({ session }: TechnicianInstallationsProps) {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Query: Assigned installation jobs (scoped by signed-in technician)
  const jobsQuery = useQuery({
    queryKey: ['technician-kiosk-installations', session.id],
    queryFn: () => request<TechnicianInstallationSummary[]>('/staff/kiosk-installations'),
  });

  const jobs = jobsQuery.data || [];
  const initialJobId = jobs.length > 0 ? jobs[0].id : null;
  const effectiveJobId = selectedJobId ?? initialJobId;

  // Query: Specific Job Detail (fetch actual detail)
  const jobDetailQuery = useQuery({
    queryKey: ['technician-installation-detail', session.id, effectiveJobId],
    queryFn: () =>
      request<TechnicianInstallationDetail>(`/staff/kiosk-installations/${effectiveJobId}`),
    enabled: !!effectiveJobId,
    refetchOnWindowFocus: false,
  });

  const selectedJob = jobDetailQuery.data ?? null;

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: ['technician-kiosk-installations', session.id],
    });
    if (selectedJob?.id) {
      void queryClient.invalidateQueries({
        queryKey: ['technician-installation-detail', session.id, selectedJob.id],
      });
      void queryClient.invalidateQueries({
        queryKey: ['technician-installation-evidence', session.id, selectedJob.id],
      });
    }
  };

  return (
    <div className="technician-installations-view">
      <div className="dashboard-page-heading">
        <div>
          <h1>Lắp đặt Kiosk được phân công</h1>
          <p>
            Xem địa chỉ, chỉ đường Google Maps, khảo sát hiện trường, tải ảnh minh chứng thực tế và
            nộp báo cáo hoàn thành.
          </p>
        </div>
        <span className="dashboard-context">Kỹ thuật viên</span>
      </div>

      {jobsQuery.isLoading && (
        <p role="status" className="kiosk-status-loading">
          <RefreshCw className="spin" size={16} aria-hidden="true" /> Đang tải danh sách công việc
          được phân công...
        </p>
      )}

      {jobsQuery.isError && (
        <div role="alert" className="kiosk-field-error-banner">
          <CircleAlert size={18} aria-hidden="true" />
          <span>Không thể tải danh sách công việc. Vui lòng thử lại.</span>
          <Button variant="outline" onClick={() => void jobsQuery.refetch()}>
            Tải lại công việc
          </Button>
        </div>
      )}

      {jobs.length === 0 && !jobsQuery.isLoading && !jobsQuery.isError && (
        <div className="kiosk-empty-state">
          <span className="platform-empty-icon">
            <ClipboardList size={30} aria-hidden="true" />
          </span>
          <h3>Chưa có công việc lắp đặt nào</h3>
          <p>Hiện bạn không có công việc lắp đặt kiosk nào đang chờ thực hiện.</p>
          <p className="platform-empty-hint">
            Công việc sẽ xuất hiện tại đây khi Quản lý vận hành phân công cho bạn.
          </p>
          <a className="button button-outline" href="/technician">
            Xem công việc kỹ thuật
          </a>
        </div>
      )}

      {jobs.length > 0 && (
        <div className="technician-workspace-layout">
          {/* Left Column: Job Cards List */}
          <section className="tech-jobs-list" aria-label="Danh sách công việc lắp đặt">
            {jobs.map((job) => {
              const isSelected = selectedJob?.id === job.id;
              return (
                <div
                  key={job.id}
                  className={`tech-job-card ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => {
                    setSelectedJobId(job.id);
                  }}
                  tabIndex={0}
                  role="button"
                  aria-pressed={isSelected}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      setSelectedJobId(job.id);
                    }
                  }}
                >
                  <div className="job-card-header">
                    <h4>{job.shopName}</h4>
                    <span className="kiosk-status-pill" data-status={job.status}>
                      {KIOSK_STATUS_LABELS[job.status] || job.status}
                    </span>
                  </div>

                  <p className="job-address-line">
                    <MapPin size={16} aria-hidden="true" />
                    <span>{job.installationAddress}</span>
                  </p>

                  <div className="job-meta-row">
                    <span>
                      <ClipboardList size={14} aria-hidden="true" /> {job.scheduledDate}
                    </span>
                    <span>
                      <ListChecks size={14} aria-hidden="true" /> {job.timeWindow}
                    </span>
                    <span>
                      Tủ: <code>{job.kioskCode}</code>
                    </span>
                  </div>

                  {job.reworkReason && (
                    <div className="job-rework-tag" role="alert">
                      Cần làm lại: {job.reworkReason}
                    </div>
                  )}
                </div>
              );
            })}
          </section>

          {/* Right Column: Selected Job Details with stable key */}
          {jobDetailQuery.isPending && effectiveJobId && (
            <p role="status">Đang tải chi tiết lắp đặt…</p>
          )}
          {jobDetailQuery.isError && (
            <div role="alert">
              <p>Chưa đọc được chi tiết. Hãy tải lại trước khi thao tác.</p>
              <Button variant="outline" onClick={() => void jobDetailQuery.refetch()}>
                Tải lại chi tiết lắp đặt
              </Button>
            </div>
          )}
          {selectedJob && !jobDetailQuery.isError && (
            <TechJobDetailCard
              key={`${session.id}-${selectedJob.id}`}
              job={selectedJob}
              session={session}
              onInvalidate={invalidate}
            />
          )}
        </div>
      )}
    </div>
  );
}
