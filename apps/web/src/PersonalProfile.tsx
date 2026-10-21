'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Button, CircleAlert, Check, Eye, EyeOff, ArrowRight, RotateCcw } from '@florabot/ui';
import {
  ApiError,
  logoutSession,
  queryClient,
  request,
  sessionQuery,
  type AccountProfile,
  type BankRevealResponse,
  type ContactEmailChallenge,
  type Session,
  type UpdateProfilePayload,
} from './api';
import { getRoleLabel } from './WorkspaceAccount';
import { workspaceBase } from './workspaceSections';
import { ConfirmDialog } from './dashboard/Modal';

const phonePattern = /^(0[35789][0-9]{8}|\+84[35789][0-9]{8})$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const asciiAlphanumeric = /^[A-Za-z0-9]{4,34}$/;

const hasControlChars = (value: string): boolean =>
  Array.from(value).some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127);

interface BasicFormValues {
  fullName: string;
  phone: string;
  address: string;
}

interface BankFormValues {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
}

export default function PersonalProfile() {
  const session = useQuery(sessionQuery);
  // A new identity gets fresh form/OTP/bank state, even when cookies change in
  // another tab without navigating away from the current profile page.
  return <PersonalProfileContent key={session.data?.id ?? 'signed-out'} />;
}

function PersonalProfileContent() {
  const session = useQuery(sessionQuery);

  const isHumanRole =
    session.data &&
    ['ADMIN', 'SELLER', 'CUSTOMER', 'OPERATIONS_MANAGER', 'TECHNICIAN', 'SELLER_STAFF'].includes(
      session.data.role,
    );

  const profile = useQuery({
    queryKey: ['account-profile', session.data?.id],
    queryFn: () => request<AccountProfile>('/account/profile'),
    enabled: !!isHumanRole && !!session.data?.id,
    staleTime: 30_000,
  });

  // Basic info form
  const [basicSaving, setBasicSaving] = useState(false);
  const [basicNotice, setBasicNotice] = useState('');
  const [basicError, setBasicError] = useState('');

  const basicForm = useForm<BasicFormValues>({
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    defaultValues: {
      fullName: '',
      phone: '',
      address: '',
    },
  });

  // Preserve unsaved draft: only populate from profile data when form is untouched / pristine
  useEffect(() => {
    if (profile.data && !basicForm.formState.isDirty) {
      basicForm.reset({
        fullName: profile.data.fullName ?? '',
        phone: profile.data.phone ?? '',
        address: profile.data.address ?? '',
      });
    }
  }, [profile.data, basicForm]);

  // Contact email state
  const [contactMode, setContactMode] = useState<'idle' | 'requesting' | 'otp'>('idle');
  const [targetContactEmail, setTargetContactEmail] = useState('');
  const [contactChallenge, setContactChallenge] = useState<ContactEmailChallenge | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [contactSending, setContactSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [contactResetting, setContactResetting] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [contactNotice, setContactNotice] = useState('');
  const [contactError, setContactError] = useState('');

  // Bank section state
  const [bankMode, setBankMode] = useState<'idle' | 'edit' | 'review' | 'clear-confirm'>('idle');
  const [bankValues, setBankValues] = useState<BankFormValues>({
    bankName: '',
    accountHolder: '',
    accountNumber: '',
  });
  const [bankErrors, setBankErrors] = useState<Partial<Record<keyof BankFormValues, string>>>({});
  const [bankSaving, setBankSaving] = useState(false);
  const [clearingBank, setClearingBank] = useState(false);
  const [revealingBank, setRevealingBank] = useState(false);
  const [revealedData, setRevealedData] = useState<{
    userId: string;
    accountNumber: string;
  } | null>(null);
  const [bankNotice, setBankNotice] = useState('');
  const [bankError, setBankError] = useState('');

  // Logout state
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  // Identity-scoped revealed account number (automatically null if session changes)
  const revealedAccountNumber =
    revealedData && session.data?.id && revealedData.userId === session.data.id
      ? revealedData.accountNumber
      : null;

  // Resend cooldown timer for OTP
  useEffect(() => {
    if (contactMode !== 'otp' || resendCountdown <= 0) return;
    const interval = setInterval(() => {
      setResendCountdown((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [contactMode, resendCountdown]);

  // Bank security: clear revealed account number on tab hiding or unmount
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        setRevealedData(null);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      setRevealedData(null);
    };
  }, []);

  // Logout handler
  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError('');
    try {
      await logoutSession();
      setRevealedData(null);
      window.location.replace(
        session.data?.role === 'ADMIN' ||
          session.data?.role === 'OPERATIONS_MANAGER' ||
          session.data?.role === 'TECHNICIAN' ||
          session.data?.role === 'STAFF'
          ? '/admin/login'
          : '/dang-nhap',
      );
    } catch (cause) {
      setLogoutError(
        cause instanceof ApiError ? cause.message : 'Chưa đăng xuất được. Bạn thử lại nhé.',
      );
    } finally {
      setLoggingOut(false);
    }
  }

  // Loading state
  if (session.isPending || (isHumanRole && profile.isPending)) {
    return (
      <main id="main">
        <div className="profile-page">
          <p role="status">Đang tải hồ sơ cá nhân…</p>
        </div>
      </main>
    );
  }

  const isUnauthorized = session.error instanceof ApiError && session.error.status === 401;

  // Session error that is not 401 (e.g. 503 Service Unavailable, network error)
  if (session.isError && !isUnauthorized) {
    return (
      <main id="main">
        <div className="profile-page">
          <div className="profile-header-titles">
            <h1>Chưa kết nối được FloraBot</h1>
            <p>
              {session.error instanceof ApiError
                ? session.error.message
                : 'Không tải được phiên làm việc do máy chủ đang bận hoặc gián đoạn kết nối. Vui lòng thử lại.'}
            </p>
          </div>
          <div className="profile-actions" style={{ marginTop: '1.5rem' }}>
            <Button onClick={() => void session.refetch()}>Thử lại</Button>
          </div>
        </div>
      </main>
    );
  }

  // Truly anonymous user (401 or null session without error)
  if (!session.data || isUnauthorized) {
    return (
      <main id="main">
        <div className="profile-page">
          <div className="profile-header-titles">
            <h1>Hồ sơ cá nhân</h1>
            <p>Vui lòng đăng nhập để truy cập và quản lý hồ sơ của bạn.</p>
          </div>
          <div className="profile-actions" style={{ marginTop: '2rem' }}>
            <Link href="/dang-nhap?returnUrl=/ho-so" className="button button-primary">
              Đăng nhập tài khoản
            </Link>
            <Link href="/admin/login?returnUrl=/ho-so" className="button button-outline">
              Đăng nhập vận hành
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Retired STAFF role state
  if (session.data.role === 'STAFF') {
    return (
      <main id="main">
        <div className="profile-page">
          <div className="profile-header-titles">
            <h1>Tài khoản nhân viên cũ đã ngừng hoạt động</h1>
          </div>
          <div className="workspace-denied-notice" role="alert" style={{ marginTop: '1.5rem' }}>
            <CircleAlert size={20} aria-hidden="true" />
            <p>
              Tài khoản nhân viên FloraBot trước đây đã ngừng hoạt động. Hệ thống hiện phân chia
              thành hai vai trò mới: Kỹ thuật viên (xử lý sự cố tủ) và Nhân viên shop (giao hoa và
              nạp ô tủ). Vui lòng liên hệ quản trị viên để được cấp vai trò phù hợp hoặc đăng xuất.
            </p>
          </div>
          {logoutError && (
            <p role="alert" className="error" style={{ marginTop: '1rem' }}>
              {logoutError}
            </p>
          )}
          <div className="profile-actions" style={{ marginTop: '1.5rem' }}>
            <Button variant="outline" disabled={loggingOut} onClick={() => void handleLogout()}>
              {loggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
            </Button>
          </div>
        </div>
      </main>
    );
  }

  // Profile data fetch error
  if (profile.isError || !profile.data) {
    return (
      <main id="main">
        <div className="profile-page">
          <h1>Hồ sơ cá nhân</h1>
          <p role="alert" className="error">
            {profile.error instanceof ApiError
              ? profile.error.message
              : 'Chưa tải được hồ sơ cá nhân. Vui lòng kiểm tra kết nối.'}
          </p>
          <div className="profile-actions">
            <Button onClick={() => void profile.refetch()}>Tải lại hồ sơ</Button>
            <Link href={workspaceBase(session.data.role)} className="button button-outline">
              Về khu vực của bạn
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const role = session.data.role;
  const roleLabel = getRoleLabel(role);
  const homeUrl = role === 'CUSTOMER' ? '/tai-khoan' : workspaceBase(role);
  const currentProfile = profile.data;

  // Basic Profile Form Submit
  const onSaveBasic = async (values: BasicFormValues) => {
    if (basicSaving) return;
    setBasicSaving(true);
    setBasicError('');
    setBasicNotice('');

    const trimmedName = values.fullName.trim();
    const trimmedPhone = values.phone.trim();
    const trimmedAddress = values.address.trim();

    // Client-side validations
    if (trimmedName.length < 2 || trimmedName.length > 100) {
      setBasicError('Họ và tên phải từ 2 đến 100 ký tự.');
      setBasicSaving(false);
      return;
    }
    if (hasControlChars(trimmedName)) {
      setBasicError('Họ và tên không chứa ký tự xuống dòng hoặc điều khiển.');
      setBasicSaving(false);
      return;
    }

    if (trimmedPhone && !phonePattern.test(trimmedPhone)) {
      setBasicError('Số điện thoại Việt Nam không hợp lệ (ví dụ: 0901234567 hoặc +84901234567).');
      setBasicSaving(false);
      return;
    }

    if (trimmedAddress.length > 300) {
      setBasicError('Địa chỉ tối đa 300 ký tự.');
      setBasicSaving(false);
      return;
    }
    if (hasControlChars(trimmedAddress)) {
      setBasicError('Địa chỉ không chứa ký tự điều khiển.');
      setBasicSaving(false);
      return;
    }

    const payload: UpdateProfilePayload = {
      fullName: trimmedName,
      phone: trimmedPhone || null,
      address: trimmedAddress || null,
    };

    try {
      const updated = await request<AccountProfile>('/account/profile', payload, true, 'PUT');
      queryClient.setQueryData(['account-profile', session.data?.id], updated);
      queryClient.setQueryData(['session'], (old: Session | undefined) =>
        old ? { ...old, name: updated.fullName } : old,
      );
      void queryClient.invalidateQueries({ queryKey: ['account-profile'] });
      void queryClient.invalidateQueries({ queryKey: ['member-profile'] });

      basicForm.reset({
        fullName: updated.fullName,
        phone: updated.phone ?? '',
        address: updated.address ?? '',
      });
      setBasicNotice('Đã lưu thay đổi hồ sơ cá nhân.');
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        setBasicError('Số điện thoại này đã được sử dụng bởi một tài khoản khác.');
      } else if (cause instanceof ApiError) {
        setBasicError(cause.message);
      } else {
        setBasicError('Chưa lưu được thông tin. Vui lòng thử lại.');
      }
    } finally {
      setBasicSaving(false);
    }
  };

  // Contact Email: Request OTP challenge
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (contactSending) return;
    setContactSending(true);
    setContactError('');
    setContactNotice('');

    const email = targetContactEmail.trim();
    if (!emailPattern.test(email) || email.length > 254) {
      setContactError('Vui lòng nhập địa chỉ email hợp lệ (tối đa 254 ký tự).');
      setContactSending(false);
      return;
    }

    try {
      const challenge = await request<ContactEmailChallenge>('/account/contact-email', { email });
      setContactChallenge(challenge);
      setResendCountdown(challenge.resendAfterSeconds || 60);
      setContactMode('otp');
      setOtpCode('');
      setContactNotice(
        challenge.message ||
          `Đã gửi mã xác thực tới ${email}. Vui lòng kiểm tra hộp thư để lấy mã OTP.`,
      );
    } catch (cause) {
      setContactError(
        cause instanceof ApiError ? cause.message : 'Chưa gửi được mã OTP. Vui lòng thử lại.',
      );
    } finally {
      setContactSending(false);
    }
  };

  // Contact Email: Verify OTP challenge
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpVerifying || !contactChallenge) return;
    setOtpVerifying(true);
    setContactError('');
    setContactNotice('');

    const code = otpCode.trim();
    if (!/^[0-9]{6}$/.test(code)) {
      setContactError('Mã OTP gồm đúng 6 chữ số.');
      setOtpVerifying(false);
      return;
    }

    try {
      const updated = await request<AccountProfile>('/account/contact-email/verify', {
        challengeId: contactChallenge.challengeId,
        code,
      });
      queryClient.setQueryData(['account-profile', session.data?.id], updated);
      void queryClient.invalidateQueries({ queryKey: ['account-profile'] });
      setContactMode('idle');
      setContactChallenge(null);
      setTargetContactEmail('');
      setOtpCode('');
      setContactNotice('Email liên hệ mới đã được xác thực và áp dụng thành công.');
    } catch (cause) {
      setContactError(
        cause instanceof ApiError
          ? cause.message
          : 'Mã OTP không đúng hoặc đã hết hạn. Vui lòng thử lại.',
      );
    } finally {
      setOtpVerifying(false);
    }
  };

  // Contact Email: Resend OTP
  const handleResendOtp = async () => {
    if (contactSending || resendCountdown > 0 || !targetContactEmail) return;
    setContactSending(true);
    setContactError('');
    setContactNotice('');
    try {
      const challenge = await request<ContactEmailChallenge>('/account/contact-email', {
        email: targetContactEmail.trim(),
      });
      setContactChallenge(challenge);
      setResendCountdown(challenge.resendAfterSeconds || 60);
      setContactNotice(`Đã gửi lại mã xác thực mới tới ${targetContactEmail.trim()}.`);
    } catch (cause) {
      setContactError(
        cause instanceof ApiError ? cause.message : 'Chưa gửi lại được mã. Hãy thử lại.',
      );
    } finally {
      setContactSending(false);
    }
  };

  // Contact Email: Reset to default login email
  const handleResetDefaultContact = async () => {
    if (contactResetting) return;
    setContactResetting(true);
    setContactError('');
    setContactNotice('');
    try {
      const updated = await request<AccountProfile>('/account/contact-email/reset', {});
      queryClient.setQueryData(['account-profile', session.data?.id], updated);
      void queryClient.invalidateQueries({ queryKey: ['account-profile'] });
      setContactMode('idle');
      setContactChallenge(null);
      setTargetContactEmail('');
      setOtpCode('');
      setContactNotice('Đã khôi phục email liên hệ về email đăng nhập mặc định.');
    } catch (cause) {
      setContactError(
        cause instanceof ApiError ? cause.message : 'Chưa khôi phục được email mặc định.',
      );
    } finally {
      setContactResetting(false);
    }
  };

  // Bank: Reveal full account number
  const handleRevealBank = async () => {
    if (revealingBank) return;
    setRevealingBank(true);
    setBankError('');
    try {
      const res = await request<BankRevealResponse>('/account/profile/bank/reveal', {});
      setRevealedData({ userId: session.data?.id ?? '', accountNumber: res.accountNumber });
    } catch (cause) {
      setBankError(
        cause instanceof ApiError ? cause.message : 'Chưa lấy được thông tin số tài khoản.',
      );
    } finally {
      setRevealingBank(false);
    }
  };

  // Bank: Start editing
  const handleStartEditBank = () => {
    setBankValues({
      bankName: currentProfile.bank?.bankName ?? '',
      accountHolder: currentProfile.bank?.accountHolder ?? '',
      accountNumber: '',
    });
    setBankErrors({});
    setBankNotice('');
    setBankError('');
    setBankMode('edit');
  };

  // Bank: Review edit inputs before submit
  const handleReviewBank = (e: React.FormEvent) => {
    e.preventDefault();
    setBankError('');
    const errors: Partial<Record<keyof BankFormValues, string>> = {};

    const bName = bankValues.bankName.trim();
    const aHolder = bankValues.accountHolder.trim();
    const aNum = bankValues.accountNumber.trim();

    if (!bName) errors.bankName = 'Vui lòng nhập tên ngân hàng.';
    else if (bName.length > 120) errors.bankName = 'Tên ngân hàng tối đa 120 ký tự.';
    else if (hasControlChars(bName)) errors.bankName = 'Tên ngân hàng không chứa ký tự điều khiển.';

    if (!aHolder) errors.accountHolder = 'Vui lòng nhập tên chủ tài khoản.';
    else if (aHolder.length > 120) errors.accountHolder = 'Tên chủ tài khoản tối đa 120 ký tự.';
    else if (hasControlChars(aHolder))
      errors.accountHolder = 'Tên chủ tài khoản không chứa ký tự điều khiển.';

    if (!aNum) errors.accountNumber = 'Vui lòng nhập số tài khoản ngân hàng.';
    else if (!asciiAlphanumeric.test(aNum))
      errors.accountNumber = 'Số tài khoản gồm 4–34 chữ cái hoặc số, không có khoảng trắng.';

    if (Object.keys(errors).length > 0) {
      setBankErrors(errors);
      return;
    }

    setBankErrors({});
    setBankMode('review');
  };

  // Bank: Confirm save bank bundle
  const handleSaveBank = async () => {
    if (bankSaving) return;
    setBankSaving(true);
    setBankError('');
    setBankNotice('');

    const payload: UpdateProfilePayload = {
      fullName: currentProfile.fullName,
      phone: currentProfile.phone,
      address: currentProfile.address,
      bank: {
        bankName: bankValues.bankName.trim(),
        accountHolder: bankValues.accountHolder.trim(),
        accountNumber: bankValues.accountNumber.trim(),
      },
    };

    try {
      const updated = await request<AccountProfile>('/account/profile', payload, true, 'PUT');
      queryClient.setQueryData(['account-profile', session.data?.id], updated);
      void queryClient.invalidateQueries({ queryKey: ['account-profile'] });
      setBankValues({ bankName: '', accountHolder: '', accountNumber: '' });
      setBankMode('idle');
      setRevealedData(null);
      setBankNotice('Đã lưu thông tin tài khoản ngân hàng cá nhân.');
    } catch (cause) {
      setBankError(
        cause instanceof ApiError ? cause.message : 'Chưa lưu được thông tin ngân hàng.',
      );
      setBankMode('edit');
    } finally {
      setBankSaving(false);
    }
  };

  // Bank: Confirm clear bank
  const handleConfirmClearBank = async () => {
    if (clearingBank) return;
    setClearingBank(true);
    setBankError('');
    setBankNotice('');

    const payload: UpdateProfilePayload = {
      fullName: currentProfile.fullName,
      phone: currentProfile.phone,
      address: currentProfile.address,
      clearBank: true,
    };

    try {
      const updated = await request<AccountProfile>('/account/profile', payload, true, 'PUT');
      queryClient.setQueryData(['account-profile', session.data?.id], updated);
      void queryClient.invalidateQueries({ queryKey: ['account-profile'] });
      setBankMode('idle');
      setRevealedData(null);
      setBankNotice('Đã xóa thông tin tài khoản ngân hàng cá nhân.');
    } catch (cause) {
      setBankError(
        cause instanceof ApiError ? cause.message : 'Chưa xóa được tài khoản ngân hàng.',
      );
    } finally {
      setClearingBank(false);
    }
  };

  const initialAvatar =
    currentProfile.fullName?.trim().slice(0, 1).toLocaleUpperCase('vi-VN') || 'U';

  return (
    <main id="main">
      <div className="profile-page">
        {/* Navigation Breadcrumb */}
        <nav aria-label="Đường dẫn điều hướng" className="profile-breadcrumb">
          <Link href={homeUrl}>
            <ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} aria-hidden="true" />
            {role === 'CUSTOMER' ? 'Khu vực cá nhân' : 'Bảng điều khiển quản lý'}
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Hồ sơ cá nhân</span>
        </nav>

        {/* Profile Header */}
        <header className="profile-header">
          <div className="profile-header-info">
            <span className="profile-avatar-large" aria-hidden="true">
              {initialAvatar}
            </span>
            <div className="profile-header-titles">
              <h1>{currentProfile.fullName || 'Hồ sơ người dùng'}</h1>
              <p>Quản lý thông tin tài khoản, email liên hệ và phương thức nhận tiền cá nhân.</p>
            </div>
          </div>
          <span className="profile-badge profile-badge-neutral">{roleLabel}</span>
        </header>

        {/* Quick navigation anchor chips */}
        <nav aria-label="Mục hồ sơ" className="profile-quick-nav member-tabs">
          <a href="#identity-heading">Tài khoản</a>
          <a href="#basic-info-heading">Thông tin cá nhân</a>
          <a href="#contact-email-heading">Email liên hệ</a>
          <a href="#personal-bank-heading">Tài khoản ngân hàng</a>
        </nav>

        {/* Section 1: Read-only Login Identity & Role */}
        <section aria-labelledby="identity-heading" className="profile-section">
          <div className="profile-section-heading">
            <h2 id="identity-heading">Định danh tài khoản đăng nhập</h2>
            <p>
              Email đăng nhập và vai trò được gán cố định theo tài khoản của bạn để bảo đảm an toàn
              cho đăng nhập Google và mật khẩu. Không thể thay đổi các mục này tại đây.
            </p>
          </div>
          <dl className="profile-summary-grid">
            <div className="profile-summary-item">
              <dt>Email đăng nhập</dt>
              <dd>{currentProfile.loginEmail || 'Chưa thiết lập'}</dd>
            </div>
            <div className="profile-summary-item">
              <dt>Vai trò người dùng</dt>
              <dd>{roleLabel}</dd>
            </div>
          </dl>
        </section>

        {/* Section 2: Editable Basic Form (fullName, phone, address) */}
        <section aria-labelledby="basic-info-heading" className="profile-section">
          <div className="profile-section-heading">
            <h2 id="basic-info-heading">Thông tin cá nhân</h2>
            <p>Cập nhật họ tên, số điện thoại liên hệ và địa chỉ của bạn.</p>
          </div>

          {basicNotice && (
            <p role="status" className="profile-status-message profile-status-success">
              {basicNotice}
            </p>
          )}
          {basicError && (
            <p role="alert" className="profile-status-message profile-status-error">
              {basicError}
            </p>
          )}

          <form
            noValidate
            onSubmit={basicForm.handleSubmit(onSaveBasic)}
            className="profile-form"
            aria-busy={basicSaving}
          >
            <div className="profile-form-group">
              <label htmlFor="profile-full-name">Họ và tên *</label>
              <input
                id="profile-full-name"
                type="text"
                autoComplete="name"
                maxLength={100}
                disabled={basicSaving}
                {...basicForm.register('fullName')}
                aria-invalid={!!basicError && basicError.includes('Họ và tên')}
                aria-describedby="profile-full-name-hint"
              />
              <p id="profile-full-name-hint" className="profile-form-hint">
                Nhập từ 2 đến 100 ký tự. Không chứa ký tự xuống dòng hay điều khiển.
              </p>
            </div>

            <div className="profile-form-group">
              <label htmlFor="profile-phone">Số điện thoại</label>
              <input
                id="profile-phone"
                type="tel"
                autoComplete="tel"
                maxLength={15}
                disabled={basicSaving}
                {...basicForm.register('phone')}
                aria-invalid={!!basicError && basicError.includes('Số điện thoại')}
                aria-describedby="profile-phone-hint"
              />
              <p id="profile-phone-hint" className="profile-form-hint">
                Số điện thoại Việt Nam (ví dụ: 0901234567 hoặc +84901234567).
              </p>
            </div>

            <div className="profile-form-group">
              <label htmlFor="profile-address">Địa chỉ</label>
              <textarea
                id="profile-address"
                autoComplete="street-address"
                maxLength={300}
                rows={3}
                disabled={basicSaving}
                {...basicForm.register('address')}
                aria-invalid={!!basicError && basicError.includes('Địa chỉ')}
                aria-describedby="profile-address-hint"
              />
              <p id="profile-address-hint" className="profile-form-hint">
                Địa chỉ tối đa 300 ký tự.
              </p>
            </div>

            <div className="profile-actions">
              <Button type="submit" disabled={basicSaving}>
                {basicSaving ? 'Đang lưu…' : 'Lưu thông tin cá nhân'}
              </Button>
            </div>
          </form>
        </section>

        {/* Section 3: Verified Contact Email Section */}
        <section aria-labelledby="contact-email-heading" className="profile-section">
          <div className="profile-section-heading">
            <h2 id="contact-email-heading">Email liên hệ nhận thông báo</h2>
            <p>
              Email này dùng để nhận thông báo đơn hàng và dịch vụ từ hệ thống. Email này hoàn toàn
              tách biệt với email đăng nhập và có thể dùng chung với người khác.
            </p>
          </div>

          <div className="profile-disclaimer-card">
            Email liên hệ khác với email đăng nhập tài khoản. Email đăng nhập dùng để xác thực an
            toàn (mật khẩu, liên kết Google), còn email liên hệ là nơi gửi thông báo sau khi bạn đã
            xác thực bằng mã OTP.
          </div>

          {contactNotice && (
            <p role="status" className="profile-status-message profile-status-success">
              {contactNotice}
            </p>
          )}
          {contactError && (
            <p role="alert" className="profile-status-message profile-status-error">
              {contactError}
            </p>
          )}

          <dl className="profile-summary-grid">
            <div className="profile-summary-item">
              <dt>Email liên hệ hiện tại</dt>
              <dd>
                {currentProfile.contactEmail || currentProfile.loginEmail || 'Chưa thiết lập'}
              </dd>
            </div>
            <div className="profile-summary-item">
              <dt>Trạng thái xác thực</dt>
              <dd>
                {currentProfile.contactEmailIsDefault ? (
                  <span className="profile-badge profile-badge-neutral">
                    Mặc định (Email đăng nhập)
                  </span>
                ) : currentProfile.contactEmailVerified ? (
                  <span className="profile-badge profile-badge-success">
                    <Check size={14} aria-hidden="true" /> Đã xác thực
                  </span>
                ) : (
                  <span className="profile-badge profile-badge-warning">Chờ xác thực</span>
                )}
              </dd>
            </div>
          </dl>

          {/* Idle Mode: Show Buttons */}
          {contactMode === 'idle' && (
            <div className="profile-actions">
              <Button variant="outline" onClick={() => setContactMode('requesting')}>
                Thay đổi email liên hệ
              </Button>
              {!currentProfile.contactEmailIsDefault && (
                <Button
                  variant="outline"
                  disabled={contactResetting}
                  onClick={() => void handleResetDefaultContact()}
                >
                  <RotateCcw size={16} aria-hidden="true" />
                  {contactResetting ? 'Đang khôi phục…' : 'Khôi phục về email đăng nhập mặc định'}
                </Button>
              )}
            </div>
          )}

          {/* Requesting Mode: Enter new email and send OTP */}
          {contactMode === 'requesting' && (
            <form onSubmit={handleRequestOtp} className="profile-form" noValidate>
              <div className="profile-form-group">
                <label htmlFor="target-contact-email">Địa chỉ email liên hệ mới *</label>
                <input
                  id="target-contact-email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  value={targetContactEmail}
                  onChange={(e) => setTargetContactEmail(e.target.value)}
                  disabled={contactSending}
                  placeholder="vi-du@domain.vn"
                  required
                />
                <p className="profile-form-hint">
                  Hệ thống sẽ gửi mã xác thực 6 chữ số tới địa chỉ này.
                </p>
              </div>
              <div className="profile-actions">
                <Button type="submit" disabled={contactSending}>
                  {contactSending ? 'Đang gửi mã…' : 'Gửi mã xác thực (OTP)'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={contactSending}
                  onClick={() => {
                    setContactMode('idle');
                    setContactError('');
                    setTargetContactEmail('');
                  }}
                >
                  Hủy
                </Button>
              </div>
            </form>
          )}

          {/* OTP Mode: Enter code and submit verification */}
          {contactMode === 'otp' && (
            <div className="profile-otp-box">
              <form onSubmit={handleVerifyOtp} noValidate>
                <p>
                  Nhập mã OTP gồm 6 chữ số đã được gửi tới <strong>{targetContactEmail}</strong>. Mã
                  có hiệu lực trong vòng 10 phút.
                </p>
                <div className="profile-form-group">
                  <label htmlFor="contact-otp-input">Mã xác thực OTP *</label>
                  <input
                    id="contact-otp-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    disabled={otpVerifying}
                    placeholder="••••••"
                    className="profile-otp-input"
                    required
                  />
                </div>
                <div className="profile-actions">
                  <Button type="submit" disabled={otpVerifying || otpCode.length !== 6}>
                    {otpVerifying ? 'Đang xác thực…' : 'Xác nhận mã OTP'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={resendCountdown > 0 || contactSending}
                    onClick={() => void handleResendOtp()}
                  >
                    {resendCountdown > 0 ? `Gửi lại sau ${resendCountdown}s` : 'Gửi lại mã OTP'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={otpVerifying}
                    onClick={() => {
                      setContactMode('idle');
                      setContactChallenge(null);
                      setOtpCode('');
                      setContactError('');
                    }}
                  >
                    Hủy
                  </Button>
                </div>
              </form>
            </div>
          )}
        </section>

        {/* Section 4: Optional Personal Bank Section */}
        <section aria-labelledby="personal-bank-heading" className="profile-section">
          <div className="profile-section-heading">
            <h2 id="personal-bank-heading">Tài khoản ngân hàng cá nhân</h2>
            <p>
              Tùy chọn lưu thông tin tài khoản ngân hàng của bạn để hỗ trợ hoàn tiền hoặc đối soát
              khi cần thiết.
            </p>
          </div>

          <div className="profile-disclaimer-card">
            <strong>Phân biệt rõ ràng:</strong> Đối với chủ shop, tài khoản ngân hàng cá nhân tại
            đây hoàn toàn độc lập với tài khoản nhận tiền bán hoa của shop (được quản lý riêng trong
            mục Ví shop) và không làm ảnh hưởng tới các lệnh rút tiền lịch sử của cửa hàng.
          </div>

          {bankNotice && (
            <p role="status" className="profile-status-message profile-status-success">
              {bankNotice}
            </p>
          )}
          {bankError && (
            <p role="alert" className="profile-status-message profile-status-error">
              {bankError}
            </p>
          )}

          {/* Idle view: Bank exists or not */}
          {bankMode === 'idle' && (
            <>
              {currentProfile.bank?.hasAccount ? (
                <div className="profile-bank-details">
                  <dl className="profile-summary-grid">
                    <div className="profile-summary-item">
                      <dt>Tên ngân hàng</dt>
                      <dd>{currentProfile.bank.bankName}</dd>
                    </div>
                    <div className="profile-summary-item">
                      <dt>Chủ tài khoản</dt>
                      <dd>{currentProfile.bank.accountHolder}</dd>
                    </div>
                    <div className="profile-summary-item">
                      <dt>Số tài khoản</dt>
                      <dd>
                        <div className="profile-account-number-row">
                          <span
                            className={
                              revealedAccountNumber
                                ? 'profile-account-number profile-revealed-number'
                                : 'profile-account-number'
                            }
                          >
                            {revealedAccountNumber ? (
                              revealedAccountNumber
                            ) : (
                              <>•••• •••• •••• {currentProfile.bank.accountLast4}</>
                            )}
                          </span>
                          {revealedAccountNumber ? (
                            <Button
                              variant="outline"
                              onClick={() => setRevealedData(null)}
                              aria-label="Ẩn số tài khoản"
                            >
                              <EyeOff size={16} aria-hidden="true" />
                              Ẩn số tài khoản
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              disabled={revealingBank}
                              onClick={() => void handleRevealBank()}
                              aria-label="Hiện đầy đủ số tài khoản ngân hàng"
                            >
                              <Eye size={16} aria-hidden="true" />
                              {revealingBank ? 'Đang mở…' : 'Xem đầy đủ'}
                            </Button>
                          )}
                        </div>
                      </dd>
                    </div>
                  </dl>
                  <div className="profile-actions">
                    <Button variant="outline" onClick={handleStartEditBank}>
                      Đổi tài khoản ngân hàng
                    </Button>
                    <Button variant="outline" onClick={() => setBankMode('clear-confirm')}>
                      Xóa tài khoản ngân hàng
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="profile-bank-details">
                  <p>Bạn chưa lưu thông tin tài khoản ngân hàng cá nhân.</p>
                  <div className="profile-actions">
                    <Button variant="outline" onClick={handleStartEditBank}>
                      Khai báo tài khoản ngân hàng
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Edit form */}
          {bankMode === 'edit' && (
            <form onSubmit={handleReviewBank} className="profile-form" noValidate>
              <div className="profile-form-group">
                <label htmlFor="bank-name-input">Tên ngân hàng *</label>
                <input
                  id="bank-name-input"
                  type="text"
                  autoComplete="off"
                  maxLength={120}
                  value={bankValues.bankName}
                  onChange={(e) => setBankValues((prev) => ({ ...prev, bankName: e.target.value }))}
                  aria-invalid={!!bankErrors.bankName}
                  aria-describedby="bank-name-error"
                  required
                />
                {bankErrors.bankName && (
                  <p id="bank-name-error" className="profile-field-error">
                    {bankErrors.bankName}
                  </p>
                )}
              </div>

              <div className="profile-form-group">
                <label htmlFor="bank-holder-input">Tên chủ tài khoản *</label>
                <input
                  id="bank-holder-input"
                  type="text"
                  autoComplete="off"
                  maxLength={120}
                  value={bankValues.accountHolder}
                  onChange={(e) =>
                    setBankValues((prev) => ({ ...prev, accountHolder: e.target.value }))
                  }
                  aria-invalid={!!bankErrors.accountHolder}
                  aria-describedby="bank-holder-error"
                  required
                />
                {bankErrors.accountHolder && (
                  <p id="bank-holder-error" className="profile-field-error">
                    {bankErrors.accountHolder}
                  </p>
                )}
              </div>

              <div className="profile-form-group">
                <label htmlFor="bank-number-input">Số tài khoản ngân hàng *</label>
                <input
                  id="bank-number-input"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={34}
                  value={bankValues.accountNumber}
                  onChange={(e) =>
                    setBankValues((prev) => ({ ...prev, accountNumber: e.target.value }))
                  }
                  aria-invalid={!!bankErrors.accountNumber}
                  aria-describedby="bank-number-hint bank-number-error"
                  required
                />
                <p id="bank-number-hint" className="profile-form-hint">
                  Từ 4–34 chữ cái hoặc số, không có khoảng trắng. Nhập đủ cả số 0 ở đầu nếu có.
                </p>
                {bankErrors.accountNumber && (
                  <p id="bank-number-error" className="profile-field-error">
                    {bankErrors.accountNumber}
                  </p>
                )}
              </div>

              <div className="profile-actions">
                <Button type="submit">Kiểm tra thông tin tài khoản</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setBankMode('idle');
                    setBankValues({ bankName: '', accountHolder: '', accountNumber: '' });
                    setBankErrors({});
                  }}
                >
                  Hủy
                </Button>
              </div>
            </form>
          )}

          {/* Review step before saving bank */}
          {bankMode === 'review' && (
            <div className="profile-review-card">
              <h4>Kiểm tra thông tin tài khoản cá nhân</h4>
              <p>
                <strong>Ngân hàng:</strong> {bankValues.bankName}
              </p>
              <p>
                <strong>Chủ tài khoản:</strong> {bankValues.accountHolder}
              </p>
              <p>
                <strong>Số tài khoản:</strong> Đã che, kết thúc bằng{' '}
                {bankValues.accountNumber.slice(bankValues.accountNumber.length > 4 ? -4 : -2)}
              </p>
              <p className="profile-form-hint" style={{ marginTop: '0.75rem' }}>
                FloraBot chưa xác minh thông tin này với ngân hàng. Bạn cần kiểm tra chính xác trước
                khi lưu.
              </p>
              <div className="profile-actions">
                <Button disabled={bankSaving} onClick={() => void handleSaveBank()}>
                  {bankSaving ? 'Đang lưu tài khoản…' : 'Xác nhận lưu tài khoản'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={bankSaving}
                  onClick={() => setBankMode('edit')}
                >
                  Sửa lại thông tin
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={bankSaving}
                  onClick={() => {
                    setBankMode('idle');
                    setBankValues({ bankName: '', accountHolder: '', accountNumber: '' });
                  }}
                >
                  Hủy
                </Button>
              </div>
            </div>
          )}

          {/* Clear Bank Confirmation Dialog */}
          <ConfirmDialog
            open={bankMode === 'clear-confirm'}
            title="Xác nhận xóa tài khoản ngân hàng?"
            description="Thông tin tài khoản ngân hàng cá nhân sẽ bị xóa khỏi hồ sơ của bạn. Thao tác này không thể hoàn tác."
            confirmLabel="Xác nhận xóa"
            pending={clearingBank}
            onConfirm={() => void handleConfirmClearBank()}
            onCancel={() => setBankMode('idle')}
          />
        </section>
      </div>
    </main>
  );
}
