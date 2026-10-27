import { useId, useState } from 'react';
import { Button, Check, CircleAlert } from '@florabot/ui';
import type { IncidentPhoto, KioskApplicationResponse } from '../installations.types';

interface OperationsEvidenceImageProps {
  appId: string;
  evidenceId: string;
  label: string;
}

function OperationsEvidenceImage({ appId, evidenceId, label }: OperationsEvidenceImageProps) {
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

interface InstallationHandoverPanelProps {
  appDetail: KioskApplicationResponse;
  evidencePhotos: IncidentPhoto[];
  isManager: boolean;
  reworkReason: string;
  onReworkReasonChange: (reason: string) => void;
  onHandover: () => void;
  onRework: () => void;
  handoverPending: boolean;
  reworkPending: boolean;
}

export function InstallationHandoverPanel({
  appDetail,
  evidencePhotos,
  isManager,
  reworkReason,
  onReworkReasonChange,
  onHandover,
  onRework,
  handoverPending,
  reworkPending,
}: InstallationHandoverPanelProps) {
  const reworkReasonId = useId();

  return (
    <div className="operations-action-card">
      <h3>Bước 3: Nghiệm thu kết quả lắp đặt & Bàn giao</h3>
      <div className="report-display-box">
        <strong>Báo cáo từ Kỹ thuật viên ({appDetail.assignedTechnicianName}):</strong>
        <p>{appDetail.technicianReport || 'Chưa ghi nhận nội dung báo cáo chi tiết.'}</p>
      </div>

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
            Đang lấy ảnh minh chứng từ phiếu lắp đặt. Cần có ít nhất 1 ảnh để tiến hành bàn giao.
          </p>
        )}
      </div>

      {isManager && (
        <>
          <div className="action-buttons-row">
            <Button
              onClick={onHandover}
              disabled={
                handoverPending ||
                evidencePhotos.length === 0 ||
                !appDetail.technicianReport?.trim()
              }
            >
              <Check size={18} aria-hidden="true" />
              {handoverPending ? 'Đang kích hoạt...' : 'Nghiệm thu Đạt & Bàn giao Kiosk'}
            </Button>
          </div>

          <div className="rework-sub-section">
            <h4>Yêu cầu kỹ thuật viên kiểm tra / sửa lại:</h4>
            <div className="kiosk-form-field">
              <label htmlFor={reworkReasonId}>Lý do yêu cầu làm lại:</label>
              <input
                id={reworkReasonId}
                type="text"
                value={reworkReason}
                onChange={(e) => onReworkReasonChange(e.target.value)}
                placeholder="Ví dụ: Ảnh chụp chưa rõ mã QR, yêu cầu chụp lại góc chính diện..."
              />
            </div>
            <Button variant="outline" onClick={onRework} disabled={reworkPending}>
              Gửi yêu cầu làm lại (Chuyển về INSTALLING)
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
