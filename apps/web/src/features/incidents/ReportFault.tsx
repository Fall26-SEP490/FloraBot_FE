import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@florabot/ui';
import { ApiError, queryClient, request } from '@/shared/lib/api';
import EvidenceUpload from '../../shared/components/EvidenceUpload';
import EvidencePreview from '../../shared/components/EvidencePreview';
import type {
  FlowResult,
  ReportDeviceFaultRequest,
  ReportFaultProps,
  SellerSlot,
} from './incidents.types';

export type { ReportFaultProps };

const schema = z.object({
  description: z
    .string()
    .trim()
    .min(5, 'Mô tả sự cố ít nhất 5 ký tự.')
    .max(2000, 'Mô tả tối đa 2.000 ký tự.'),
  photo: z.string().startsWith('evidence:v1:', 'Tải ảnh minh chứng trước khi gửi.'),
});
type Fields = z.infer<typeof schema>;

export default function ReportFault({
  slot,
  sellerId,
  compact = false,
  onDone,
}: {
  slot: SellerSlot;
  sellerId: string;
  compact?: boolean;
  onDone?: () => void;
}) {
  const marker = `florabot:fault-unconfirmed:${sellerId}:${slot.id}`;
  const [uncertain, setUncertain] = useState(() => {
    try {
      return sessionStorage.getItem(marker) === '1';
    } catch {
      return false;
    }
  });
  const [editing, setEditing] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [review, setReview] = useState<Fields | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const sending = useRef(false);
  const form = useForm<Fields>({
    resolver: zodResolver(schema),
    defaultValues: { description: '', photo: '' },
  });
  const photoReference = useWatch({ control: form.control, name: 'photo' });
  useEffect(() => {
    if (review) confirmRef.current?.focus();
  }, [review]);
  const markUncertain = (value: boolean) => {
    setUncertain(value);
    try {
      if (value) sessionStorage.setItem(marker, '1');
      else sessionStorage.removeItem(marker);
    } catch {
      /* Retain the in-memory guard when storage is unavailable. */
    }
  };
  const report = useMutation({
    mutationFn: (values: Fields) =>
      request<FlowResult>(`/sellers/${sellerId}/flows/report_device_fault`, {
        p_kiosk: slot.kioskId,
        p_slot: slot.id,
        p_desc: values.description,
        p_photo: values.photo,
      } satisfies ReportDeviceFaultRequest),
    onSuccess: () => {
      markUncertain(false);
      setReview(null);
      setEditing(false);
      form.reset();
      setPreviewFile(null);
      requestAnimationFrame(() => noticeRef.current?.focus());
    },
    onError: (error) => {
      // A lost response may follow a committed report; never retry it automatically.
      if (error instanceof ApiError && [400, 401, 403, 404, 409, 429].includes(error.status))
        markUncertain(false);
      setReview(null);
    },
    onSettled: async () => {
      sending.current = false;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['seller-slots'] }),
        queryClient.invalidateQueries({ queryKey: ['seller-kiosk-slots'] }),
      ]);
    },
  });
  const unavailable = ['FAULT', 'LOCKED'].includes(slot.status);
  const close = () => {
    setEditing(false);
    setReview(null);
    form.reset();
    setPreviewFile(null);
    report.reset();
    requestAnimationFrame(() => startRef.current?.focus());
  };
  const confirm = () => {
    if (!review || sending.current || uncertain || unavailable) return;
    sending.current = true;
    markUncertain(true);
    report.mutate(review);
  };
  const prefix = `fault-${slot.id}`;
  return (
    <div className="fault-report">
      {!compact && !report.isSuccess && <h4>Cần hỗ trợ ô tủ này?</h4>}
      {!review && !report.isSuccess && (
        <p>
          {compact
            ? 'Nếu cửa đang mở, chờ cửa đóng và không tác động vào khóa.'
            : 'Ghi lại tình trạng bạn quan sát được để đội ngũ kiểm tra đúng ô. Nếu cửa đang mở, chờ cửa đóng và không cố tác động vào khóa.'}
        </p>
      )}
      {report.isSuccess ? (
        <div className="fault-result">
          <span className="fault-result-label">Chờ xử lý</span>
          <h4>Đã gửi báo cáo</h4>
          <p ref={noticeRef} tabIndex={-1} role="status">
            Đội vận hành sẽ kiểm tra ô {slot.slotCode} trước khi mở bán lại.
          </p>
          {onDone && (
            <Button type="button" onClick={onDone}>
              Đóng
            </Button>
          )}
        </div>
      ) : uncertain && !report.isPending ? (
        <div role="alert">
          <p>
            Chưa xác nhận được kết quả lần gửi trước. Làm mới danh sách ô và liên hệ đội ngũ để đối
            chiếu trước khi báo lại.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              markUncertain(false);
              report.reset();
            }}
          >
            Đã đối chiếu với đội ngũ
          </Button>
        </div>
      ) : unavailable ? (
        <p>Ô đang có sự cố hoặc đang khóa. Liên hệ đội ngũ để theo dõi xử lý.</p>
      ) : !editing ? (
        <Button
          ref={startRef}
          variant="outline"
          onClick={() => {
            report.reset();
            setEditing(true);
            requestAnimationFrame(() => form.setFocus('description'));
          }}
        >
          {compact ? 'Báo sự cố' : `Báo sự cố ô ${slot.slotCode}`}
        </Button>
      ) : (
        <form noValidate onSubmit={form.handleSubmit((values) => setReview(values))}>
          <div hidden={review !== null}>
            <label htmlFor={`${prefix}-description`}>Tình trạng cần kiểm tra</label>
            <textarea
              id={`${prefix}-description`}
              rows={3}
              maxLength={2000}
              {...form.register('description')}
              aria-invalid={!!form.formState.errors.description}
              aria-describedby={`${prefix}-description-error`}
              disabled={report.isPending}
            />
            <p className="error" id={`${prefix}-description-error`}>
              {form.formState.errors.description?.message}
            </p>
            <Controller
              control={form.control}
              name="photo"
              render={({ field }) => (
                <EvidenceUpload
                  id={`${prefix}-photo`}
                  endpoint={`/api/sellers/${sellerId}/slots/${slot.id}/evidence/report_device_fault`}
                  inputRef={field.ref}
                  onReference={field.onChange}
                  disabled={report.isPending}
                  error={form.formState.errors.photo?.message}
                  autoUpload
                  onFileChange={setPreviewFile}
                  helpText="PNG, JPEG hoặc WebP, tối đa 5 MB. Ảnh chỉ dùng để xử lý sự cố."
                />
              )}
            />
          </div>
          {review && (
            <div className="fault-review">
              <h4>Xác nhận báo cáo</h4>
              <dl className="fault-review-summary">
                <div>
                  <dt>Vị trí</dt>
                  <dd>
                    {slot.kioskName ? `${slot.kioskName} / ` : ''}Ô {slot.slotCode}
                  </dd>
                </div>
                <div>
                  <dt>Tình trạng</dt>
                  <dd className="fault-description">{review.description}</dd>
                </div>
                <div>
                  <dt>Minh chứng</dt>
                  <dd>Ảnh đã lưu{previewFile && <EvidencePreview file={previewFile} />}</dd>
                </div>
              </dl>
              <p className="fault-review-note">
                Gửi báo cáo có thể dừng bán tại ô, hủy lượt thanh toán chưa hoàn tất hoặc tạo yêu
                cầu hoàn tiền cho đơn đang giao.
              </p>
            </div>
          )}
          <div className="stock-actions fault-actions">
            {review ? (
              <>
                <Button
                  ref={confirmRef}
                  type="button"
                  disabled={report.isPending || unavailable}
                  onClick={confirm}
                >
                  {report.isPending ? 'Đang gửi…' : 'Gửi báo cáo'}
                </Button>
                <Button
                  variant="outline"
                  disabled={report.isPending}
                  onClick={() => {
                    setReview(null);
                    requestAnimationFrame(() => form.setFocus('description'));
                  }}
                >
                  Chỉnh sửa
                </Button>
              </>
            ) : (
              <Button type="submit" disabled={!photoReference?.startsWith('evidence:v1:')}>
                Tiếp tục
              </Button>
            )}
            <Button variant="outline" disabled={report.isPending} onClick={close}>
              Hủy
            </Button>
          </div>
        </form>
      )}
      {report.isError && (
        <p role="alert" className="error">
          {report.error instanceof ApiError
            ? report.error.message
            : 'Kết nối bị gián đoạn. Báo cáo có thể đã được ghi nhận.'}
        </p>
      )}
    </div>
  );
}
