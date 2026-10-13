import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Button, ArrowRight, Check } from '@florabot/ui';
import AuthShell from './AuthShell';
import {
  ApiError,
  queryClient,
  request,
  type Session,
  type AuthConfig,
  type RegisterPendingResponse,
} from './api';
import type { GoogleCredentialResponse } from './google-identity';

type Mode = 'login' | 'register' | 'forgot' | 'reset';
type Fields = {
  fullName: string;
  email: string;
  password: string;
  confirm: string;
  consent: boolean;
};

interface PendingRegistration {
  challengeId: string;
  email: string;
  fullName: string;
  password: string;
  expiresAt: number;
  resendAvailableAt: number;
  message?: string;
}

type GisStatus = 'loading' | 'ready' | 'unavailable' | 'error' | 'slow_load_error';

export const accountPath = (role: string) => {
  switch (role) {
    case 'ADMIN':
      return '/admin';
    case 'OPERATIONS_MANAGER':
      return '/operations';
    case 'TECHNICIAN':
      return '/technician';
    case 'SELLER':
      return '/seller';
    case 'SELLER_STAFF':
      return '/staff';
    case 'CUSTOMER':
      return '/tai-khoan';
    case 'STAFF':
    default:
      return '/workspace';
  }
};

export const passwordRule = (value: string) =>
  value.length < 12
    ? 'Dùng ít nhất 12 ký tự cho mật khẩu.'
    : new TextEncoder().encode(value).length <= 72 ||
      'Mật khẩu quá dài. Hãy rút ngắn, nhất là khi dùng nhiều ký tự có dấu.';

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" className="auth-google-icon">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export default function MemberAuth({ mode }: { mode: Mode }) {
  const router = useRouter();
  const form = useForm<Fields>();
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const mountedRef = useRef(true);
  const feedback = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [show, setShow] = useState(false);
  const [token, setToken] = useState(
    () => new URLSearchParams(location.hash.slice(1)).get('token') || '',
  );

  // Runtime backend configuration
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const [configError, setConfigError] = useState(false);
  const [configLoading, setConfigLoading] = useState(() => mode === 'login' || mode === 'register');
  const [gisStatus, setGisStatus] = useState<GisStatus>('loading');
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);
  const gisInitializedRef = useRef(false);
  const gisRenderedRef = useRef(false);

  // OTP Pending Challenge state
  const [pendingChallenge, setPendingChallenge] = useState<PendingRegistration | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [expirySeconds, setExpirySeconds] = useState(600);
  const [resendCooldown, setResendCooldown] = useState(60);
  const otpInputRef = useRef<HTMLInputElement>(null);

  const resetForm = form.reset;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (mode === 'reset') {
      history.replaceState(history.state, '', location.pathname + location.search);
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

  // Fetch runtime auth config from backend without manufacturing enabled state on failure
  const retryFetchConfig = useCallback(() => {
    setConfigLoading(true);
    setConfigError(false);
    request<AuthConfig>('/auth/config')
      .then((cfg) => {
        if (!mountedRef.current) return;
        setAuthConfig(cfg);
        setConfigLoading(false);
        if (!cfg.googleEnabled || !cfg.googleClientId) {
          setGisStatus('unavailable');
        } else {
          setGisStatus('loading');
        }
      })
      .catch(() => {
        if (!mountedRef.current) return;
        setAuthConfig(null);
        setConfigError(true);
        setConfigLoading(false);
        setGisStatus('unavailable');
      });
  }, []);

  useEffect(() => {
    if (mode !== 'login' && mode !== 'register') {
      return;
    }
    let active = true;
    request<AuthConfig>('/auth/config')
      .then((cfg) => {
        if (!active) return;
        setAuthConfig(cfg);
        setConfigLoading(false);
        if (!cfg.googleEnabled || !cfg.googleClientId) {
          setGisStatus('unavailable');
        } else {
          setGisStatus('loading');
        }
      })
      .catch(() => {
        if (!active) return;
        setAuthConfig(null);
        setConfigError(true);
        setConfigLoading(false);
        setGisStatus('unavailable');
      });
    return () => {
      active = false;
    };
  }, [mode]);

  const measureButtonWidth = useCallback((): number => {
    if (googleBtnContainerRef.current) {
      const rect = googleBtnContainerRef.current.getBoundingClientRect();
      if (rect.width > 0) {
        return Math.max(200, Math.min(320, Math.floor(rect.width)));
      }
    }
    if (typeof window !== 'undefined') {
      const available = window.innerWidth <= 380 ? window.innerWidth - 64 : 320;
      return Math.max(200, Math.min(320, available));
    }
    return 240;
  }, []);

  const handleGoogleCredential = useCallback(
    async (idToken: string) => {
      if (submitting.current || !mountedRef.current) return;
      if (!idToken) return;
      submitting.current = true;
      setBusy(true);
      setError('');
      setNotice('');
      try {
        const session = await request<Session>('/auth/google', { idToken });
        if (!mountedRef.current) return;
        form.reset();
        queryClient.clear();
        queryClient.setQueryData(['session'], session);
        router.push(accountPath(session.role));
      } catch (cause) {
        if (!mountedRef.current) return;
        setError(
          cause instanceof ApiError
            ? cause.message
            : 'Không thể đăng nhập bằng Google lúc này. Vui lòng thử lại sau.',
        );
      } finally {
        if (mountedRef.current) {
          submitting.current = false;
          setBusy(false);
        }
      }
    },
    [form, router],
  );

  // Initialize and render Google Identity Services
  useEffect(() => {
    let effectActive = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let ownedScript: HTMLScriptElement | null = null;
    let existingScript: HTMLScriptElement | null = null;

    if (mode !== 'login' && mode !== 'register') return;
    if (pendingChallenge) return;
    if (!authConfig) return;
    if (!authConfig.googleEnabled || !authConfig.googleClientId) {
      return;
    }

    const clientId = authConfig.googleClientId;

    const tryInitAndRender = (): boolean => {
      if (!effectActive || !mountedRef.current) return false;
      if (!window.google?.accounts?.id) return false;
      try {
        if (!gisInitializedRef.current) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: (response: GoogleCredentialResponse) => {
              if (!mountedRef.current) return;
              if (response?.credential) {
                void handleGoogleCredential(response.credential);
              }
            },
          });
          gisInitializedRef.current = true;
        }

        if (googleBtnContainerRef.current) {
          googleBtnContainerRef.current.innerHTML = '';
          const targetWidth = measureButtonWidth();
          window.google.accounts.id.renderButton(googleBtnContainerRef.current, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text: mode === 'register' ? 'signup_with' : 'signin_with',
            shape: 'rectangular',
            width: targetWidth,
            locale: 'vi',
          });
          gisRenderedRef.current = true;
          if (effectActive && mountedRef.current) {
            setGisStatus('ready');
          }
          return true;
        }
      } catch {
        if (effectActive && mountedRef.current) {
          setGisStatus('error');
        }
      }
      return false;
    };

    if (window.google?.accounts?.id) {
      tryInitAndRender();
      return () => {
        effectActive = false;
      };
    }

    const scriptSrc = 'https://accounts.google.com/gsi/client';
    existingScript = document.querySelector<HTMLScriptElement>(`script[src="${scriptSrc}"]`);

    const timeoutId = setTimeout(() => {
      if (effectActive && mountedRef.current && !window.google?.accounts?.id) {
        setGisStatus('slow_load_error');
      }
    }, 10_000);

    const handleLoad = () => {
      clearTimeout(timeoutId);
      if (!effectActive || !mountedRef.current) return;
      if (!tryInitAndRender()) {
        retryTimer = setTimeout(() => {
          if (effectActive && mountedRef.current && !tryInitAndRender()) {
            setGisStatus('error');
          }
        }, 150);
      }
    };

    const handleError = () => {
      clearTimeout(timeoutId);
      if (effectActive && mountedRef.current) {
        setGisStatus('error');
      }
    };

    if (existingScript) {
      existingScript.addEventListener('load', handleLoad);
      existingScript.addEventListener('error', handleError);
    } else {
      ownedScript = document.createElement('script');
      ownedScript.src = scriptSrc;
      ownedScript.async = true;
      ownedScript.defer = true;
      ownedScript.setAttribute('data-florabot-gis', 'true');
      ownedScript.addEventListener('load', handleLoad);
      ownedScript.addEventListener('error', handleError);
      document.head.appendChild(ownedScript);
    }

    return () => {
      effectActive = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (retryTimer) clearTimeout(retryTimer);
      if (existingScript) {
        existingScript.removeEventListener('load', handleLoad);
        existingScript.removeEventListener('error', handleError);
      }
      if (ownedScript) {
        ownedScript.removeEventListener('load', handleLoad);
        ownedScript.removeEventListener('error', handleError);
        if (!window.google?.accounts?.id && document.head.contains(ownedScript)) {
          document.head.removeChild(ownedScript);
        }
      }
    };
  }, [authConfig, handleGoogleCredential, measureButtonWidth, mode, pendingChallenge]);

  // Expiry and resend countdown timers for pending registration
  useEffect(() => {
    if (!pendingChallenge) return;

    const update = () => {
      const now = Date.now();
      const exp = Math.max(0, Math.ceil((pendingChallenge.expiresAt - now) / 1000));
      const res = Math.max(0, Math.ceil((pendingChallenge.resendAvailableAt - now) / 1000));
      setExpirySeconds(exp);
      setResendCooldown(res);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [pendingChallenge]);

  // Focus OTP input when entering verification step
  useEffect(() => {
    if (pendingChallenge) {
      otpInputRef.current?.focus();
    }
  }, [pendingChallenge]);

  // Focus error / notice feedback
  useEffect(() => {
    if (error || notice) {
      feedback.current?.focus();
    }
  }, [error, notice]);

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
      } else if (mode === 'register') {
        if (authConfig !== null && !authConfig.registrationEmailEnabled) {
          setError('Chức năng đăng ký tài khoản qua email hiện đang tạm tắt.');
          return;
        }
        const res = await request<RegisterPendingResponse>('/auth/register', {
          fullName: values.fullName.trim(),
          email: values.email.trim(),
          password: values.password,
        });
        setPendingChallenge({
          challengeId: res.challengeId,
          email: values.email.trim(),
          fullName: values.fullName.trim(),
          password: values.password,
          expiresAt: Date.now() + (res.expiresInSeconds || 600) * 1000,
          resendAvailableAt: Date.now() + (res.resendAfterSeconds || 60) * 1000,
          message: res.message,
        });
        setOtpCode('');
        setError('');
        setNotice('');
      } else {
        const session = await request<Session>('/auth/login', {
          email: values.email.trim(),
          password: values.password,
        });
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

  async function handleVerifyOtp() {
    if (!pendingChallenge || submitting.current) return;
    if (otpCode.length !== 6) {
      setError('Vui lòng nhập đủ 6 chữ số mã xác thực.');
      return;
    }
    if (expirySeconds <= 0) {
      setError('Mã xác thực đã hết hạn. Vui lòng bấm gửi lại mã mới.');
      return;
    }

    submitting.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const session = await request<Session>('/auth/register/verify', {
        challengeId: pendingChallenge.challengeId,
        code: otpCode,
      });
      // Clear all private pending fields upon completion
      setPendingChallenge(null);
      setOtpCode('');
      form.reset();
      queryClient.clear();
      queryClient.setQueryData(['session'], session);
      router.push(accountPath(session.role));
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : 'Mã xác thực không hợp lệ hoặc đã hết hạn.',
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  async function handleResendOtp() {
    if (!pendingChallenge || resendCooldown > 0 || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await request<RegisterPendingResponse>('/auth/register', {
        fullName: pendingChallenge.fullName,
        email: pendingChallenge.email,
        password: pendingChallenge.password,
      });
      setPendingChallenge({
        challengeId: res.challengeId,
        email: pendingChallenge.email,
        fullName: pendingChallenge.fullName,
        password: pendingChallenge.password,
        expiresAt: Date.now() + (res.expiresInSeconds || 600) * 1000,
        resendAvailableAt: Date.now() + (res.resendAfterSeconds || 60) * 1000,
        message: res.message,
      });
      setOtpCode('');
      setNotice('Đã gửi lại mã xác thực mới tới email của bạn.');
      otpInputRef.current?.focus();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Chưa thể gửi lại mã xác thực lúc này. Vui lòng thử lại sau.',
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  function handleCancelChallenge() {
    // Clear all private pending fields upon exiting
    setPendingChallenge(null);
    setOtpCode('');
    setError('');
    setNotice('');
    form.setValue('password', '');
    form.setValue('confirm', '');
  }

  const errors = form.formState.errors;
  const invalidReset = mode === 'reset' && !token;
  const completed = !!notice && (mode === 'reset' || mode === 'forgot');

  return (
    <AuthShell mode={mode}>
      <h1 id="auth-title">{pendingChallenge ? 'Xác thực tài khoản' : titles[mode]}</h1>
      {pendingChallenge ? (
        <p className="auth-intro">
          Mã xác thực 6 chữ số đã được gửi tới email{' '}
          <strong className="auth-email-highlight">{pendingChallenge.email}</strong>. Vui lòng kiểm
          tra hộp thư của bạn.
        </p>
      ) : (
        mode !== 'login' && (
          <p className="auth-intro">
            {mode === 'register'
              ? 'Đặt hoa và theo dõi đơn của bạn.'
              : mode === 'forgot'
                ? 'Nhập email để nhận liên kết khôi phục.'
                : 'Liên kết dùng một lần, có hiệu lực trong 20 phút.'}
          </p>
        )
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
                {mode === 'forgot'
                  ? 'Kiểm tra hộp thư của bạn'
                  : mode === 'reset'
                    ? 'Mật khẩu đã được cập nhật'
                    : 'Thông báo'}
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

      {/* Six-digit email OTP verification step */}
      {pendingChallenge && (
        <form
          className="auth-form auth-otp-form"
          noValidate
          aria-busy={busy}
          onSubmit={(event) => {
            event.preventDefault();
            void handleVerifyOtp();
          }}
        >
          <div className="auth-field">
            <label htmlFor="member-otp">Mã xác thực (6 chữ số)</label>
            <input
              id="member-otp"
              ref={otpInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              aria-required="true"
              value={otpCode}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
                setOtpCode(digits);
                if (error) setError('');
              }}
              placeholder="••••••"
              aria-invalid={!!error && !notice}
              aria-describedby="member-otp-hint"
              className="auth-otp-input"
            />
            <p id="member-otp-hint" className="auth-hint">
              {expirySeconds <= 0
                ? 'Mã xác thực đã hết hạn. Vui lòng bấm gửi lại mã mới.'
                : `Mã có hiệu lực trong ${formatTime(expirySeconds)}.`}
            </p>
          </div>

          <Button
            className="auth-submit"
            type="submit"
            disabled={busy || otpCode.length !== 6 || expirySeconds <= 0}
          >
            {busy ? 'Đang xác thực…' : 'Xác thực và đăng nhập'}
            {!busy && <ArrowRight size={20} aria-hidden="true" />}
          </Button>

          <div className="auth-otp-actions">
            <button
              type="button"
              className="auth-link-button auth-resend-btn"
              disabled={busy || resendCooldown > 0}
              onClick={() => void handleResendOtp()}
            >
              {resendCooldown > 0 ? `Gửi lại mã (${resendCooldown}s)` : 'Gửi lại mã xác thực'}
            </button>
            <span className="auth-action-separator" aria-hidden="true">
              •
            </span>
            <button
              type="button"
              className="auth-link-button auth-back-btn"
              disabled={busy}
              onClick={handleCancelChallenge}
            >
              Đổi email hoặc quay lại
            </button>
          </div>

          <span className="auth-sr-status" role="status">
            {busy ? 'Đang gửi yêu cầu xác thực. Vui lòng chờ.' : ''}
          </span>
        </form>
      )}

      {/* Main Authentication Form */}
      {!invalidReset && !completed && !pendingChallenge && (
        <form
          className="auth-form"
          noValidate
          aria-busy={busy}
          onSubmit={(event) => void form.handleSubmit(submit)(event)}
        >
          {(mode === 'login' || mode === 'register') && configError && (
            <div className="auth-message auth-message-error" role="status">
              <p>Không thể tải cấu hình xác thực từ máy chủ. Vui lòng thử lại sau.</p>
              <button
                type="button"
                className="auth-link-button"
                onClick={() => void retryFetchConfig()}
                disabled={configLoading}
              >
                Thử tải lại cấu hình
              </button>
            </div>
          )}
          {mode === 'register' && authConfig && !authConfig.registrationEmailEnabled && (
            <div className="auth-message auth-message-error" role="alert">
              <p>Chức năng đăng ký tài khoản qua email hiện đang tạm tắt.</p>
            </div>
          )}
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
              {mode === 'login' && (
                <div className="auth-forgot-link">
                  <Link href="/quen-mat-khau">Quên mật khẩu?</Link>
                </div>
              )}
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
          <Button
            className="auth-submit"
            type="submit"
            disabled={
              busy ||
              (mode === 'register' && authConfig !== null && !authConfig.registrationEmailEnabled)
            }
          >
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

      {/* Real Google Identity Services section */}
      {(mode === 'login' || mode === 'register') &&
        !invalidReset &&
        !completed &&
        !pendingChallenge && (
          <div className="auth-social-section">
            <div className="auth-divider">
              <span>hoặc</span>
            </div>
            {gisStatus === 'unavailable' && (
              <div className="auth-google-status auth-google-unavailable" role="status">
                <button
                  type="button"
                  className="auth-google-btn auth-google-btn-disabled"
                  disabled
                  aria-disabled="true"
                >
                  <GoogleIcon />
                  <span>Đăng nhập Google hiện không khả dụng</span>
                </button>
                <p className="auth-hint auth-google-note">
                  Đăng nhập Google tạm thời chưa được kích hoạt trên hệ thống.
                </p>
              </div>
            )}
            {gisStatus === 'loading' && (
              <div className="auth-google-status auth-google-loading" role="status">
                <button
                  type="button"
                  className="auth-google-btn auth-google-btn-disabled"
                  disabled
                  aria-disabled="true"
                >
                  <GoogleIcon />
                  <span>Đang kết nối Google…</span>
                </button>
              </div>
            )}
            {(gisStatus === 'error' || gisStatus === 'slow_load_error') && (
              <div className="auth-google-status auth-google-error" role="status">
                <button
                  type="button"
                  className="auth-google-btn auth-google-btn-disabled"
                  disabled
                  aria-disabled="true"
                >
                  <GoogleIcon />
                  <span>Không thể tải đăng nhập Google</span>
                </button>
                <p className="auth-hint auth-google-note">
                  Không thể kết nối đến Google Identity Services. Vui lòng thử lại sau.
                </p>
              </div>
            )}
            <div
              ref={googleBtnContainerRef}
              className="auth-google-rendered-wrapper"
              data-testid="google-button-container"
              style={{ display: gisStatus === 'ready' ? 'flex' : 'none' }}
            />
          </div>
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
