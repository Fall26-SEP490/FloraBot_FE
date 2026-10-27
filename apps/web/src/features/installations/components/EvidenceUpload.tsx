import { useEffect, useRef, useState, type Ref } from 'react';
import { Button } from '@florabot/ui';
import type { components } from '../../../../../../packages/contracts/src/generated/api';

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
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function upload() {
    if (!file || busy) return;
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size === 0 ||
      file.size > 5 * 1024 * 1024
    ) {
      setStatus('Chọn ảnh PNG, JPEG hoặc WebP, tối đa 5 MB.');
      return;
    }
    const active = new AbortController();
    controller.current = active;
    setBusy(true);
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
      if (!active.signal.aborted)
        setStatus(
          failure instanceof Error && failure.name === 'Error'
            ? failure.message
            : 'Chưa xác nhận được ảnh đã lưu. Bạn có thể tải lại; hồ sơ chưa được gửi.',
        );
    } finally {
      if (!active.signal.aborted) setBusy(false);
    }
  }
  return (
    <div className="evidence-upload">
      <label htmlFor={id}>Ảnh minh chứng</label>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={disabled || busy}
        aria-invalid={!!error}
        aria-describedby={`${id}-help ${id}-error ${id}-status`}
        onChange={(event) => {
          setFile(event.target.files?.[0] ?? null);
          setStatus('');
          onReference('');
        }}
      />
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
      <p id={`${id}-status`} role="status">
        {status}
      </p>
      <p id={`${id}-error`} className="error">
        {error}
      </p>
    </div>
  );
}
