'use client';

import './styles/profile.css';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Button, CircleAlert, Check, Eye, EyeOff, ArrowRight, RotateCcw } from '@florabot/ui';
import { ApiError, logoutSession, queryClient, sessionQuery, type Session } from '@/shared/lib/api';
import { getRoleLabel } from '@/features/portal/config/roleRoutes';
import { workspaceBase } from '@/features/portal/config/workspaceSections';
import { ConfirmDialog, Modal } from '../../shared/components/Modal';
import GoogleAccountLink from '../auth/GoogleAccountLink';
import { passwordRule } from '../auth/auth.schemas';
import { changeMemberPassword } from '../customer-account/customer-account.api';
import {
  getAccountProfile,
  updateAccountProfile,
  requestContactEmailChallenge,
  verifyContactEmail,
  resetContactEmail,
  revealBank,
} from './profile.api';
import type {
  ContactEmailChallenge,
  BasicFormValues,
  BankFormValues,
  BankMode,
  ContactMode,
  UpdateProfilePayload,
} from './profile.types';
import { phonePattern, emailPattern, asciiAlphanumeric, hasControlChars } from './profile.schemas';
import { basicPayload, basicValues, validBirthDate, vietnamToday } from './profile.utils';
import { profileSections, useProfileNavigation } from './useProfileNavigation';
import { useProfileDraftGuard } from './useProfileDraftGuard';

export default function PersonalProfile() {
  const session = useQuery(sessionQuery);
  // A new identity gets fresh form/OTP/bank state, even when cookies change in
  // another tab without navigating away from the current profile page.
  return <PersonalProfileContent key={session.data?.id ?? 'signed-out'} />;
}

function PersonalProfileContent() {
  const session = useQuery(sessionQuery);
  const active = useRef(true);
  const revealVersion = useRef(0);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const isCurrentIdentity = () =>
    active.current && queryClient.getQueryData<Session>(['session'])?.id === session.data?.id;

  const isHumanRole =
    session.data &&
    ['ADMIN', 'SELLER', 'CUSTOMER', 'OPERATIONS_MANAGER', 'TECHNICIAN', 'SELLER_STAFF'].includes(
      session.data.role,
    );

  const profile = useQuery({
    queryKey: ['account-profile', session.data?.id],
    queryFn: getAccountProfile,
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
      gender: '',
      dateOfBirth: '',
    },
  });

  // Preserve unsaved draft: only populate from profile data when form is untouched / pristine
  useEffect(() => {
    if (profile.data && !basicForm.formState.isDirty) {
      basicForm.reset(basicValues(profile.data));
    }
  }, [profile.data, basicForm]);

  // Contact email state
  const [contactMode, setContactMode] = useState<ContactMode>('idle');
  const [targetContactEmail, setTargetContactEmail] = useState('');
  const [contactChallenge, setContactChallenge] = useState<ContactEmailChallenge | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [contactSending, setContactSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [contactResetting, setContactResetting] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [otpRemaining, setOtpRemaining] = useState(0);
  const [otpTiming, setOtpTiming] = useState<{ expiresAt: number; resendAt: number } | null>(null);
  const [contactNotice, setContactNotice] = useState('');
  const [contactError, setContactError] = useState('');

  // Bank section state
  const [bankMode, setBankMode] = useState<BankMode>('idle');
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
  const profileSaving = basicSaving || bankSaving || clearingBank;

  // Security section state (Customer & Seller only)
  const isMember = Boolean(session.data && ['CUSTOMER', 'SELLER'].includes(session.data.role));
  const passwords = useForm<{ currentPassword: string; newPassword: string; confirm: string }>({
    mode: 'onBlur',
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const bankDirty =
    bankMode === 'review' ||
    (bankMode === 'edit' &&
      (bankValues.accountNumber !== '' ||
        bankValues.bankName !== (profile.data?.bank?.bankName ?? '') ||
        bankValues.accountHolder !== (profile.data?.bank?.accountHolder ?? '')));
  const draftGuard = useProfileDraftGuard(
    basicForm.formState.isDirty ||
      passwords.formState.isDirty ||
      bankDirty ||
      targetContactEmail.trim() !== '' ||
      contactMode === 'otp',
  );
  const { activeSection, setActiveSection } = useProfileNavigation(profile.isSuccess);

  const handleChangePassword = async (values: {
    currentPassword: string;
    newPassword: string;
    confirm: string;
  }) => {
    if (passwordSaving) return;
    setPasswordSaving(true);
    setPasswordError('');
    try {
      await changeMemberPassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      if (!isCurrentIdentity()) return;
      passwords.reset();
      draftGuard.allowLeave();
      queryClient.clear();
      window.location.replace('/dang-nhap');
    } catch (cause) {
      if (!isCurrentIdentity()) return;
      setPasswordError(
        cause instanceof ApiError
          ? cause.message
          : 'Chưa xác nhận được thay đổi. Hãy tải lại để kiểm tra.',
      );
    } finally {
      setPasswordSaving(false);
    }
  };

  // Logout state
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  // Identity-scoped revealed account number (automatically null if session changes)
  const revealedAccountNumber =
    revealedData && session.data?.id && revealedData.userId === session.data.id
      ? revealedData.accountNumber
      : null;

  // Deadlines survive background-tab timer throttling and use BE-provided expiry.
  useEffect(() => {
    if (contactMode !== 'otp' || !otpTiming) return;
    const update = () => {
      setResendCountdown(Math.max(0, Math.ceil((otpTiming.resendAt - Date.now()) / 1000)));
      setOtpRemaining(Math.max(0, Math.ceil((otpTiming.expiresAt - Date.now()) / 1000)));
    };
    update();
    const interval = setInterval(update, 1000);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', update);
    };
  }, [contactMode, otpTiming]);

  useEffect(() => {
    if (!revealedData) return;
    const timer = setTimeout(() => {
      revealVersion.current++;
      setRevealedData(null);
    }, 60_000);
    return () => clearTimeout(timer);
  }, [revealedData]);

  // Bank security: clear revealed account number on tab hiding or unmount
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        revealVersion.current++;
        setRevealedData(null);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
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
    if (profileSaving) return;
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

    if (values.gender && !['MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED'].includes(values.gender)) {
      setBasicError('Vui lòng chọn giới tính trong danh sách.');
      setBasicSaving(false);
      return;
    }
    if (!validBirthDate(values.dateOfBirth)) {
      setBasicError('Ngày sinh không hợp lệ hoặc sau ngày hiện tại theo giờ Việt Nam.');
      basicForm.setFocus('dateOfBirth');
      setBasicSaving(false);
      return;
    }

    const payload = basicPayload(values);

    try {
      const updated = await updateAccountProfile(payload);
      if (!isCurrentIdentity()) return;
      queryClient.setQueryData(['account-profile', session.data?.id], updated);
      queryClient.setQueryData(['session'], (old: Session | undefined) =>
        old ? { ...old, name: updated.fullName } : old,
      );
      void queryClient.invalidateQueries({ queryKey: ['account-profile'] });
      void queryClient.invalidateQueries({ queryKey: ['member-profile'] });

      basicForm.reset(basicValues(updated));
      setBasicNotice('Đã lưu thay đổi hồ sơ cá nhân.');
    } catch (cause) {
      if (!isCurrentIdentity()) return;
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
      const challenge = await requestContactEmailChallenge(email);
      if (!isCurrentIdentity()) return;
      setContactChallenge(challenge);
      setOtpTiming({
        expiresAt: Date.now() + challenge.expiresInSeconds * 1000,
        resendAt: Date.now() + challenge.resendAfterSeconds * 1000,
      });
      setContactMode('otp');
      setOtpCode('');
      setContactNotice(
        challenge.message ||
          `Đã gửi mã xác thực tới ${email}. Vui lòng kiểm tra hộp thư để lấy mã OTP.`,
      );
    } catch (cause) {
      if (!isCurrentIdentity()) return;
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
    if (otpVerifying || contactSending || !contactChallenge || otpRemaining <= 0) return;
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
      const updated = await verifyContactEmail(contactChallenge.challengeId, code);
      if (!isCurrentIdentity()) return;
      queryClient.setQueryData(['account-profile', session.data?.id], updated);
      void queryClient.invalidateQueries({ queryKey: ['account-profile'] });
      setContactMode('idle');
      setContactChallenge(null);
      setTargetContactEmail('');
      setOtpCode('');
      setContactNotice('Email liên hệ mới đã được xác thực và áp dụng thành công.');
    } catch (cause) {
      if (!isCurrentIdentity()) return;
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
    if (contactSending || otpVerifying || resendCountdown > 0 || !targetContactEmail) return;
    setContactSending(true);
    setContactError('');
    setContactNotice('');
    try {
      const challenge = await requestContactEmailChallenge(targetContactEmail.trim());
      if (!isCurrentIdentity()) return;
      setContactChallenge(challenge);
      setOtpTiming({
        expiresAt: Date.now() + challenge.expiresInSeconds * 1000,
        resendAt: Date.now() + challenge.resendAfterSeconds * 1000,
      });
      setOtpCode('');
      setContactNotice(`Đã gửi lại mã xác thực mới tới ${targetContactEmail.trim()}.`);
    } catch (cause) {
      if (!isCurrentIdentity()) return;
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
      const updated = await resetContactEmail();
      if (!isCurrentIdentity()) return;
      queryClient.setQueryData(['account-profile', session.data?.id], updated);
      void queryClient.invalidateQueries({ queryKey: ['account-profile'] });
      setContactMode('idle');
      setContactChallenge(null);
      setTargetContactEmail('');
      setOtpCode('');
      setContactNotice('Đã khôi phục email liên hệ về email đăng nhập mặc định.');
    } catch (cause) {
      if (!isCurrentIdentity()) return;
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
    const version = ++revealVersion.current;
    try {
      const res = await revealBank();
      if (!isCurrentIdentity() || version !== revealVersion.current || document.hidden) return;
      setRevealedData({ userId: session.data?.id ?? '', accountNumber: res.accountNumber });
    } catch (cause) {
      if (!isCurrentIdentity() || version !== revealVersion.current) return;
      setBankError(
        cause instanceof ApiError ? cause.message : 'Chưa lấy được thông tin số tài khoản.',
      );
    } finally {
      setRevealingBank(false);
    }
  };

  // Bank: Start editing
  const handleStartEditBank = () => {
    revealVersion.current++;
    setRevealedData(null);
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
    if (profileSaving) return;
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
      const updated = await updateAccountProfile(payload);
      if (!isCurrentIdentity()) return;
      queryClient.setQueryData(['account-profile', session.data?.id], updated);
      void queryClient.invalidateQueries({ queryKey: ['account-profile'] });
      setBankValues({ bankName: '', accountHolder: '', accountNumber: '' });
      setBankMode('idle');
      setRevealedData(null);
      setBankNotice('Đã lưu thông tin tài khoản ngân hàng cá nhân.');
    } catch (cause) {
      if (!isCurrentIdentity()) return;
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
    if (profileSaving) return;
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
      const updated = await updateAccountProfile(payload);
      if (!isCurrentIdentity()) return;
      queryClient.setQueryData(['account-profile', session.data?.id], updated);
      void queryClient.invalidateQueries({ queryKey: ['account-profile'] });
      setBankMode('idle');
      setRevealedData(null);
      setBankNotice('Đã xóa thông tin tài khoản ngân hàng cá nhân.');
    } catch (cause) {
      if (!isCurrentIdentity()) return;
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
      <div className="profile-page profile-refined">
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
              <span className="profile-eyebrow">HỒ SƠ CÁ NHÂN</span>
              <h1>{currentProfile.fullName || 'Hồ sơ người dùng'}</h1>
              <p>Thông tin của bạn, luôn trong tầm tay.</p>
            </div>
          </div>
          <span className="profile-badge profile-badge-neutral">{roleLabel}</span>
        </header>

        {/* Quick navigation anchor chips */}
        <div className="profile-layout">
          <nav aria-label="Mục hồ sơ" className="profile-quick-nav">
            <span className="profile-nav-caption">QUẢN LÝ HỒ SƠ</span>
            {profileSections.map(([id, label], index) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={() => setActiveSection(id)}
                aria-current={activeSection === id ? 'location' : undefined}
              >
                <span className="profile-nav-number" aria-hidden="true">
                  0{index + 1}
                </span>
                {label}
              </a>
            ))}
            <p className="profile-nav-note">
              Chỉ bạn và người có thẩm quyền mới được truy cập hồ sơ này.
            </p>
          </nav>
          <div className="profile-content">
            {/* Section 1: Read-only Login Identity & Role */}
            <section
              aria-labelledby="identity-heading"
              className="profile-section profile-identity"
            >
              <div className="profile-section-heading">
                <h2 id="identity-heading">Định danh tài khoản đăng nhập</h2>
                <p>Email dùng để đăng nhập, chỉ xem tại đây.</p>
              </div>
              <dl className="profile-summary-grid">
                <div className="profile-summary-item">
                  <dt>Email đăng nhập</dt>
                  <dd>{currentProfile.loginEmail || 'Chưa thiết lập'}</dd>
                </div>
              </dl>
            </section>

            {/* Section 2: Editable Basic Form (fullName, phone, address) */}
            <section aria-labelledby="basic-info-heading" className="profile-section">
              <div className="profile-section-heading">
                <h2 id="basic-info-heading">Thông tin cá nhân</h2>
                <p>Cập nhật thông tin để shop và đội ngũ FloraBot hỗ trợ bạn chính xác hơn.</p>
              </div>

              {basicNotice && !basicForm.formState.isDirty && (
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
                onSubmit={(event) => void basicForm.handleSubmit(onSaveBasic)(event)}
                className="profile-form profile-basic-form"
                aria-busy={basicSaving}
              >
                <div className="profile-form-group">
                  <label htmlFor="profile-full-name">Họ và tên *</label>
                  <input
                    id="profile-full-name"
                    type="text"
                    autoComplete="name"
                    maxLength={100}
                    disabled={profileSaving}
                    {...basicForm.register('fullName')}
                    aria-invalid={!!basicError && basicError.includes('Họ và tên')}
                    aria-describedby="profile-full-name-hint"
                  />
                  <p id="profile-full-name-hint" className="profile-form-hint">
                    Từ 2–100 ký tự.
                  </p>
                </div>

                <div className="profile-form-group">
                  <label htmlFor="profile-phone">Số điện thoại</label>
                  <input
                    id="profile-phone"
                    type="tel"
                    autoComplete="tel"
                    maxLength={15}
                    disabled={profileSaving}
                    {...basicForm.register('phone')}
                    aria-invalid={!!basicError && basicError.includes('Số điện thoại')}
                    aria-describedby="profile-phone-hint"
                  />
                  <p id="profile-phone-hint" className="profile-form-hint">
                    Ví dụ: 0901234567 hoặc +84901234567.
                  </p>
                </div>

                <div className="profile-form-group profile-field-wide">
                  <label htmlFor="profile-address">Địa chỉ</label>
                  <textarea
                    id="profile-address"
                    autoComplete="street-address"
                    maxLength={300}
                    rows={2}
                    disabled={profileSaving}
                    {...basicForm.register('address')}
                    aria-invalid={!!basicError && basicError.includes('Địa chỉ')}
                    aria-describedby="profile-address-hint"
                  />
                  <p id="profile-address-hint" className="profile-form-hint">
                    Địa chỉ tối đa 300 ký tự.
                  </p>
                </div>

                <div className="profile-form-columns profile-field-wide">
                  <div className="profile-form-group">
                    <label htmlFor="profile-gender">Giới tính</label>
                    <select
                      id="profile-gender"
                      disabled={profileSaving}
                      {...basicForm.register('gender')}
                    >
                      <option value="">Chưa cung cấp</option>
                      <option value="MALE">Nam</option>
                      <option value="FEMALE">Nữ</option>
                      <option value="OTHER">Khác</option>
                      <option value="UNDISCLOSED">Không muốn chia sẻ</option>
                    </select>
                  </div>
                  <div className="profile-form-group">
                    <label htmlFor="profile-date-of-birth">Ngày sinh</label>
                    <input
                      id="profile-date-of-birth"
                      type="date"
                      autoComplete="bday"
                      min="0001-01-01"
                      max={vietnamToday()}
                      disabled={profileSaving}
                      {...basicForm.register('dateOfBirth')}
                      aria-invalid={!!basicError && basicError.includes('Ngày sinh')}
                      aria-describedby="profile-birth-hint"
                    />
                    <p id="profile-birth-hint" className="profile-form-hint">
                      Không bắt buộc. Có thể để trống.
                    </p>
                  </div>
                </div>
                <div className="profile-actions profile-save-row profile-field-wide">
                  <span className="profile-draft-status" role="status">
                    {basicForm.formState.isDirty ? 'Có thay đổi chưa lưu' : 'Chưa có thay đổi mới'}
                  </span>
                  <Button type="submit" disabled={profileSaving}>
                    {basicSaving ? 'Đang lưu…' : 'Lưu thông tin cá nhân'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={profileSaving || !basicForm.formState.isDirty}
                    onClick={() => {
                      basicForm.reset(basicValues(currentProfile));
                      setBasicError('');
                      setBasicNotice('');
                    }}
                  >
                    Hủy thay đổi
                  </Button>
                </div>
              </form>
            </section>

            {/* Section 3: Verified Contact Email Section */}
            <section aria-labelledby="contact-email-heading" className="profile-section">
              <div className="profile-section-heading">
                <h2 id="contact-email-heading">Email liên hệ nhận thông báo</h2>
                <p>Nhận thông báo đơn hàng và dịch vụ tại địa chỉ bạn thường dùng.</p>
              </div>

              <div className="profile-disclaimer-card">
                Đổi email liên hệ cần xác thực OTP và không làm thay đổi email đăng nhập.
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
                      {contactResetting
                        ? 'Đang khôi phục…'
                        : 'Khôi phục về email đăng nhập mặc định'}
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
                      Nhập mã OTP gồm 6 chữ số đã được gửi tới <strong>{targetContactEmail}</strong>
                      .
                    </p>
                    {otpRemaining > 0 ? (
                      <p>
                        Mã còn hiệu lực {Math.floor(otpRemaining / 60)} phút {otpRemaining % 60}{' '}
                        giây.
                      </p>
                    ) : (
                      <p role="status" className="profile-status-message profile-status-error">
                        Mã OTP đã hết hạn. Hãy gửi lại mã mới để tiếp tục.
                      </p>
                    )}
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
                        disabled={otpVerifying || contactSending || otpRemaining <= 0}
                        placeholder="••••••"
                        className="profile-otp-input"
                        required
                      />
                    </div>
                    <div className="profile-actions">
                      <Button
                        type="submit"
                        disabled={
                          otpVerifying ||
                          contactSending ||
                          otpRemaining <= 0 ||
                          otpCode.length !== 6
                        }
                      >
                        {otpVerifying ? 'Đang xác thực…' : 'Xác nhận mã OTP'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={resendCountdown > 0 || contactSending || otpVerifying}
                        onClick={() => void handleResendOtp()}
                      >
                        {resendCountdown > 0 ? `Gửi lại sau ${resendCountdown}s` : 'Gửi lại mã OTP'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={otpVerifying || contactSending}
                        onClick={() => {
                          setContactMode('idle');
                          setContactChallenge(null);
                          setOtpTiming(null);
                          setTargetContactEmail('');
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
                <p>Thêm tài khoản để hỗ trợ hoàn tiền hoặc đối soát khi cần.</p>
              </div>

              <div className="profile-disclaimer-card">
                {role === 'SELLER'
                  ? 'Tài khoản cá nhân này độc lập với tài khoản nhận tiền trong Ví shop.'
                  : 'Thông tin được che khi hiển thị. Hãy kiểm tra chính xác trước khi lưu.'}
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
              {currentProfile.bank?.status === 'NEEDS_UPDATE' && (
                <p role="status" className="profile-status-message profile-status-error">
                  Thông tin ngân hàng đã lưu chưa đọc được. Vui lòng cập nhật lại tài khoản để sử
                  dụng.
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
                                  onClick={() => {
                                    revealVersion.current++;
                                    setRevealedData(null);
                                  }}
                                  aria-label="Ẩn số tài khoản"
                                >
                                  <EyeOff size={16} aria-hidden="true" />
                                  Ẩn số tài khoản
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  disabled={
                                    revealingBank ||
                                    profileSaving ||
                                    currentProfile.bank.status === 'NEEDS_UPDATE'
                                  }
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
                        <Button
                          variant="outline"
                          disabled={profileSaving}
                          onClick={handleStartEditBank}
                        >
                          Đổi tài khoản ngân hàng
                        </Button>
                        <Button
                          variant="outline"
                          disabled={profileSaving}
                          onClick={() => {
                            revealVersion.current++;
                            setRevealedData(null);
                            setBankMode('clear-confirm');
                          }}
                        >
                          Xóa tài khoản ngân hàng
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="profile-bank-details">
                      <p>Bạn chưa lưu thông tin tài khoản ngân hàng cá nhân.</p>
                      <div className="profile-actions">
                        <Button
                          variant="outline"
                          disabled={profileSaving}
                          onClick={handleStartEditBank}
                        >
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
                      onChange={(e) =>
                        setBankValues((prev) => ({ ...prev, bankName: e.target.value }))
                      }
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
                    FloraBot chưa xác minh thông tin này với ngân hàng. Bạn cần kiểm tra chính xác
                    trước khi lưu.
                  </p>
                  <div className="profile-actions">
                    <Button disabled={profileSaving} onClick={() => void handleSaveBank()}>
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

            {/* Section 5: Security & Google Linking (Customer and Seller only) */}
            {isMember && (
              <section id="security" aria-labelledby="security-heading" className="profile-section">
                <div className="profile-section-heading">
                  <h2 id="security-heading">Bảo mật tài khoản</h2>
                  <p>Quản lý mật khẩu và phương thức đăng nhập.</p>
                </div>

                <div className="profile-disclaimer-card">
                  Đổi mật khẩu sẽ đăng xuất các phiên hiện tại.
                </div>
                <p className="profile-form-hint">
                  Mật khẩu mới cần ít nhất 12 ký tự và tối đa 72 byte UTF-8.
                </p>

                {passwordError && (
                  <p role="alert" className="profile-status-message profile-status-error">
                    {passwordError}
                  </p>
                )}

                <form
                  noValidate
                  className="profile-form"
                  aria-busy={passwordSaving}
                  onSubmit={(event) => void passwords.handleSubmit(handleChangePassword)(event)}
                >
                  {(['currentPassword', 'newPassword', 'confirm'] as const).map((field, index) => (
                    <div key={field} className="profile-form-group">
                      <label htmlFor={`security-${field}`}>
                        {['Mật khẩu hiện tại', 'Mật khẩu mới', 'Nhập lại mật khẩu mới'][index]}
                      </label>
                      <div className="profile-password-field">
                        <input
                          id={`security-${field}`}
                          type={visiblePasswords[field] ? 'text' : 'password'}
                          autoComplete={index === 0 ? 'current-password' : 'new-password'}
                          disabled={passwordSaving}
                          {...passwords.register(field, {
                            required: 'Nhập mật khẩu.',
                            validate:
                              index === 1
                                ? passwordRule
                                : index === 2
                                  ? (value) =>
                                      value === passwords.getValues('newPassword') ||
                                      'Hai mật khẩu chưa khớp.'
                                  : undefined,
                          })}
                          aria-describedby={
                            passwords.formState.errors[field]
                              ? `security-${field}-error`
                              : undefined
                          }
                          aria-invalid={!!passwords.formState.errors[field]}
                        />
                        <button
                          type="button"
                          className="profile-password-toggle"
                          disabled={passwordSaving}
                          aria-label={`${visiblePasswords[field] ? 'Ẩn' : 'Hiện'} ${['mật khẩu hiện tại', 'mật khẩu mới', 'nhập lại mật khẩu mới'][index]}`}
                          aria-pressed={!!visiblePasswords[field]}
                          onClick={() =>
                            setVisiblePasswords((previous) => ({
                              ...previous,
                              [field]: !previous[field],
                            }))
                          }
                        >
                          {visiblePasswords[field] ? (
                            <EyeOff size={18} aria-hidden="true" />
                          ) : (
                            <Eye size={18} aria-hidden="true" />
                          )}
                        </button>
                      </div>
                      {passwords.formState.errors[field] && (
                        <p id={`security-${field}-error`} className="profile-field-error">
                          {passwords.formState.errors[field]?.message}
                        </p>
                      )}
                    </div>
                  ))}
                  <div className="profile-actions">
                    <Button type="submit" disabled={passwordSaving}>
                      {passwordSaving ? 'Đang cập nhật…' : 'Đổi mật khẩu và đăng nhập lại'}
                    </Button>
                  </div>
                </form>

                <div
                  style={{
                    marginTop: '2rem',
                    paddingTop: '1.5rem',
                    borderTop: '1px solid #e1ebe0',
                  }}
                >
                  <GoogleAccountLink email={currentProfile.loginEmail || ''} />
                </div>
              </section>
            )}
            {!isMember && (
              <section id="security" aria-labelledby="security-heading" className="profile-section">
                <div className="profile-section-heading">
                  <h2 id="security-heading">Bảo mật tài khoản</h2>
                  <p>
                    Để đổi mật khẩu tài khoản {roleLabel.toLowerCase()}, vui lòng liên hệ quản trị
                    viên FloraBot.
                  </p>
                </div>
              </section>
            )}
          </div>
        </div>
        <Modal
          open={draftGuard.pending}
          title="Bạn có thay đổi chưa lưu"
          description="Rời trang sẽ bỏ phần thông tin bạn đang chỉnh sửa."
          onClose={draftGuard.cancel}
        >
          <div className="profile-leave-actions">
            <Button type="button" onClick={draftGuard.cancel}>
              Tiếp tục chỉnh sửa
            </Button>
            <Button type="button" variant="outline" onClick={draftGuard.confirm}>
              Rời trang
            </Button>
          </div>
        </Modal>
      </div>
    </main>
  );
}
