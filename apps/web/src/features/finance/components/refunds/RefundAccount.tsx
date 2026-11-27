import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useController, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Banknote, Button, ShieldCheck } from '@florabot/ui';
import { VietnamBankSelect } from '@/shared/components/VietnamBankSelect';
import type { SubmitRefundInfoRequest } from '../../finance.types';

const plainText = z
  .string()
  .trim()
  .min(1, 'Nhập tên ngân hàng.')
  .max(120, 'Tối đa 120 ký tự.')
  .refine(
    (value) => !Array.from(value).some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127),
    'Không nhập ký tự xuống dòng hoặc điều khiển.',
  );
const schema = z.object({
  bank: plainText,
  holder: z
    .string()
    .trim()
    .min(2, 'Nhập tên chủ tài khoản từ 2 ký tự.')
    .max(120, 'Tối đa 120 ký tự.')
    .regex(/^[A-Za-zÀ-ỹ ]+$/, 'Tên chủ tài khoản chỉ gồm chữ cái và khoảng trắng.'),
  account: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{4,34}$/, 'Nhập 4–34 chữ cái hoặc chữ số, giữ nguyên số 0 ở đầu.'),
});
type Fields = z.infer<typeof schema>;
const empty: Fields = { bank: '', holder: '', account: '' };
const formatVnd = (amount: number | string) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(amount));

export default function RefundAccount({
  orderId,
  trackingToken,
  provided,
  pendingAmount,
  onSaved,
}: {
  orderId: string;
  trackingToken: string;
  provided: boolean;
  pendingAmount?: number | string;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(!provided);
  const [review, setReview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const form = useForm<Fields>({ resolver: zodResolver(schema), defaultValues: empty });
  const { field: bankField } = useController({ name: 'bank', control: form.control });
  const controller = useRef<AbortController | null>(null);
  const sending = useRef(false);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useLayoutEffect(() => {
    if (review) reviewHeading.current?.focus();
    else if (editing) form.setFocus('bank');
    else if (notice) editButton.current?.focus();
  }, [editing, review, notice, form]);

  async function save(values: Fields) {
    if (sending.current || uncertain) return;
    sending.current = true;
    setSaving(true);
    setError('');
    const active = new AbortController();
    controller.current = active;
    const body: SubmitRefundInfoRequest = {
      p_order: orderId,
      p_tracking: trackingToken,
      p_bank: values.bank,
      p_account_enc: values.account,
      p_holder: values.holder,
    };
    try {
      // Account data stays outside query caches and automatic retries.
      const response = await fetch('/api/receipts/flows/submit_refund_info', {
        method: 'POST',
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.any([active.signal, AbortSignal.timeout(15_000)]),
      });
      if (active.signal.aborted) return;
      if (!response.ok) {
        if (response.status >= 500) throw new Error('unknown-outcome');
        setError(
          response.status === 404
            ? 'Hai mã biên nhận không còn khớp. Tra cứu lại đơn trước khi gửi.'
            : response.status === 429
              ? 'Bạn thao tác hơi nhanh. Hãy thử lại sau một phút.'
              : response.status === 409
                ? 'Trạng thái khoản hoàn đã thay đổi. Chọn “Cập nhật trạng thái” để cập nhật trước khi gửi lại.'
                : 'Thông tin chưa hợp lệ. Kiểm tra lại ngân hàng, số tài khoản và tên chủ tài khoản.',
        );
        setReview(false);
        return;
      }
      form.reset(empty);
      setEditing(false);
      setReview(false);
      setNotice(
        'Đã gửi tài khoản nhận hoàn. Đội ngũ sẽ xử lý khoản hoàn bằng chuyển khoản; thao tác này chưa có nghĩa là tiền đã được chuyển.',
      );
      onSaved();
    } catch {
      if (!active.signal.aborted) {
        form.reset(empty);
        setReview(false);
        setEditing(false);
        setUncertain(true);
        setError(
          'Chưa xác nhận được kết quả gửi. Chọn “Cập nhật trạng thái” để kiểm tra trạng thái trước khi nhập lại; thông tin vừa gửi có thể đã được lưu.',
        );
      }
    } finally {
      sending.current = false;
      if (!active.signal.aborted) setSaving(false);
    }
  }

  return (
    <section className="refund-account" aria-labelledby="refund-account-heading">
      <header className="refund-account-header">
        <div className="refund-account-title">
          <span className="refund-account-icon" aria-hidden="true">
            <Banknote size={18} />
          </span>
          <div>
            <h3 id="refund-account-heading">Tài khoản nhận hoàn</h3>
            <p className="refund-status-text">
              {provided
                ? 'Đã nhận thông tin tài khoản hoàn tiền. Khoản hoàn đang chờ được xử lý.'
                : 'Khoản hoàn đang chờ thông tin tài khoản nhận tiền.'}
            </p>
          </div>
        </div>
        {pendingAmount !== undefined && Number(pendingAmount) > 0 && (
          <span className="refund-amount-badge" data-provided={provided || undefined}>
            {formatVnd(pendingAmount)}
          </span>
        )}
      </header>
      <p className="refund-security-note">
        <ShieldCheck size={15} aria-hidden="true" />
        <span>Thông tin được mã hóa khi lưu và tự xóa sau khi chi hết khoản hoàn.</span>
      </p>
      {!editing && !uncertain && (
        <div className="refund-collapsed-action">
          <Button
            ref={editButton}
            variant="outline"
            onClick={() => {
              form.reset(empty);
              setEditing(true);
              setError('');
              setNotice('');
            }}
          >
            {provided ? 'Đổi tài khoản nhận hoàn' : 'Nhập tài khoản nhận hoàn'}
          </Button>
        </div>
      )}
      {editing && (
        <form
          noValidate
          aria-label="Tài khoản nhận hoàn"
          onSubmit={(event) => {
            event.preventDefault();
            if (review) void form.handleSubmit(save)(event);
            else
              void form.handleSubmit(() => {
                setReview(true);
                setError('');
              })(event);
          }}
        >
          <div className="refund-form-grid" hidden={review}>
            {provided && (
              <p className="quiet refund-replace-note">
                Thông tin mới sẽ thay thế tài khoản đã gửi trước đó.
              </p>
            )}
            <div className="refund-field refund-field-full">
              <label htmlFor="refund-bank">Tên ngân hàng</label>
              <VietnamBankSelect
                id="refund-bank"
                inputRef={bankField.ref}
                value={bankField.value}
                onValueChange={bankField.onChange}
                onBlur={bankField.onBlur}
                invalid={!!form.formState.errors.bank}
                describedBy="refund-bank-error"
                disabled={saving}
                required
              />
              <p id="refund-bank-error" className="error">
                {form.formState.errors.bank?.message}
              </p>
            </div>
            <div className="refund-field">
              <label htmlFor="refund-holder">Tên chủ tài khoản</label>
              <input
                id="refund-holder"
                autoComplete="off"
                maxLength={120}
                placeholder="VD: NGUYEN VAN A"
                {...form.register('holder')}
                aria-invalid={!!form.formState.errors.holder}
                aria-describedby="refund-holder-error"
                readOnly={saving}
              />
              <p id="refund-holder-error" className="error">
                {form.formState.errors.holder?.message}
              </p>
            </div>
            <div className="refund-field">
              <label htmlFor="refund-account">Số tài khoản ngân hàng</label>
              <input
                id="refund-account"
                autoComplete="off"
                spellCheck={false}
                maxLength={34}
                placeholder="Nhập số tài khoản"
                {...form.register('account')}
                aria-invalid={!!form.formState.errors.account}
                aria-describedby="refund-account-help refund-account-error"
                readOnly={saving}
              />
              <p id="refund-account-help" className="quiet">
                Giữ số 0 ở đầu. Không nhập số thẻ, PIN hay OTP.
              </p>
              <p id="refund-account-error" className="error">
                {form.formState.errors.account?.message}
              </p>
            </div>
          </div>
          {review && (
            <div className="refund-review">
              <h4 ref={reviewHeading} tabIndex={-1}>
                Kiểm tra trước khi gửi
              </h4>
              <div className="refund-review-box">
                <p className="refund-review-primary">
                  {form.getValues('bank')} · {form.getValues('holder')}
                </p>
                <p className="refund-review-masked">
                  Số tài khoản đã che, kết thúc bằng{' '}
                  {form.getValues('account').slice(form.getValues('account').length > 4 ? -4 : -2)}.
                </p>
              </div>
              <p className="refund-review-note">
                Đối chiếu thông tin với ứng dụng ngân hàng của bạn. FloraBot chưa xác minh chủ tài
                khoản với ngân hàng.
              </p>
            </div>
          )}
          <div className="receipt-actions">
            <Button type="submit" disabled={saving}>
              {saving ? 'Đang gửi…' : review ? 'Xác nhận gửi tài khoản' : 'Kiểm tra tài khoản'}
            </Button>
            {review && (
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setReview(false)}
              >
                Sửa thông tin
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => {
                form.reset(empty);
                setEditing(false);
                setReview(false);
                setError('');
                setNotice('Đã xóa thông tin vừa nhập trên trang.');
              }}
            >
              Hủy nhập
            </Button>
          </div>
        </form>
      )}
      <p role="alert" className="error">
        {error}
      </p>
      <p role="status" className="refund-notice">
        {notice}
      </p>
    </section>
  );
}
