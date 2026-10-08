import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@florabot/ui';
import type { components } from '../../../packages/contracts/src/generated/api';
import { ApiError, queryClient, request, type Session } from './api';

type Bank = components['schemas']['SellerBankResponse'];
const text = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Nhập ${label.toLowerCase()}.`)
    .max(120, `${label} tối đa 120 ký tự.`)
    .refine(
      (value) =>
        !Array.from(value).some(
          (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
        ),
      'Không dùng ký tự xuống dòng hoặc điều khiển.',
    );
const schema = z.object({
  bank: text('Tên ngân hàng'),
  holder: text('Tên chủ tài khoản'),
  account: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{4,34}$/, 'Nhập 4–34 chữ cái hoặc chữ số, không có khoảng trắng.'),
});
type Fields = z.infer<typeof schema>;
const empty: Fields = { bank: '', holder: '', account: '' };

export default function BankDetails({ session }: { session: Session }) {
  const base = `/sellers/${session.sellerId}`;
  const key = ['seller-bank', session.sellerId];
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [review, setReview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const sending = useRef(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const bank = useQuery({
    queryKey: key,
    queryFn: () => request<Bank>(`${base}/bank`),
    enabled: open,
  });
  const form = useForm<Fields>({ resolver: zodResolver(schema), defaultValues: empty });
  useLayoutEffect(() => {
    if (editing) form.setFocus('bank');
  }, [editing, form]);
  useEffect(() => {
    if (review) confirmRef.current?.focus();
  }, [review]);
  const edit = () => {
    form.reset({ bank: bank.data?.bankName ?? '', holder: bank.data?.holder ?? '', account: '' });
    setNotice('');
    setError('');
    setReview(false);
    setEditing(true);
  };
  const cancel = () => {
    form.reset(empty);
    setReview(false);
    setEditing(false);
    setError('');
    requestAnimationFrame(() => editRef.current?.focus());
  };
  const save = async (values: Fields) => {
    if (sending.current) return;
    sending.current = true;
    setSaving(true);
    setError('');
    try {
      // Keep raw account input out of TanStack mutation variables/cache and browser storage.
      await request(`${base}/flows/set_seller_bank`, {
        p_bank: values.bank,
        p_holder: values.holder,
        p_account_enc: values.account,
      });
      form.reset(empty);
      setEditing(false);
      setReview(false);
      setNotice(
        'Đã lưu tài khoản nhận tiền. Thông tin mới áp dụng cho các yêu cầu rút gửi từ bây giờ.',
      );
      requestAnimationFrame(() => editRef.current?.focus());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: key }),
        queryClient.invalidateQueries({ queryKey: ['wallet', session.sellerId] }),
      ]);
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? failure.message
          : 'Chưa xác nhận được kết quả lưu. Cập nhật thông tin để kiểm tra trước khi thử lại.',
      );
      setReview(false);
    } finally {
      sending.current = false;
      setSaving(false);
    }
  };
  return (
    <details className="bank-details" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Tài khoản nhận tiền</summary>
      {open && (
        <div className="bank-content">
          <p>
            Thông tin dùng để chuyển tiền bán hoa về shop. Vui lòng đối chiếu với ứng dụng ngân hàng
            của bạn.
          </p>
          {bank.isPending ? (
            <p role="status">Đang tải thông tin tài khoản…</p>
          ) : bank.isError ? (
            <>
              <p role="alert" className="error">
                Chưa tải được thông tin tài khoản.
              </p>
              <Button variant="outline" onClick={() => void bank.refetch()}>
                Tải lại thông tin tài khoản
              </Button>
            </>
          ) : (
            <>
              {bank.data.status === 'READY' ? (
                <dl className="bank-summary">
                  <div>
                    <dt>Ngân hàng</dt>
                    <dd>{bank.data.bankName}</dd>
                  </div>
                  <div>
                    <dt>Chủ tài khoản</dt>
                    <dd>{bank.data.holder}</dd>
                  </div>
                  <div>
                    <dt>Số tài khoản</dt>
                    <dd>Đã che, kết thúc bằng {bank.data.accountSuffix}</dd>
                  </div>
                </dl>
              ) : (
                <p>
                  {bank.data.status === 'MISSING'
                    ? 'Shop chưa khai báo tài khoản nhận tiền.'
                    : 'Thông tin tài khoản cũ chưa thể sử dụng để đối chiếu. Hãy nhập lại đầy đủ thông tin.'}
                </p>
              )}
              <p className="quiet">
                Đổi tài khoản không thay đổi nơi nhận tiền của các yêu cầu rút đã gửi. Nếu yêu cầu
                cũ có thông tin sai, liên hệ đội ngũ trước khi được chi trả.
              </p>
              {!editing ? (
                <Button ref={editRef} variant="outline" onClick={edit}>
                  {bank.data.status === 'READY'
                    ? 'Đổi tài khoản nhận tiền'
                    : 'Khai báo tài khoản nhận tiền'}
                </Button>
              ) : (
                <form
                  noValidate
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (review) void form.handleSubmit(save)(event);
                    else
                      void form.handleSubmit(() => {
                        setError('');
                        setReview(true);
                      })(event);
                  }}
                >
                  <div hidden={review}>
                    <label htmlFor="bank-name">Tên ngân hàng</label>
                    <input
                      id="bank-name"
                      autoComplete="off"
                      maxLength={120}
                      {...form.register('bank')}
                      aria-invalid={!!form.formState.errors.bank}
                      aria-describedby="bank-name-error"
                      disabled={saving}
                    />
                    <p id="bank-name-error" className="error">
                      {form.formState.errors.bank?.message}
                    </p>
                    <label htmlFor="bank-holder">Tên chủ tài khoản</label>
                    <input
                      id="bank-holder"
                      autoComplete="off"
                      maxLength={120}
                      {...form.register('holder')}
                      aria-invalid={!!form.formState.errors.holder}
                      aria-describedby="bank-holder-error"
                      disabled={saving}
                    />
                    <p id="bank-holder-error" className="error">
                      {form.formState.errors.holder?.message}
                    </p>
                    <label htmlFor="bank-account">Số tài khoản ngân hàng</label>
                    <input
                      id="bank-account"
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={34}
                      {...form.register('account')}
                      aria-invalid={!!form.formState.errors.account}
                      aria-describedby="bank-account-help bank-account-error"
                      disabled={saving}
                    />
                    <p id="bank-account-help" className="quiet">
                      Nhập đúng cả số 0 ở đầu. Không nhập số thẻ hoặc mã PIN.
                    </p>
                    <p id="bank-account-error" className="error">
                      {form.formState.errors.account?.message}
                    </p>
                  </div>
                  {review && (
                    <div>
                      <h4>Kiểm tra tài khoản nhận tiền</h4>
                      <p>
                        <strong>{form.getValues('bank')}</strong> · {form.getValues('holder')}
                      </p>
                      <p>
                        Số tài khoản đã che, kết thúc bằng{' '}
                        {form
                          .getValues('account')
                          .slice(form.getValues('account').length > 4 ? -4 : -2)}
                        .
                      </p>
                      <p className="quiet">
                        FloraBot chưa xác minh thông tin này với ngân hàng. Bạn cần kiểm tra chính
                        xác trước khi lưu.
                      </p>
                    </div>
                  )}
                  <div className="wallet-buttons">
                    <Button ref={confirmRef} type="submit" disabled={saving}>
                      {saving
                        ? 'Đang lưu tài khoản…'
                        : review
                          ? 'Xác nhận lưu tài khoản'
                          : 'Kiểm tra thông tin tài khoản'}
                    </Button>
                    {review && (
                      <Button
                        variant="outline"
                        disabled={saving}
                        onClick={() => {
                          setReview(false);
                          requestAnimationFrame(() => form.setFocus('account'));
                        }}
                      >
                        Sửa thông tin
                      </Button>
                    )}
                    <Button variant="outline" disabled={saving} onClick={cancel}>
                      Hủy thay đổi
                    </Button>
                  </div>
                </form>
              )}
            </>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <p role="status">{notice}</p>
          <Button
            variant="outline"
            disabled={bank.isFetching || saving}
            onClick={() => void bank.refetch()}
          >
            Cập nhật thông tin tài khoản
          </Button>
        </div>
      )}
    </details>
  );
}
