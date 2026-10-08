import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import EvidenceUpload from './EvidenceUpload';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@florabot/ui';
import type { components } from '../../../packages/contracts/src/generated/api';

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
  onSaved,
}: {
  orderId: string;
  trackingToken: string;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [review, setReview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkReceipt, setCheckReceipt] = useState(false);
  const [error, setError] = useState('');
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
    if (sending.current || checkReceipt) return;
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
        onSaved();
        return;
      }
      if (response.status >= 500) throw new Error('unknown-outcome');
      if (response.status === 404 || response.status === 409) {
        setCheckReceipt(true);
        setEditing(false);
        form.reset(empty);
        setError(
          'Trạng thái hoặc thời hạn phản ánh đã thay đổi, hoặc hai mã chưa khớp. Chọn “Xem biên nhận” để cập nhật trước khi tiếp tục.',
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
        form.reset(empty);
        setEditing(false);
        setReview(false);
        setCheckReceipt(true);
        setError(
          'Chưa xác nhận được kết quả gửi. Phản ánh có thể đã được ghi nhận. Chọn “Xem biên nhận” để kiểm tra trước khi gửi lại.',
        );
      }
    } finally {
      sending.current = false;
      if (!active.signal.aborted) setSaving(false);
    }
  }

  return (
    <div className="receipt-complaint">
      <h3>Có điều gì chưa như mong đợi?</h3>
      <p>
        Hãy kể cho chúng tôi vấn đề của bó hoa bạn nhận được. Mỗi đơn chỉ gửi một phản ánh; đội ngũ
        sẽ xem xét trước khi quyết định cách xử lý.
      </p>
      {!editing && !checkReceipt && (
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
              {...form.register('reason')}
              readOnly={saving}
              aria-invalid={!!form.formState.errors.reason}
              aria-describedby="complaint-reason-help complaint-reason-error"
            />
            <p className="quiet" id="complaint-reason-help">
              Mô tả tình trạng khi nhận hoa. Không cần ghi số điện thoại, địa chỉ hay thông tin ngân
              hàng.
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
                />
              )}
            />
          </div>
          {review && (
            <div>
              <h4 ref={reviewHeading} tabIndex={-1}>
                Kiểm tra phản ánh trước khi gửi
              </h4>
              <p className="complaint-content">{form.getValues('reason')}</p>
              <p className="complaint-content">Ảnh minh chứng đã lưu riêng tư.</p>
              <p>
                Sau khi gửi thành công, bạn không thể gửi phản ánh thứ hai cho đơn này. Gửi phản ánh
                chưa đồng nghĩa với được hoàn tiền.
              </p>
            </div>
          )}
          <div className="receipt-actions">
            <Button type="submit" disabled={saving}>
              {saving
                ? 'Đang gửi phản ánh…'
                : review
                  ? 'Xác nhận gửi phản ánh'
                  : 'Kiểm tra phản ánh'}
            </Button>
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
