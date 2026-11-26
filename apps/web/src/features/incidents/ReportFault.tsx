import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@florabot/ui';
import { ApiError, queryClient, request } from '@/shared/lib/api';
import EvidenceUpload from '../../shared/components/EvidenceUpload';
import EvidencePreview from '../../shared/components/EvidencePreview';
import { faultReportWait } from './incidents.utils';
import type {
  FlowResult,
  ReportDeviceFaultRequest,
  ReportFaultProps,
  SellerSlot,
} from './incidents.types';

export type { ReportFaultProps };

type TechnicalRepair = {
  id: string;
  kioskId: string;
  slotId: string;
  kioskName: string;
  slotCode: string;
  reason: string;
  expiresAt: string | null;
};

function isRepairApprovalActive(expiresAt: string | null, nowMs: number) {
  if (!expiresAt) return false;
  const time = Date.parse(expiresAt);
  return Number.isFinite(time) && time > nowMs;
}

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
  const isFault = slot.status === 'FAULT';
  const [nowMs, setNowMs] = useState(() => Date.now());
  const repairsQueryKey = ['seller-technical-repairs', sellerId] as const;
  const repairs = useQuery({
    queryKey: repairsQueryKey,
    queryFn: () => request<TechnicalRepair[]>('/me/technical-repairs'),
    enabled: isFault,
    refetchInterval: isFault ? 15_000 : false,
    retry: false,
  });
  useEffect(() => {
    if (!isFault) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, [isFault]);
  const approveRepair = useMutation({
    mutationFn: (id: string) =>
      request<{ expiresAt: string }>(`/me/technical-repairs/${id}/approve`, {}),
    onSuccess: (result, id) => {
      setNowMs(Date.now());
      queryClient.setQueryData<TechnicalRepair[]>(repairsQueryKey, (rows) =>
        rows?.map((row) => (row.id === id ? { ...row, expiresAt: result.expiresAt } : row)),
      );
      void queryClient.invalidateQueries({ queryKey: repairsQueryKey });
    },
  });
  const matchingRepairs = isFault
    ? (repairs.data ?? []).filter((row) => row.slotId === slot.id && row.kioskId === slot.kioskId)
    : [];
  const repairForbidden =
    repairs.isError && repairs.error instanceof ApiError && repairs.error.status === 403;
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
  const reportedAt = slot.faultReportedAt;
  const waiting = reportedAt ? faultReportWait(reportedAt, nowMs) : null;
  const reportTime =
    reportedAt && waiting ? (
      <p className="fault-report-time">
        Gửi lúc{' '}
        <time dateTime={reportedAt}>
          {new Date(reportedAt).toLocaleString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour12: false,
          })}
        </time>
        {' — '}
        {waiting}
      </p>
    ) : null;
  return (
    <div className="fault-report">
      {!compact && !report.isSuccess && !isFault && <h4>Cần hỗ trợ ô tủ này?</h4>}
      {!review && !report.isSuccess && !(isFault && matchingRepairs.length > 0) && (
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
          {reportTime}
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
      ) : isFault ? (
        <div className="fault-repair-approval">
          {reportTime}
          {repairs.isPending && <p role="status">Đang kiểm tra yêu cầu mở ô sửa chữa…</p>}
          {repairs.isError && !repairForbidden && (
            <div role="alert" className="error">
              <p>{repairs.error.message}</p>
              <Button variant="outline" type="button" onClick={() => void repairs.refetch()}>
                Tải lại yêu cầu
              </Button>
            </div>
          )}
          {repairForbidden && (
            <p>
              Ô đang có sự cố. Chủ shop sẽ duyệt quyền mở ô ngay tại đây khi kỹ thuật viên nhận
              việc.
            </p>
          )}
          {!repairs.isPending && !repairs.isError && matchingRepairs.length === 0 && (
            <p>
              Ô đang có sự cố. Sau khi kỹ thuật viên nhận việc và gửi yêu cầu, nút duyệt quyền mở ô
              sẽ hiển thị ngay tại đây.
            </p>
          )}
          {matchingRepairs.map((repair) => {
            const approved = isRepairApprovalActive(repair.expiresAt, nowMs);
            return (
              <div key={repair.id} className="stock-maintenance-progress">
                <strong>Yêu cầu mở ô sửa chữa · Ô {repair.slotCode}</strong>
                <p>{repair.reason}</p>
                {approved && repair.expiresAt ? (
                  <p role="status">
                    Đã duyệt quyền mở ô đến{' '}
                    {new Date(repair.expiresAt).toLocaleString('vi-VN', {
                      timeZone: 'Asia/Ho_Chi_Minh',
                      hour12: false,
                    })}
                    . Kỹ thuật viên có thể lấy OTP để mở ô.
                  </p>
                ) : (
                  <>
                    <p>
                      Kỹ thuật viên đã nhận việc sửa ô này. Duyệt quyền mở ô để kỹ thuật viên lấy
                      OTP kiểm tra và sửa chữa.
                    </p>
                    <Button
                      type="button"
                      disabled={approveRepair.isPending}
                      onClick={() => approveRepair.mutate(repair.id)}
                    >
                      {approveRepair.isPending && approveRepair.variables === repair.id
                        ? 'Đang duyệt…'
                        : 'Duyệt quyền mở ô'}
                    </Button>
                  </>
                )}
                {approveRepair.isError && approveRepair.variables === repair.id && (
                  <p role="alert" className="error">
                    {approveRepair.error.message}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : unavailable ? (
        <p>Ô đang khóa hoặc đang trong phiên thao tác. Liên hệ đội ngũ để theo dõi xử lý.</p>
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
