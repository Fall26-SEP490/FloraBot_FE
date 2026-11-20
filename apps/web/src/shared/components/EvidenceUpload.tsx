import { useEffect, useRef, useState, type Ref } from 'react';
import { Button } from '@florabot/ui';
import type { components } from '../../../../../packages/contracts/src/generated/api';
import EvidencePreview from './EvidencePreview';

export default function EvidenceUpload({
  id,
  endpoint,
  onReference,
  inputRef,
  disabled,
  error,
  anonymous = false,
  receiptToken,
  helpText,
  autoUpload = false,
  onFileChange,
}: {
  id: string;
  endpoint: string;
  onReference: (value: string) => void;
  inputRef?: Ref<HTMLInputElement>;
  disabled?: boolean;
  error?: string;
  anonymous?: boolean;
  receiptToken?: string;
  helpText?: string;
  autoUpload?: boolean;
  onFileChange?: (file: File | null) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [uploadError, setUploadError] = useState('');
  const errorMessage = [...new Set([uploadError, error].filter(Boolean))].join(' ');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function upload(selected = file) {
    if (!selected || busy) return;
    setStatus('');
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(selected.type) ||
      selected.size === 0 ||
      selected.size > 5 * 1024 * 1024
    ) {
      setUploadError('Chọn ảnh PNG, JPEG hoặc WebP, tối đa 5 MB.');
      return;
    }
    const active = new AbortController();
    controller.current = active;
    setBusy(true);
    setUploadError('');
    setStatus('Đang lưu ảnh...');
    onReference('');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: anonymous ? 'omit' : 'include',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        headers: {
          'Content-Type': selected.type,
          ...(receiptToken ? { 'X-Receipt-Token': receiptToken } : {}),
        },
        body: selected,
        signal: AbortSignal.any([active.signal, AbortSignal.timeout(40_000)]),
      });
      const data = (await response.json().catch(() => ({}))) as Partial<
        components['schemas']['EvidenceUploadResponse']
      > & { detail?: string };
      if (!response.ok || !data.reference?.startsWith('evidence:v1:'))
        throw new Error(
          data.detail ||
            (response.status === 401
              ? 'Phiên đã hết hạn. Đăng nhập lại trước khi tải ảnh.'
              : 'Chưa lưu được ảnh. Kiểm tra kết nối và thử lại.'),
        );
      if (!active.signal.aborted) {
        onReference(data.reference);
        setStatus(
          autoUpload
            ? 'Đã lưu ảnh. Hãy gửi báo cáo trong 30 phút.'
            : `Đã lưu ảnh ${selected.name}. Hãy gửi hồ sơ trong 30 phút.`,
        );
      }
    } catch (failure) {
      if (!active.signal.aborted) {
        setStatus('');
        setUploadError(
          failure instanceof Error && failure.name === 'Error'
            ? failure.message
            : 'Chưa xác nhận được ảnh đã lưu. Bạn có thể tải lại; hồ sơ chưa được gửi.',
        );
      }
    } finally {
      if (!active.signal.aborted) setBusy(false);
    }
  }
  return (
    <div className="evidence-upload">
      <label htmlFor={id}>Ảnh minh chứng</label>
      <div className="evidence-file-control" data-auto-upload={autoUpload || undefined}>
        <input
          ref={inputRef}
          id={id}
          type="file"
          className="product-photo-file-input"
          tabIndex={-1}
          accept="image/png,image/jpeg,image/webp"
          disabled={disabled || busy}
          aria-invalid={Boolean(errorMessage)}
          aria-describedby={`${id}-help${status ? ` ${id}-status` : ''}${errorMessage ? ` ${id}-error` : ''}`}
          onChange={(event) => {
            const selected = event.target.files?.[0] ?? null;
            setFile(selected);
            setStatus('');
            setUploadError('');
            onReference('');
            const valid =
              selected &&
              ['image/png', 'image/jpeg', 'image/webp'].includes(selected.type) &&
              selected.size > 0 &&
              selected.size <= 5 * 1024 * 1024;
            onFileChange?.(valid ? selected : null);
            if (autoUpload && selected) void upload(selected);
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled || busy}
          onClick={() => document.getElementById(id)?.click()}
        >
          {autoUpload && file ? 'Đổi ảnh' : 'Chọn ảnh'}
        </Button>
        {(!onFileChange || !file) && (
          <span className="evidence-file-name" aria-live="polite" title={file?.name}>
            {file ? file.name : 'Chưa chọn tệp nào'}
          </span>
        )}
      </div>
      {onFileChange &&
        file &&
        ['image/png', 'image/jpeg', 'image/webp'].includes(file.type) &&
        file.size > 0 &&
        file.size <= 5 * 1024 * 1024 && <EvidencePreview file={file} />}
      <p id={`${id}-help`} className="quiet">
        {helpText ??
          'Ảnh dùng để đội ngũ xử lý hồ sơ. Chọn PNG, JPEG hoặc WebP tối đa 5 MB; tránh chụp thông tin cá nhân không cần thiết.'}
      </p>
      {(!autoUpload || (file && uploadError)) && (
        <Button
          type="button"
          variant="outline"
          disabled={!file || busy || disabled}
          onClick={() => void upload()}
        >
          {busy ? 'Đang tải ảnh…' : autoUpload ? 'Thử tải lại' : 'Tải ảnh minh chứng'}
        </Button>
      )}
      {status && (
        <p id={`${id}-status`} role="status">
          {status}
        </p>
      )}
      {errorMessage && (
        <p id={`${id}-error`} className="error" role={uploadError ? 'alert' : undefined}>
          {errorMessage}
        </p>
      )}
    </div>
  );
}
