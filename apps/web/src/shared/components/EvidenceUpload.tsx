import { useEffect, useRef, useState, type Ref } from 'react';
import { Button } from '@florabot/ui';
import type { components } from '../../../../../packages/contracts/src/generated/api';

export default function EvidenceUpload({
  id,
  endpoint,
  onReference,
  inputRef,
  disabled,
  error,
  anonymous = false,
  receiptToken,
}: {
  id: string;
  endpoint: string;
  onReference: (value: string) => void;
  inputRef?: Ref<HTMLInputElement>;
  disabled?: boolean;
  error?: string;
  anonymous?: boolean;
  receiptToken?: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [uploadError, setUploadError] = useState('');
  const errorMessage = uploadError || error;
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function upload() {
    if (!file || busy) return;
    setStatus('');
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size === 0 ||
      file.size > 5 * 1024 * 1024
    ) {
      setUploadError('Chọn ảnh PNG, JPEG hoặc WebP, tối đa 5 MB.');
      return;
    }
    const active = new AbortController();
    controller.current = active;
    setBusy(true);
    setUploadError('');
    setStatus('Đang lưu ảnh riêng tư…');
    onReference('');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: anonymous ? 'omit' : 'include',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        headers: {
          'Content-Type': file.type,
          ...(receiptToken ? { 'X-Receipt-Token': receiptToken } : {}),
        },
        body: file,
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
        setStatus(`Đã lưu ảnh ${file.name}. Hãy gửi hồ sơ trong 30 phút.`);
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
      <div className="evidence-file-control">
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
            setFile(event.target.files?.[0] ?? null);
            setStatus('');
            setUploadError('');
            onReference('');
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled || busy}
          onClick={() => document.getElementById(id)?.click()}
        >
          Chọn ảnh
        </Button>
        <span className="evidence-file-name" aria-live="polite">
          {file ? file.name : 'Chưa chọn tệp nào'}
        </span>
      </div>
      <p id={`${id}-help`} className="quiet">
        Ảnh lưu riêng tư để đội ngũ xử lý hồ sơ. Chọn PNG, JPEG hoặc WebP tối đa 5 MB; tránh chụp
        thông tin cá nhân không cần thiết.
      </p>
      <Button
        type="button"
        variant="outline"
        disabled={!file || busy || disabled}
        onClick={() => void upload()}
      >
        {busy ? 'Đang tải ảnh…' : 'Tải ảnh minh chứng'}
      </Button>
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
