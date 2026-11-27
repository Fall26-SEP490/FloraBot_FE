import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import EvidenceUpload from '../../../shared/components/EvidenceUpload';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@florabot/ui';
import type { components } from '../../../../../../packages/contracts/src/generated/api';

const schema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, 'Mô tả vấn đề từ 5 ký tự.')
    .max(2000, 'Nội dung tối đa 2.000 ký tự.')
    .refine(
      (value) =>
        !Array.from(value).some(
          (c) => (c.charCodeAt(0) < 32 && !'\n\r\t'.includes(c)) || c.charCodeAt(0) === 127,
        ),
      'Không nhập ký tự điều khiển.',
    ),
  photo: z.string().startsWith('evidence:v1:', 'Tải ảnh minh chứng trước khi gửi.'),
});
type Fields = z.infer<typeof schema>;
const empty: Fields = { reason: '', photo: '' };

export default function ReceiptComplaint({
  orderId,
  trackingToken,
  onCheckReceipt,
  onSaved,
  canComplain,
  receiptRevision,
  initiallyOpen = false,
}: {
  orderId: string;
  trackingToken: string;
  onCheckReceipt: () => Promise<boolean>;
  onSaved: () => void;
  canComplain: boolean;
  receiptRevision: number;
  initiallyOpen?: boolean;
}) {
  const [editing, setEditing] = useState(() => initiallyOpen && canComplain);
  const [review, setReview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [blockedRevision, setBlockedRevision] = useState<number | null>(null);
  const checkReceipt = !canComplain || blockedRevision === receiptRevision;
  function setCheckReceipt(value: boolean) {
    setBlockedRevision(value ? receiptRevision : null);
  }
  const [checkingReceipt, setCheckingReceipt] = useState(false);
  const [errorState, setErrorState] = useState('');
  const [errorRevision, setErrorRevision] = useState(receiptRevision);
  function setError(value: string) {
    setErrorState(value);
    setErrorRevision(receiptRevision);
  }
  const error =
    !canComplain && editing
      ? 'Biên nhận hiện không cho phép gửi phản ánh. Nội dung đang nhập vẫn được giữ để bạn xem lại.'
      : errorRevision === receiptRevision
        ? errorState
        : '';
  const form = useForm<Fields>({ resolver: zodResolver(schema), defaultValues: empty });
  const controller = useRef<AbortController | null>(null);
  const sending = useRef(false);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const shouldRestoreFocus = useRef(false);
  useEffect(() => () => controller.current?.abort(), []);
  useLayoutEffect(() => {
    if (review) reviewHeading.current?.focus();
    else if (editing) form.setFocus('reason');
    else if (shouldRestoreFocus.current) {
      opener.current?.focus();
      shouldRestoreFocus.current = false;
    }
  }, [editing, review, form]);

  async function submit(values: Fields) {
    if (sending.current || checkReceipt || !canComplain) return;
    sending.current = true;
    setSaving(true);
    setError('');
    const active = new AbortController();
    controller.current = active;
    const body: components['schemas']['OpenDisputeRequest'] = {
      p_order: orderId,
      p_tracking: trackingToken,
      p_reason: values.reason,
      p_photo: values.photo,
    };
    try {
      const response = await fetch('/api/receipts/flows/open_dispute', {
        method: 'POST',
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.any([active.signal, AbortSignal.timeout(15_000)]),
      });
      if (active.signal.aborted) return;
      if (response.ok) {
        form.reset(empty);
        setEditing(false);
        setCheckReceipt(false);
        onSaved();
        return;
      }
      if (response.status >= 500) throw new Error('unknown-outcome');
      if (response.status === 404 || response.status === 409) {
        setCheckReceipt(true);
        setError(
          'Trạng thái hoặc thời hạn phản ánh đã thay đổi. Chọn “Kiểm tra trạng thái biên nhận” trước khi tiếp tục.',
        );
      } else {
        setError(
          response.status === 429
            ? 'Bạn thao tác hơi nhanh. Vui lòng thử lại sau một phút.'
            : 'Kiểm tra lại nội dung phản ánh và tải lại ảnh minh chứng nếu đã hết hạn.',
        );
      }
      setReview(false);
    } catch {
      if (!active.signal.aborted) {
        setReview(false);
        setCheckReceipt(true);
        setError(
          'Chưa xác nhận được kết quả gửi. Nội dung và ảnh vẫn được giữ. Hãy kiểm tra trạng thái biên nhận trước khi gửi lại.',
        );
      }
    } finally {
      sending.current = false;
      if (!active.signal.aborted) setSaving(false);
    }
  }

  if (!editing && !canComplain) return null;
  return (
    <div className="receipt-complaint">
      <h3>Nội dung phản ánh</h3>
      {!review && <p>Mỗi đơn gửi một phản ánh, kèm ảnh hoa khi nhận.</p>}
      {!editing && (
        <Button
          ref={opener}
          variant="outline"
          onClick={() => {
            setEditing(true);
            setError('');
          }}
        >
          Gửi phản ánh về hoa
        </Button>
      )}
      {editing && (
        <form
          noValidate
          aria-label="Phản ánh về hoa"
          onSubmit={(event) => {
            event.preventDefault();
            if (review) void form.handleSubmit(submit)(event);
            else
              void form.handleSubmit(() => {
                setReview(true);
                setError('');
              })(event);
          }}
        >
          <div hidden={review}>
            <label htmlFor="complaint-reason">Vấn đề với bó hoa</label>
            <textarea
              id="complaint-reason"
              rows={4}
              maxLength={2000}
              placeholder="Ví dụ: Hoa bị dập cánh, thiếu cành hoặc không đúng mẫu đã đặt…"
              {...form.register('reason')}
              readOnly={saving}
              aria-invalid={!!form.formState.errors.reason}
              aria-describedby="complaint-reason-help complaint-reason-error"
            />
            <p className="quiet" id="complaint-reason-help">
              Không ghi thông tin cá nhân hoặc tài khoản ngân hàng.
            </p>
            <p className="error" id="complaint-reason-error">
              {form.formState.errors.reason?.message}
            </p>
            <Controller
              control={form.control}
              name="photo"
              render={({ field }) => (
                <EvidenceUpload
                  id="complaint-photo"
                  endpoint={`/api/receipts/${orderId}/evidence`}
                  inputRef={field.ref}
                  onReference={field.onChange}
                  disabled={saving}
                  error={form.formState.errors.photo?.message}
                  anonymous
                  receiptToken={trackingToken}
                  helpText="PNG, JPEG hoặc WebP, tối đa 5 MB."
                />
              )}
            />
          </div>
          {review && (
            <div className="complaint-review">
              <h4 ref={reviewHeading} tabIndex={-1}>
                Kiểm tra phản ánh trước khi gửi
              </h4>
              <p className="complaint-content">{form.getValues('reason')}</p>
              <p className="complaint-review-meta">Ảnh minh chứng đã lưu.</p>
              <p className="complaint-review-note">
                Sau khi gửi thành công, bạn không thể gửi phản ánh thứ hai cho đơn này. Gửi phản ánh
                chưa đồng nghĩa với được hoàn tiền.
              </p>
            </div>
          )}
          <div className="receipt-actions">
            {checkReceipt ? (
              <Button
                type="button"
                disabled={checkingReceipt}
                onClick={async () => {
                  setCheckingReceipt(true);
                  try {
                    if (await onCheckReceipt()) {
                      setCheckReceipt(false);
                      setError('');
                    } else {
                      setError('Chưa xác nhận được bạn có thể gửi lại. Bản nháp vẫn được giữ.');
                    }
                  } finally {
                    setCheckingReceipt(false);
                  }
                }}
              >
                {checkingReceipt ? 'Đang kiểm tra…' : 'Kiểm tra trạng thái biên nhận'}
              </Button>
            ) : (
              <Button type="submit" disabled={saving}>
                {saving
                  ? 'Đang gửi phản ánh…'
                  : review
                    ? 'Xác nhận gửi phản ánh'
                    : 'Kiểm tra phản ánh'}
              </Button>
            )}
            {review && (
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setReview(false)}
              >
                Sửa phản ánh
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => {
                form.reset(empty);
                shouldRestoreFocus.current = true;
                setEditing(false);
                setReview(false);
                setError('');
              }}
            >
              Hủy phản ánh
            </Button>
          </div>
        </form>
      )}
      <p role="alert" className="error">
        {error}
      </p>
    </div>
  );
}
