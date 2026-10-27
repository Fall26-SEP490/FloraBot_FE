import { useState, type RefObject } from 'react';
import { Button, CircleAlert, ClipboardList, Plus } from '@florabot/ui';
import type { StaffEvidenceItem } from '../installations.types';

function TechEvidenceThumbnail({
  jobId,
  evidenceId,
  index,
}: {
  jobId: string;
  evidenceId: string;
  index: number;
}) {
  const [loadError, setLoadError] = useState(false);
  const src = `/api/staff/kiosk-installations/${jobId}/evidence/${evidenceId}`;

  return (
    <div className="evidence-thumb-card">
      <span className="thumb-label">{`Ảnh #${index + 1}`}</span>
      {!loadError ? (
        <img
          src={src}
          alt={`Ảnh #${index + 1}`}
          loading="lazy"
          className="evidence-actual-img"
          onError={() => setLoadError(true)}
        />
      ) : (
        <div className="evidence-fallback-box">
          <CircleAlert size={16} aria-hidden="true" />
          <small>{`Ảnh minh chứng #${evidenceId.slice(0, 8)}`}</small>
        </div>
      )}
    </div>
  );
}

interface TechnicianEvidenceSectionProps {
  jobId: string;
  evidenceInputId: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  selectedFile: File | null;
  onSelectFile: (file: File | null) => void;
  uploadStatus: string;
  uploading: boolean;
  submitPending: boolean;
  onUploadPhoto: () => void;
  evidenceItems: StaffEvidenceItem[];
  evidenceLoading: boolean;
  evidenceError: boolean;
  onRefetchEvidence: () => void;
}

export function TechnicianEvidenceSection({
  jobId,
  evidenceInputId,
  fileInputRef,
  selectedFile,
  onSelectFile,
  uploadStatus,
  uploading,
  submitPending,
  onUploadPhoto,
  evidenceItems,
  evidenceLoading,
  evidenceError,
  onRefetchEvidence,
}: TechnicianEvidenceSectionProps) {
  return (
    <div className="evidence-upload-block">
      <h4>1. Tải ảnh minh chứng hiện trường (bắt buộc)</h4>
      <p className="kiosk-help-text">
        Ảnh chụp thực tế tủ sau khi lắp ráp, kết nối nguồn điện và góc chụp rõ tem/mã QR tủ. Tối đa
        5 MB mỗi ảnh.
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
          disabled={uploading || submitPending}
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0] || null;
            onSelectFile(file);
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
            disabled={uploading || submitPending}
            onClick={() => fileInputRef.current?.click()}
          >
            {selectedFile ? 'Thay ảnh' : 'Chọn ảnh'}
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onUploadPhoto}
          disabled={!selectedFile || uploading || submitPending}
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
        {evidenceLoading ? (
          <p role="status">Đang tải minh chứng…</p>
        ) : evidenceError ? (
          <div role="alert">
            <p>Chưa đọc được minh chứng lắp đặt.</p>
            <Button variant="outline" onClick={onRefetchEvidence}>
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
              <TechEvidenceThumbnail key={ev.id || i} jobId={jobId} evidenceId={ev.id} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
