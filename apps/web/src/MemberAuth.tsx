import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Button, ArrowRight, Check } from '@florabot/ui';
import AuthShell from './AuthShell';
import { ApiError, queryClient, request, type Session } from './api';

type Mode = 'login' | 'register' | 'forgot' | 'reset';
type Fields = {
  fullName: string;
  email: string;
  password: string;
  confirm: string;
  consent: boolean;
};
export const accountPath = (role: string) =>
  role === 'ADMIN'
    ? '/admin'
    : role === 'STAFF'
      ? '/staff'
      : role === 'SELLER'
        ? '/seller'
        : '/tai-khoan';
export const passwordRule = (value: string) =>
  value.length < 12
    ? 'Dùng ít nhất 12 ký tự cho mật khẩu.'
    : new TextEncoder().encode(value).length <= 72 ||
      'Mật khẩu quá dài. Hãy rút ngắn, nhất là khi dùng nhiều ký tự có dấu.';

export default function MemberAuth({ mode }: { mode: Mode }) {
  const router = useRouter();
  const form = useForm<Fields>();
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const feedback = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [show, setShow] = useState(false);
  const [token, setToken] = useState(
    () => new URLSearchParams(location.hash.slice(1)).get('token') || '',
  );
  const resetForm = form.reset;
  useEffect(() => {
    if (mode === 'reset') {
      history.replaceState(history.state, '', location.pathname + location.search);
      // Opening another recovery link in the same tab can change only the fragment.
      const receiveLink = () => {
        const nextToken = new URLSearchParams(location.hash.slice(1)).get('token');
        if (nextToken === null) return;
        setToken(nextToken);
        setNotice('');
        setError('');
        resetForm();
        history.replaceState(history.state, '', location.pathname + location.search);
      };
      window.addEventListener('hashchange', receiveLink);
      return () => window.removeEventListener('hashchange', receiveLink);
    }
  }, [mode, resetForm]);
  const titles = {
    login: 'Đăng nhập',
    register: 'Tạo tài khoản FloraBot',
    forgot: 'Quên mật khẩu?',
    reset: 'Tạo mật khẩu mới',
  };
  async function submit(values: Fields) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (mode === 'forgot') {
        await request('/auth/forgot-password', { email: values.email.trim() });
        setNotice(
          'Nếu email thuộc tài khoản thành viên, bạn sẽ nhận được liên kết khôi phục. Kiểm tra cả thư rác.',
        );
      } else if (mode === 'reset') {
        await request('/auth/reset-password', { token, newPassword: values.password });
        form.reset();
        setNotice('Đã đổi mật khẩu. Bạn có thể đăng nhập lại.');
      } else {
        const session = await request<Session>(
          mode === 'register' ? '/auth/register' : '/auth/login',
          mode === 'register'
            ? {
                fullName: values.fullName.trim(),
                email: values.email.trim(),
                password: values.password,
              }
            : { email: values.email.trim(), password: values.password },
        );
        form.reset();
        queryClient.clear();
        queryClient.setQueryData(['session'], session);
        router.push(accountPath(session.role));
      }
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Chưa xác nhận được kết quả. Kiểm tra kết nối; nếu vừa đăng ký, hãy thử đăng nhập trước khi gửi lại.',
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    if (error || notice) feedback.current?.focus();
  }, [error, notice]);
  const errors = form.formState.errors;
  const invalidReset = mode === 'reset' && !token;
  const completed = !!notice && (mode === 'reset' || mode === 'forgot');
  return (
    <AuthShell mode={mode}>
      <h1 id="auth-title">{titles[mode]}</h1>
      {mode !== 'login' && (
        <p className="auth-intro">
          {mode === 'register'
            ? 'Đặt hoa và theo dõi đơn của bạn.'
            : mode === 'forgot'
              ? 'Nhập email để nhận liên kết khôi phục.'
              : 'Liên kết dùng một lần, có hiệu lực trong 20 phút.'}
        </p>
      )}
      <div ref={feedback} tabIndex={-1} className="auth-feedback-focus">
        {error && (
          <p role="alert" className="auth-message auth-message-error">
            {error}
          </p>
        )}
        {notice && (
          <div role="status" className="auth-message auth-message-success">
            <Check aria-hidden="true" size={24} />
            <div>
              <strong>
                {mode === 'forgot' ? 'Kiểm tra hộp thư của bạn' : 'Mật khẩu đã được cập nhật'}
              </strong>
              <p>{notice}</p>
            </div>
          </div>
        )}
      </div>
      {invalidReset && (
        <div className="auth-message auth-message-error" role="alert">
          <p>Liên kết chưa đầy đủ. Mở lại liên kết trong email hoặc yêu cầu một liên kết mới.</p>
          <Link href="/quen-mat-khau">Yêu cầu liên kết mới</Link>
        </div>
      )}
      {!invalidReset && !completed && (
        <form
          className="auth-form"
          noValidate
          aria-busy={busy}
          onSubmit={(event) => void form.handleSubmit(submit)(event)}
        >
          {mode === 'register' && (
            <div className="auth-field">
              <label htmlFor="member-name">Họ và tên</label>
              <input
                id="member-name"
                autoComplete="name"
                required
                maxLength={100}
                {...form.register('fullName', {
                  required: 'Nhập họ và tên.',
                  validate: (value) => value.trim().length >= 2 || 'Họ tên cần ít nhất 2 ký tự.',
                })}
                aria-invalid={!!errors.fullName}
                aria-describedby={errors.fullName ? 'member-name-error' : undefined}
              />
              {errors.fullName && (
                <p id="member-name-error" className="auth-field-error">
                  {errors.fullName.message}
                </p>
              )}
            </div>
          )}
          {mode !== 'reset' && (
            <div className="auth-field">
              <label htmlFor="member-email">Email</label>
              <input
                id="member-email"
                type="email"
                inputMode="email"
                autoComplete={mode === 'login' ? 'username' : 'email'}
                autoCapitalize="none"
                spellCheck={false}
                required
                maxLength={254}
                {...form.register('email', {
                  required: 'Nhập email.',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Nhập email hợp lệ.' },
                })}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'member-email-error' : undefined}
              />
              {errors.email && (
                <p id="member-email-error" className="auth-field-error">
                  {errors.email.message}
                </p>
              )}
            </div>
          )}
          {mode !== 'forgot' && (
            <div className="auth-field">
              <div className="auth-field-heading">
                <label htmlFor="member-password">
                  {mode === 'reset' ? 'Mật khẩu mới' : 'Mật khẩu'}
                </label>
                {mode === 'login' && <Link href="/quen-mat-khau">Quên mật khẩu?</Link>}
              </div>
              <div className="auth-password">
                <input
                  id="member-password"
                  type={show ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  {...form.register('password', {
                    required: 'Nhập mật khẩu.',
                    ...(mode !== 'login' ? { validate: passwordRule } : {}),
                  })}
                  aria-invalid={!!errors.password}
                  aria-describedby={
                    [
                      mode !== 'login' ? 'member-password-hint' : '',
                      errors.password ? 'member-password-error' : '',
                    ]
                      .filter(Boolean)
                      .join(' ') || undefined
                  }
                />
                <button
                  type="button"
                  aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  aria-pressed={show}
                  onClick={() => setShow((value) => !value)}
                >
                  {show ? 'Ẩn' : 'Hiện'}
                </button>
              </div>
              {mode !== 'login' && (
                <p id="member-password-hint" className="auth-hint">
                  Dùng ít nhất 12 ký tự. Bạn có thể dùng chữ, số và ký hiệu.
                </p>
              )}
              {errors.password && (
                <p id="member-password-error" className="auth-field-error">
                  {errors.password.message}
                </p>
              )}
            </div>
          )}
          {(mode === 'register' || mode === 'reset') && (
            <div className="auth-field">
              <label htmlFor="member-confirm">Nhập lại mật khẩu</label>
              <input
                id="member-confirm"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                required
                {...form.register('confirm', {
                  required: 'Nhập lại mật khẩu.',
                  validate: (value) =>
                    value === form.getValues('password') || 'Hai mật khẩu chưa khớp.',
                })}
                aria-invalid={!!errors.confirm}
                aria-describedby={errors.confirm ? 'member-confirm-error' : undefined}
              />
              {errors.confirm && (
                <p id="member-confirm-error" className="auth-field-error">
                  {errors.confirm.message}
                </p>
              )}
            </div>
          )}
          {mode === 'register' && (
            <div className="auth-consent">
              <label>
                <input
                  type="checkbox"
                  required
                  {...form.register('consent', {
                    required: 'Vui lòng đọc và xác nhận chính sách riêng tư.',
                  })}
                  aria-invalid={!!errors.consent}
                  aria-describedby={errors.consent ? 'member-consent-error' : undefined}
                />
                <span>
                  Tôi đã đọc{' '}
                  <a href="/chinh-sach-rieng-tu" target="_blank" rel="noreferrer">
                    chính sách riêng tư (mở tab mới)
                  </a>
                  .
                </span>
              </label>
              {errors.consent && (
                <p id="member-consent-error" className="auth-field-error">
                  {errors.consent.message}
                </p>
              )}
            </div>
          )}
          <Button className="auth-submit" type="submit" disabled={busy}>
            {busy
              ? 'Đang xử lý…'
              : mode === 'register'
                ? 'Tạo tài khoản'
                : mode === 'login'
                  ? 'Đăng nhập'
                  : mode === 'forgot'
                    ? 'Gửi liên kết khôi phục'
                    : 'Lưu mật khẩu mới'}
            {!busy && <ArrowRight size={20} aria-hidden="true" />}
          </Button>
          <span className="auth-sr-status" role="status">
            {busy ? 'Đang gửi yêu cầu. Vui lòng chờ.' : ''}
          </span>
        </form>
      )}
      {mode === 'forgot' && notice && (
        <div className="auth-recovery-actions">
          <p>Chưa thấy email? Kiểm tra thư rác hoặc kiểm tra lại địa chỉ email đã nhập.</p>
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              setNotice('');
              setError('');
            }}
          >
            Nhập lại email
          </Button>
        </div>
      )}
      {mode === 'reset' && error && (
        <Link className="auth-back" href="/quen-mat-khau">
          Yêu cầu liên kết mới
        </Link>
      )}
      <div className="auth-alternative">
        {mode === 'login' ? (
          <p>
            Chưa có tài khoản? <Link href="/dang-ky">Đăng ký thành viên</Link>
          </p>
        ) : (
          <Link href="/dang-nhap">
            {mode === 'register' ? 'Đã có tài khoản? Đăng nhập' : 'Quay lại đăng nhập'}
          </Link>
        )}
      </div>
      {mode === 'login' && (
        <p className="auth-staff-link">
          <Link href="/admin/login">Dành cho Admin & nhân viên</Link>
        </p>
      )}
    </AuthShell>
  );
}
