import bouquet from '../../../packages/ui/assets/flowers/pastelBouquet-960.webp';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Button } from '@florabot/ui';
import { ApiError, queryClient, request, type Session } from './api';

type Mode = 'login' | 'register' | 'forgot' | 'reset';
type Fields = {
  fullName: string;
  email: string;
  password: string;
  confirm: string;
  consent: boolean;
};
export const memberHome = '/';
export const accountPath = (role: string) =>
  role === 'ADMIN'
    ? '/admin'
    : role === 'STAFF'
      ? '/staff'
      : role === 'SELLER'
        ? '/seller'
        : '/tai-khoan';
export const passwordRule = (value: string) =>
  (value.length >= 12 && new TextEncoder().encode(value).length <= 72) ||
  'Dùng ít nhất 12 ký tự, tối đa 72 byte UTF-8.';

export default function MemberAuth({ mode }: { mode: Mode }) {
  const router = useRouter();
  const form = useForm<Fields>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [show, setShow] = useState(false);
  const [token] = useState(() => new URLSearchParams(location.hash.slice(1)).get('token') || '');
  useEffect(() => {
    if (mode === 'reset') {
      history.replaceState(null, '', location.pathname);
    }
  }, [mode]);
  const titles = {
    login: 'Chào bạn, hoa đang đợi.',
    register: 'Một tài khoản, nhiều dịp gửi thương.',
    forgot: 'Lấy lại mật khẩu',
    reset: 'Tạo mật khẩu mới',
  };
  async function submit(values: Fields) {
    if (busy) return;
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
      setBusy(false);
    }
  }
  return (
    <main id="main" className="member-auth">
      <section className="member-auth-story">
        <a className="portal-brand" href={memberHome}>
          FloraBot
        </a>
        <img
          src={bouquet}
          alt=""
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
        <p>
          Chọn hoa cho hôm nay.
          <br />
          Chuẩn bị một bất ngờ cho ngày mai.
        </p>
        <a href={memberHome}>Trở về trang chủ</a>
      </section>
      <section className="member-auth-form">
        <h1>{titles[mode]}</h1>
        <p>
          {mode === 'register'
            ? 'Lưu thông tin, theo dõi đơn và trao đổi yêu cầu đặt hoa với shop.'
            : mode === 'login'
              ? 'Đăng nhập để tiếp tục với những bó hoa bạn yêu thích.'
              : 'Liên kết khôi phục chỉ dùng một lần và có hiệu lực trong 20 phút.'}
        </p>
        <form noValidate onSubmit={form.handleSubmit(submit)}>
          {mode === 'register' && (
            <>
              <label htmlFor="member-name">Họ và tên</label>
              <input
                id="member-name"
                autoComplete="name"
                maxLength={100}
                {...form.register('fullName', {
                  required: 'Nhập họ và tên.',
                  validate: (value) => value.trim().length >= 2 || 'Họ tên cần ít nhất 2 ký tự.',
                })}
                aria-invalid={!!form.formState.errors.fullName}
                aria-describedby="member-name-error"
              />
              <p id="member-name-error" className="error">
                {form.formState.errors.fullName?.message}
              </p>
            </>
          )}
          {mode !== 'reset' && (
            <>
              <label htmlFor="member-email">Email</label>
              <input
                id="member-email"
                type="email"
                autoComplete="email"
                maxLength={254}
                {...form.register('email', {
                  required: 'Nhập email.',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Nhập email hợp lệ.' },
                })}
                aria-invalid={!!form.formState.errors.email}
                aria-describedby="member-email-error"
              />
              <p id="member-email-error" className="error">
                {form.formState.errors.email?.message}
              </p>
            </>
          )}
          {mode !== 'forgot' && (
            <>
              <label htmlFor="member-password">
                {mode === 'reset' ? 'Mật khẩu mới' : 'Mật khẩu'}
              </label>
              <input
                id="member-password"
                type={show ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                {...form.register('password', {
                  required: 'Nhập mật khẩu.',
                  ...(mode !== 'login' ? { validate: passwordRule } : {}),
                })}
                aria-invalid={!!form.formState.errors.password}
                aria-describedby="member-password-error"
              />
              <p id="member-password-error" className="error">
                {form.formState.errors.password?.message}
              </p>
              <button
                className="member-text-button"
                type="button"
                aria-pressed={show}
                onClick={() => setShow((value) => !value)}
              >
                {show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              </button>
            </>
          )}
          {(mode === 'register' || mode === 'reset') && (
            <>
              <label htmlFor="member-confirm">Nhập lại mật khẩu</label>
              <input
                id="member-confirm"
                type="password"
                autoComplete="new-password"
                {...form.register('confirm', {
                  validate: (value) =>
                    value === form.getValues('password') || 'Hai mật khẩu chưa khớp.',
                })}
                aria-invalid={!!form.formState.errors.confirm}
                aria-describedby="member-confirm-error"
              />
              <p id="member-confirm-error" className="error">
                {form.formState.errors.confirm?.message}
              </p>
            </>
          )}
          {mode === 'register' && (
            <>
              <label className="payout-checkbox">
                <input
                  type="checkbox"
                  {...form.register('consent', {
                    required: 'Vui lòng đọc và xác nhận chính sách riêng tư.',
                  })}
                  aria-describedby="member-consent-error"
                />
                <span>
                  Tôi đã đọc{' '}
                  <a
                    href={`${memberHome.replace(/\/$/, '')}/chinh-sach-rieng-tu`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    chính sách riêng tư (mở tab mới)
                  </a>
                  .
                </span>
              </label>
              <p id="member-consent-error" className="error">
                {form.formState.errors.consent?.message}
              </p>
            </>
          )}
          <p role="alert" className="error">
            {error}
          </p>
          <p role="status">{notice}</p>
          {!(mode === 'reset' && notice) && (
            <Button type="submit" disabled={busy || (mode === 'reset' && !token)}>
              {busy
                ? 'Đang xử lý…'
                : mode === 'register'
                  ? 'Tạo tài khoản'
                  : mode === 'login'
                    ? 'Đăng nhập'
                    : mode === 'forgot'
                      ? 'Gửi liên kết khôi phục'
                      : 'Lưu mật khẩu mới'}
            </Button>
          )}
          {mode === 'reset' && !token && (
            <p className="error">Mở liên kết đầy đủ trong email hoặc yêu cầu liên kết mới.</p>
          )}
        </form>
        {mode === 'login' ? (
          <div className="member-auth-links">
            <Link href="/quen-mat-khau">Quên mật khẩu?</Link>
            <p>
              Chưa có tài khoản? <Link href="/dang-ky">Đăng ký thành viên</Link>
            </p>
            <Link href="/admin/login">Đăng nhập dành cho nhân viên FloraBot</Link>
          </div>
        ) : (
          <p>
            Đã có tài khoản? <Link href="/dang-nhap">Đăng nhập</Link>
          </p>
        )}
      </section>
    </main>
  );
}
