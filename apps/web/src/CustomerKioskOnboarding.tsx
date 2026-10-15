'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Button,
  CircleAlert,
  Check,
  RefreshCw,
  MapPin,
  Banknote,
  ArrowRight,
  Store,
  Boxes,
  X,
} from '@florabot/ui';
import { ApiError, queryClient, request, sessionQuery, type Session } from './api';
import KioskPickerMap from './KioskPickerMap';
import { isValidLatitude, isValidLongitude } from './kioskTypes';
import type {
  KioskPackageResponse,
  KioskApplicationResponse,
  CreateKioskApplicationRequest,
  PaymentLinkResponse,
} from './kioskApplicationTypes';
import {
  KIOSK_STATUS_LABELS,
  validatePayosCheckoutUrl,
  parseAndValidateCoordinate,
} from './kioskApplicationTypes';
import './kiosk-onboarding.css';

const PHONE_REGEX = /^(0[35789][0-9]{8}|\+84[35789][0-9]{8})$/;
const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function CustomerKioskContent({
  sessionData,
  isPending,
}: {
  sessionData: Session | undefined;
  isPending: boolean;
}) {
  const router = useRouter();

  // Load packages from GET /api/kiosk-packages (real server data, no silent mock fallback)
  const packagesQuery = useQuery({
    queryKey: ['kiosk-packages'],
    queryFn: () => request<KioskPackageResponse[]>('/kiosk-packages'),
  });

  // Current application query scoped by authenticated identity
  const applicationQuery = useQuery({
    queryKey: ['current-kiosk-application', sessionData?.id],
    queryFn: async () => {
      try {
        return await request<KioskApplicationResponse>('/member/kiosk-applications/current');
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          return null;
        }
        throw err;
      }
    },
    enabled: !!sessionData,
  });

  // Form State
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [shopName, setShopName] = useState('');
  const [phone, setPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [installationAddress, setInstallationAddress] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [latInput, setLatInput] = useState('');
  const [lonInput, setLonInput] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankHolder, setBankHolder] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');

  // UI interaction states
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsMessage, setGpsMessage] = useState('');

  // Cancel dialog state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');

  // Payment link state (fail-closed, no auto fallback navigation)
  const [validatedCheckoutUrl, setValidatedCheckoutUrl] = useState<string | null>(null);
  const [paymentLinkError, setPaymentLinkError] = useState('');
  const [reconcileNotice, setReconcileNotice] = useState('');
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshingSession, setRefreshingSession] = useState(false);

  const errorBannerRef = useRef<HTMLDivElement>(null);

  // Sync inputs when map changes
  const handleLocationSelect = useCallback((lat: number, lon: number) => {
    setLatitude(lat);
    setLongitude(lon);
    setLatInput(lat.toFixed(6));
    setLonInput(lon.toFixed(6));
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next.coordinates;
      return next;
    });
  }, []);

  const handleLatInputChange = (val: string) => {
    setLatInput(val);
    const parsed = parseAndValidateCoordinate(val, 'lat');
    if (parsed.valid && parsed.value !== null) {
      setLatitude(parsed.value);
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next.coordinates;
        return next;
      });
    } else {
      // Invalidate immediately so stale coordinate is NEVER submitted!
      setLatitude(null);
    }
  };

  const handleLonInputChange = (val: string) => {
    setLonInput(val);
    const parsed = parseAndValidateCoordinate(val, 'lon');
    if (parsed.valid && parsed.value !== null) {
      setLongitude(parsed.value);
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next.coordinates;
        return next;
      });
    } else {
      // Invalidate immediately so stale coordinate is NEVER submitted!
      setLongitude(null);
    }
  };

  const requestGps = () => {
    if (!navigator.geolocation) {
      setGpsMessage('Trình duyệt không hỗ trợ định vị GPS.');
      return;
    }
    setGpsLoading(true);
    setGpsMessage('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        if (isValidLatitude(lat) && isValidLongitude(lon)) {
          handleLocationSelect(lat, lon);
          setGpsMessage('Đã lấy tọa độ hiện tại.');
        } else {
          setGpsMessage('Tọa độ nhận được không hợp lệ.');
        }
      },
      (err) => {
        setGpsLoading(false);
        setGpsMessage(
          err.code === 1
            ? 'Bạn đã từ chối quyền truy cập vị trí.'
            : 'Không thể xác định vị trí hiện tại. Bạn có thể chọn trên bản đồ hoặc nhập tay.',
        );
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  };

  // Submit application mutation
  const applyMutation = useMutation({
    mutationFn: (data: CreateKioskApplicationRequest) =>
      request<KioskApplicationResponse>('/member/kiosk-applications', data),
    onSuccess: (created) => {
      setSubmitError('');
      setFormErrors({});
      queryClient.setQueryData(['current-kiosk-application', sessionData?.id], created);
      void queryClient.invalidateQueries({
        queryKey: ['current-kiosk-application', sessionData?.id],
      });
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setSubmitError(
            'Bạn đã có một hồ sơ thuê kiosk đang được xử lý hoặc tài khoản đã là Chủ shop.',
          );
        } else {
          setSubmitError(err.message);
        }
      } else {
        setSubmitError(
          'Không thể gửi hồ sơ lúc này. Dữ liệu đã nhập được giữ nguyên, vui lòng thử lại.',
        );
      }
      errorBannerRef.current?.focus();
    },
  });

  // Get payment link mutation (fail-closed security validation)
  const paymentLinkMutation = useMutation({
    mutationFn: (applicationId: string) =>
      request<PaymentLinkResponse>(`/member/kiosk-applications/${applicationId}/payment-link`, {}),
    onSuccess: (data) => {
      setPaymentLinkError('');
      const validation = validatePayosCheckoutUrl(data.checkoutUrl);
      if (validation.valid && validation.url) {
        setValidatedCheckoutUrl(validation.url);
      } else {
        setValidatedCheckoutUrl(null);
        setPaymentLinkError(
          validation.error || 'Địa chỉ thanh toán payOS không thuộc máy chủ được cấp phép.',
        );
      }
    },
    onError: (err) => {
      setValidatedCheckoutUrl(null);
      if (err instanceof ApiError) {
        if (err.status === 503) {
          setPaymentLinkError(
            'Cổng thanh toán payOS đang bảo trì hoặc chưa được cấu hình (mã 503). Vui lòng thử lại sau hoặc liên hệ hỗ trợ.',
          );
        } else if (err.status === 502) {
          setPaymentLinkError(
            'Không kết nối được với cổng thanh toán payOS (mã 502). Vui lòng thử lại sau ít phút.',
          );
        } else {
          setPaymentLinkError(err.message);
        }
      } else {
        setPaymentLinkError('Lỗi kết nối khi tạo liên kết thanh toán. Vui lòng thử lại.');
      }
    },
  });

  // Reconcile payment mutation (dynamic status message)
  const reconcileMutation = useMutation({
    mutationFn: (applicationId: string) =>
      request<KioskApplicationResponse>(
        `/member/kiosk-applications/${applicationId}/reconcile`,
        {},
      ),
    onSuccess: (updated) => {
      const status = updated.status;
      if (status === 'PAID_REVIEW') {
        setReconcileNotice(
          'Đã xác nhận thanh toán thành công qua cổng thanh toán! Hồ sơ đã chuyển sang Chờ xem xét.',
        );
      } else if (status === 'REFUND_PENDING') {
        setReconcileNotice(
          'Giao dịch thanh toán đến muộn sau khi hồ sơ đã hủy. Khoản phí đã được chuyển sang quy trình hoàn tiền.',
        );
      } else {
        setReconcileNotice(
          `Trạng thái hồ sơ sau đối soát: ${KIOSK_STATUS_LABELS[status] || status}.`,
        );
      }
      queryClient.setQueryData(['current-kiosk-application', sessionData?.id], updated);
      void queryClient.invalidateQueries({
        queryKey: ['current-kiosk-application', sessionData?.id],
      });
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setReconcileNotice(
            'Giao dịch chưa hoàn tất trên cổng thanh toán hoặc đã được xử lý trước đó.',
          );
        } else {
          setReconcileNotice(err.message);
        }
      } else {
        setReconcileNotice('Chưa đối soát được giao dịch máy chủ. Vui lòng thử lại.');
      }
    },
  });

  // Cancel application mutation
  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      request<KioskApplicationResponse>(`/member/kiosk-applications/${id}/cancel`, { reason }),
    onSuccess: (updated) => {
      setCancelDialogOpen(false);
      setCancelReason('');
      setCancelError('');
      queryClient.setQueryData(['current-kiosk-application', sessionData?.id], updated);
      void queryClient.invalidateQueries({
        queryKey: ['current-kiosk-application', sessionData?.id],
      });
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setCancelError(err.message);
      } else {
        setCancelError('Chưa hủy được hồ sơ. Vui lòng thử lại.');
      }
    },
  });

  // Handover refresh session: POST /auth/refresh then GET /auth/me, require SELLER + sellerId
  const handleActiveSessionRefresh = async () => {
    setRefreshingSession(true);
    setRefreshError(null);
    try {
      const refreshRes = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        signal: AbortSignal.timeout(15000),
      });
      if (!refreshRes.ok) {
        throw new Error('Không thể làm mới phiên làm việc.');
      }
      const me = await request<Session>('/auth/me');
      if (me.role === 'SELLER' && me.sellerId) {
        queryClient.clear();
        queryClient.setQueryData(['session'], me);
        router.push('/seller/products');
      } else {
        setRefreshError(
          'Hệ thống chưa ghi nhận quyền Chủ shop trên máy chủ. Bạn vui lòng đăng nhập lại để cập nhật phiên làm việc.',
        );
      }
    } catch {
      setRefreshError(
        'Không thể làm mới phiên đăng nhập tự động. Vui lòng đăng nhập lại để truy cập không gian Chủ shop.',
      );
    } finally {
      setRefreshingSession(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!selectedPackageId) {
      errors.package = 'Vui lòng chọn một gói thuê kiosk.';
    }

    const trimmedShopName = shopName.trim();
    if (!trimmedShopName) {
      errors.shopName = 'Vui lòng nhập tên shop hoa.';
    } else if (trimmedShopName.length < 2) {
      errors.shopName = 'Tên shop phải có ít nhất 2 ký tự.';
    } else if (trimmedShopName.length > 120) {
      errors.shopName = 'Tên shop không được vượt quá 120 ký tự.';
    }

    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      errors.phone = 'Vui lòng nhập số điện thoại kinh doanh.';
    } else if (!PHONE_REGEX.test(trimmedPhone)) {
      errors.phone = 'Số điện thoại không đúng định dạng Việt Nam (ví dụ: 0901234567).';
    }

    const trimmedEmail = contactEmail.trim();
    if (!trimmedEmail) {
      errors.contactEmail = 'Vui lòng nhập email liên hệ công việc.';
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      errors.contactEmail = 'Email không đúng định dạng.';
    } else if (trimmedEmail.length > 254) {
      errors.contactEmail = 'Email không được vượt quá 254 ký tự.';
    }

    const trimmedAddress = installationAddress.trim();
    if (!trimmedAddress) {
      errors.installationAddress = 'Vui lòng nhập địa chỉ dự kiến đặt kiosk.';
    } else if (trimmedAddress.length < 5) {
      errors.installationAddress =
        'Địa chỉ lắp đặt quá ngắn, vui lòng ghi rõ số nhà, đường, phường/xã.';
    }

    // Coordinates check: parse current text directly; blank is NOT zero!
    const latResult = parseAndValidateCoordinate(latInput, 'lat');
    const lonResult = parseAndValidateCoordinate(lonInput, 'lon');

    if (
      !latResult.valid ||
      !lonResult.valid ||
      latResult.value === null ||
      lonResult.value === null
    ) {
      errors.coordinates =
        latResult.error ||
        lonResult.error ||
        'Vui lòng ghim vị trí trên bản đồ hoặc nhập tọa độ vĩ độ/kinh độ hợp lệ (ô trống không đồng nghĩa với 0).';
    }

    const trimmedBankName = bankName.trim();
    if (!trimmedBankName) {
      errors.bankName = 'Vui lòng nhập tên ngân hàng.';
    } else if (trimmedBankName.length < 2) {
      errors.bankName = 'Tên ngân hàng cần ít nhất 2 ký tự.';
    }

    const trimmedBankHolder = bankHolder.trim();
    if (!trimmedBankHolder) {
      errors.bankHolder = 'Vui lòng nhập tên chủ tài khoản thụ hưởng.';
    } else if (trimmedBankHolder.length < 2) {
      errors.bankHolder = 'Tên chủ tài khoản cần ít nhất 2 ký tự.';
    }

    const trimmedAccountNumber = bankAccountNumber.trim();
    if (!trimmedAccountNumber) {
      errors.bankAccountNumber = 'Vui lòng nhập số tài khoản ngân hàng.';
    } else if (trimmedAccountNumber.length < 4) {
      errors.bankAccountNumber = 'Số tài khoản cần ít nhất 4 ký tự.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const latResult = parseAndValidateCoordinate(latInput, 'lat');
    const lonResult = parseAndValidateCoordinate(lonInput, 'lon');
    if (
      !latResult.valid ||
      !lonResult.valid ||
      latResult.value === null ||
      lonResult.value === null
    ) {
      return;
    }

    applyMutation.mutate({
      packageId: selectedPackageId,
      shopName: shopName.trim(),
      phone: phone.trim(),
      contactEmail: contactEmail.trim(),
      installationAddress: installationAddress.trim(),
      latitude: latResult.value,
      longitude: lonResult.value,
      bankName: bankName.trim(),
      bankHolder: bankHolder.trim(),
      bankAccountNumber: bankAccountNumber.trim(),
    });
  };

  // Rendering Loading & Error for page
  if (isPending || (sessionData && applicationQuery.isLoading)) {
    return (
      <main id="main" className="kiosk-onboarding-container">
        <p role="status" className="kiosk-status-loading">
          <RefreshCw className="spin" size={18} aria-hidden="true" />
          Đang tải thông tin thuê kiosk...
        </p>
      </main>
    );
  }

  if (!sessionData) {
    return (
      <main id="main" className="kiosk-onboarding-container">
        <header className="kiosk-onboarding-header">
          <nav className="kiosk-breadcrumb" aria-label="Đường dẫn">
            <Link href="/tai-khoan">Tài khoản của tôi</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Thuê Kiosk</span>
          </nav>
          <h1>Đăng ký thuê Kiosk hoa thông minh</h1>
        </header>
        <div role="alert" className="kiosk-field-error-banner">
          <CircleAlert size={20} aria-hidden="true" />
          <div>
            <h3>Bạn chưa đăng nhập</h3>
            <p>Vui lòng đăng nhập với tài khoản khách hàng để đăng ký thuê kiosk hoa.</p>
            <div style={{ marginTop: '0.75rem' }}>
              <Link href="/dang-nhap" className="button button-primary">
                Đăng nhập
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (sessionData.role !== 'CUSTOMER' && sessionData.role !== 'SELLER') {
    return (
      <main id="main" className="kiosk-onboarding-container">
        <header className="kiosk-onboarding-header">
          <nav className="kiosk-breadcrumb" aria-label="Đường dẫn">
            <Link href="/tai-khoan">Tài khoản của tôi</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Thuê Kiosk</span>
          </nav>
          <h1>Đăng ký thuê Kiosk hoa thông minh</h1>
        </header>
        <div role="alert" className="kiosk-field-error-banner">
          <CircleAlert size={20} aria-hidden="true" />
          <div>
            <h3>Không có quyền truy cập</h3>
            <p>
              Trang đăng ký thuê kiosk chỉ dành cho tài khoản Khách hàng (hoặc Chủ shop đã kích
              hoạt).
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (applicationQuery.isError) {
    const error = applicationQuery.error;
    const is403 = error instanceof ApiError && error.status === 403;
    const is401 = error instanceof ApiError && error.status === 401;

    return (
      <main id="main" className="kiosk-onboarding-container">
        <header className="kiosk-onboarding-header">
          <nav className="kiosk-breadcrumb" aria-label="Đường dẫn">
            <Link href="/tai-khoan">Tài khoản của tôi</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Thuê Kiosk</span>
          </nav>
          <h1>Đăng ký thuê Kiosk hoa thông minh</h1>
        </header>
        <div role="alert" className="kiosk-field-error-banner">
          <CircleAlert size={20} aria-hidden="true" />
          <div>
            <h3>
              {is403
                ? 'Không có quyền truy cập hồ sơ'
                : is401
                  ? 'Phiên làm việc đã hết hạn'
                  : 'Lỗi tải thông tin hồ sơ từ máy chủ'}
            </h3>
            <p>
              {is403
                ? 'Tài khoản của bạn không được phép xem hồ sơ thuê kiosk này.'
                : is401
                  ? 'Vui lòng đăng nhập lại để tiếp tục.'
                  : error instanceof ApiError
                    ? error.message ||
                      `Không thể tải thông tin hồ sơ thuê kiosk lúc này (mã ${error.status}). Vui lòng thử lại.`
                    : 'Không thể tải thông tin hồ sơ thuê kiosk lúc này. Vui lòng thử lại.'}
            </p>
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
              {is401 ? (
                <Link href="/dang-nhap" className="button button-primary">
                  Đăng nhập lại
                </Link>
              ) : !is403 ? (
                <Button variant="outline" onClick={() => void applicationQuery.refetch()}>
                  <RefreshCw size={16} aria-hidden="true" />
                  Thử lại
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </main>
    );
  }

  const appData = applicationQuery.data;

  const isTerminalStatus = Boolean(
    appData &&
    (appData.status === 'CANCELLED' ||
      appData.status === 'REJECTED' ||
      appData.status === 'REFUNDED'),
  );

  const hasActiveApplication = Boolean(appData && !isTerminalStatus);

  return (
    <main id="main" className="kiosk-onboarding-container">
      <header className="kiosk-onboarding-header">
        <nav className="kiosk-breadcrumb" aria-label="Đường dẫn">
          <Link href="/tai-khoan">Tài khoản của tôi</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Thuê Kiosk</span>
        </nav>
        <h1>Đăng ký thuê Kiosk hoa thông minh</h1>
        <p className="kiosk-onboarding-lead">
          FloraBot cung cấp mô hình kiosk hoa giả với 2 phân vùng ô riêng biệt: ô vãng lai (khách
          mua trực tiếp) và ô đặt trước (khách nhận hoa hẹn trước). Phí thuê tính theo năm bắt đầu
          từ ngày nghiệm thu bàn giao thực tế.
        </p>
      </header>

      {/* SECTION A: STATUS TIMELINE (If application exists and is active) */}
      {hasActiveApplication && appData && (
        <section
          className="kiosk-application-status-panel"
          aria-labelledby="application-status-heading"
        >
          <div className="status-panel-header">
            <div>
              <span className="kiosk-status-pill" data-status={appData.status}>
                {KIOSK_STATUS_LABELS[appData.status] || appData.status}
              </span>
              <h2 id="application-status-heading">Hồ sơ thuê: {appData.shopName}</h2>
              <p className="status-meta">
                Mã hồ sơ: <code>{appData.id.slice(0, 8)}</code> · Gói:{' '}
                <strong>{appData.packageName}</strong> (
                {Number(appData.annualFee).toLocaleString('vi-VN')} đ/năm) · Tạo lúc:{' '}
                {new Date(appData.createdAt).toLocaleDateString('vi-VN')}
              </p>
            </div>
            {appData.canVoluntaryCancel && (
              <Button
                variant="outline"
                className="cancel-app-btn"
                onClick={() => {
                  setCancelDialogOpen(true);
                  setCancelError('');
                  setCancelReason('');
                }}
              >
                Hủy hồ sơ
              </Button>
            )}
          </div>

          {/* Progress Timeline */}
          <nav className="kiosk-timeline" aria-label="Tiến độ xử lý hồ sơ">
            <ol className="timeline-steps">
              <li
                className={`timeline-step ${
                  ['AWAITING_PAYMENT'].includes(appData.status) ? 'is-current' : 'is-done'
                }`}
              >
                <div className="step-marker" aria-hidden="true">
                  1
                </div>
                <div className="step-content">
                  <span className="step-title">Thanh toán</span>
                  <span className="step-sub">
                    {appData.status === 'AWAITING_PAYMENT'
                      ? 'Chờ thanh toán phí'
                      : 'Đã nộp phí thuê'}
                  </span>
                </div>
              </li>
              <li
                className={`timeline-step ${
                  appData.status === 'PAID_REVIEW' || appData.status === 'UNDER_REVIEW'
                    ? 'is-current'
                    : [
                          'CONFIRMED',
                          'SCHEDULED',
                          'INSTALLING',
                          'AWAITING_HANDOVER',
                          'ACTIVE',
                        ].includes(appData.status)
                      ? 'is-done'
                      : ''
                }`}
              >
                <div className="step-marker" aria-hidden="true">
                  2
                </div>
                <div className="step-content">
                  <span className="step-title">Xác nhận liên hệ</span>
                  <span className="step-sub">
                    {appData.status === 'CONFIRMED' ||
                    ['SCHEDULED', 'INSTALLING', 'AWAITING_HANDOVER', 'ACTIVE'].includes(
                      appData.status,
                    )
                      ? 'Quản lý đã duyệt'
                      : 'Đang chờ liên hệ'}
                  </span>
                </div>
              </li>
              <li
                className={`timeline-step ${
                  appData.status === 'CONFIRMED' || appData.status === 'SCHEDULED'
                    ? 'is-current'
                    : ['INSTALLING', 'AWAITING_HANDOVER', 'ACTIVE'].includes(appData.status)
                      ? 'is-done'
                      : ''
                }`}
              >
                <div className="step-marker" aria-hidden="true">
                  3
                </div>
                <div className="step-content">
                  <span className="step-title">Lên lịch lắp đặt</span>
                  <span className="step-sub">
                    {appData.scheduledDate ? `${appData.scheduledDate}` : 'Chờ phân công KTV'}
                  </span>
                </div>
              </li>
              <li
                className={`timeline-step ${
                  appData.status === 'INSTALLING'
                    ? 'is-current'
                    : ['AWAITING_HANDOVER', 'ACTIVE'].includes(appData.status)
                      ? 'is-done'
                      : ''
                }`}
              >
                <div className="step-marker" aria-hidden="true">
                  4
                </div>
                <div className="step-content">
                  <span className="step-title">Lắp đặt tại tủ</span>
                  <span className="step-sub">
                    {appData.status === 'INSTALLING' ? 'KTV đang thi công' : 'Đã chụp minh chứng'}
                  </span>
                </div>
              </li>
              <li
                className={`timeline-step ${
                  appData.status === 'AWAITING_HANDOVER'
                    ? 'is-current'
                    : appData.status === 'ACTIVE'
                      ? 'is-done'
                      : ''
                }`}
              >
                <div className="step-marker" aria-hidden="true">
                  5
                </div>
                <div className="step-content">
                  <span className="step-title">Nghiệm thu bàn giao</span>
                  <span className="step-sub">
                    {appData.status === 'ACTIVE' ? 'Đã kích hoạt shop' : 'Quản lý duyệt ảnh'}
                  </span>
                </div>
              </li>
            </ol>
          </nav>

          {/* Locked voluntary cancellation explanation */}
          {!appData.canVoluntaryCancel &&
            ['CONFIRMED', 'SCHEDULED', 'INSTALLING', 'AWAITING_HANDOVER'].includes(
              appData.status,
            ) && (
              <div className="status-notice notice-info" role="status">
                <CircleAlert size={18} aria-hidden="true" />
                <p>
                  <strong>Lưu ý:</strong> Quản lý vận hành đã liên hệ xác nhận và khóa việc tự ý hủy
                  hồ sơ để chuẩn bị thiết bị kiosk và kỹ thuật viên. Nếu có sự cố bất khả kháng,
                  quản lý vận hành sẽ hỗ trợ xử lý ngoại lệ.
                </p>
              </div>
            )}

          {/* Reconcile notice banner */}
          {reconcileNotice && (
            <div
              role="status"
              className="status-notice notice-info"
              style={{ marginBottom: '1rem' }}
            >
              <CircleAlert size={18} aria-hidden="true" />
              <span>{reconcileNotice}</span>
            </div>
          )}

          {/* State Specific Callouts */}
          {appData.status === 'AWAITING_PAYMENT' && (
            <div className="status-action-box" data-action="payment">
              <h3>Thanh toán phí thuê gói {appData.packageName}</h3>
              <p>
                Số tiền: <strong>{Number(appData.annualFee).toLocaleString('vi-VN')} đ</strong> (cho
                thời hạn trọn gói 1 năm, tính từ khi bàn giao).
              </p>
              {paymentLinkError && (
                <div role="alert" className="kiosk-field-error-banner">
                  <CircleAlert size={18} aria-hidden="true" />
                  <span>{paymentLinkError}</span>
                </div>
              )}
              {validatedCheckoutUrl && (
                <div className="payment-ready-box" role="status">
                  <p>Liên kết thanh toán payOS đã sẵn sàng:</p>
                  <a
                    href={validatedCheckoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="button button-primary payos-checkout-link"
                  >
                    <Banknote size={18} aria-hidden="true" />
                    Mở trang thanh toán pay.payos.vn (Tab mới)
                  </a>
                </div>
              )}
              <div className="action-buttons-row">
                <Button
                  onClick={() => paymentLinkMutation.mutate(appData.id)}
                  disabled={paymentLinkMutation.isPending}
                >
                  <Banknote size={18} aria-hidden="true" />
                  {paymentLinkMutation.isPending
                    ? 'Đang tạo liên kết...'
                    : 'Tạo liên kết thanh toán payOS'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => reconcileMutation.mutate(appData.id)}
                  disabled={reconcileMutation.isPending}
                >
                  <RefreshCw
                    className={reconcileMutation.isPending ? 'kiosk-spin' : ''}
                    size={18}
                    aria-hidden="true"
                  />
                  Kiểm tra thanh toán (Đối soát máy chủ)
                </Button>
              </div>
              <p className="kiosk-help-text">
                FloraBot xác thực thanh toán trực tiếp qua máy chủ cổng payOS. Trình duyệt không tự
                quyết định trạng thái thanh toán từ query trả về.
              </p>
            </div>
          )}

          {appData.status === 'PAID_REVIEW' && (
            <div className="status-action-box" data-action="paid-review">
              <h3>Đã thanh toán thành công</h3>
              <p>
                Khoản phí thuê {Number(appData.annualFee).toLocaleString('vi-VN')} đ đã được ghi
                nhận. Quản lý vận hành FloraBot sẽ liên hệ với bạn qua số điện thoại{' '}
                <strong>{appData.phone}</strong> để xác nhận địa điểm trước khi tiến hành lên lịch
                lắp đặt.
              </p>
              <p className="kiosk-help-text">
                Trong giai đoạn này, bạn vẫn có thể hủy hồ sơ nếu thay đổi kế hoạch. Khoản tiền sẽ
                được chuyển sang quy trình hoàn tiền thủ công của Quản trị viên.
              </p>
            </div>
          )}

          {appData.status === 'SCHEDULED' && (
            <div className="status-action-box" data-action="scheduled">
              <h3>Lịch lắp đặt đã được ấn định</h3>
              <dl className="kiosk-detail-list">
                <div>
                  <dt>Ngày dự kiến:</dt>
                  <dd>
                    <strong>{appData.scheduledDate || 'Đang cập nhật'}</strong>
                  </dd>
                </div>
                <div>
                  <dt>Khung giờ:</dt>
                  <dd>
                    <strong>{appData.timeWindow || 'Trong giờ hành chính'}</strong>
                  </dd>
                </div>
                <div>
                  <dt>Mã tủ phân bổ:</dt>
                  <dd>
                    <code>{appData.assignedKioskCode || 'Đang cấp phát'}</code>
                  </dd>
                </div>
                <div>
                  <dt>Kỹ thuật viên phụ trách:</dt>
                  <dd>{appData.assignedTechnicianName || 'Kỹ thuật viên FloraBot'}</dd>
                </div>
              </dl>
              <p className="kiosk-help-text">
                Kỹ thuật viên sẽ liên hệ trước khi đến địa chỉ lắp đặt. Vui lòng đảm bảo điểm đặt có
                nguồn điện khả dụng.
              </p>
            </div>
          )}

          {appData.status === 'INSTALLING' && (
            <div className="status-action-box" data-action="installing">
              <h3>Kỹ thuật viên đang tiến hành lắp đặt</h3>
              <p>
                Kỹ thuật viên đang kiểm tra cảm biến cửa, kết nối tủ và tải lên hình ảnh minh chứng
                hiện trường.
              </p>
              {appData.reworkReason && (
                <div role="alert" className="kiosk-field-error-banner">
                  <CircleAlert size={18} aria-hidden="true" />
                  <div>
                    <strong>Yêu cầu chỉnh sửa / kiểm tra lại từ quản lý:</strong>
                    <p>{appData.reworkReason}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {appData.status === 'AWAITING_HANDOVER' && (
            <div className="status-action-box" data-action="handover">
              <h3>Đã hoàn tất lắp đặt - Chờ nghiệm thu bàn giao</h3>
              <p>
                Kỹ thuật viên đã nộp báo cáo hoàn thành cùng hình ảnh minh chứng. Quản lý vận hành
                đang kiểm tra hồ sơ để kích hoạt quyền Chủ shop và bắt đầu kỳ hạn 1 năm của bạn.
              </p>
            </div>
          )}

          {appData.status === 'ACTIVE' && (
            <div className="status-action-box active-success-banner" data-action="active">
              <div className="active-success-header">
                <Check size={28} aria-hidden="true" />
                <div>
                  <h3>Kiosk đã kích hoạt thành công!</h3>
                  <p>
                    Chúc mừng bạn đã chính thức trở thành Chủ shop trên FloraBot. Thời hạn thuê 1
                    năm bắt đầu từ hôm nay.
                  </p>
                </div>
              </div>
              <div className="action-buttons-row">
                <Button onClick={handleActiveSessionRefresh} disabled={refreshingSession}>
                  <ArrowRight size={18} aria-hidden="true" />
                  {refreshingSession ? 'Đang chuyển vào shop...' : 'Vào quản lý Shop & Mẫu hoa'}
                </Button>
              </div>
              {refreshError && (
                <div
                  role="alert"
                  className="kiosk-field-error-banner"
                  style={{ marginTop: '0.75rem' }}
                >
                  <CircleAlert size={18} aria-hidden="true" />
                  <div>
                    <span>{refreshError}</span>
                    <div style={{ marginTop: '0.5rem' }}>
                      <Link href="/dang-nhap" className="button button-outline">
                        Đăng nhập lại
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {appData.status === 'REFUND_PENDING' && (
            <div className="status-action-box" data-action="refund-pending">
              <h3>Đang xử lý hoàn tiền</h3>
              <p>
                Hồ sơ đã được chuyển sang danh sách hoàn tiền thủ công. Quản trị viên sẽ kiểm tra và
                chuyển khoản số tiền {Number(appData.annualFee).toLocaleString('vi-VN')} đ về tài
                khoản{' '}
                <strong>
                  {appData.bankName} - ****{appData.bankAccountSuffix}
                </strong>{' '}
                ({appData.bankHolder}).
              </p>
            </div>
          )}

          {/* Application Details Summary */}
          <details className="kiosk-app-summary-details">
            <summary>Xem lại thông tin đã đăng ký trong hồ sơ</summary>
            <div className="kiosk-summary-grid">
              <div>
                <strong>Điểm lắp đặt:</strong>
                <p>{appData.installationAddress}</p>
                <small>
                  Tọa độ: {Number(appData.latitude).toFixed(6)},{' '}
                  {Number(appData.longitude).toFixed(6)}
                </small>
              </div>
              <div>
                <strong>Liên hệ:</strong>
                <p>
                  {appData.phone} · {appData.contactEmail}
                </p>
              </div>
              <div>
                <strong>Tài khoản nhận doanh thu shop:</strong>
                <p>
                  {appData.bankName} - ****{appData.bankAccountSuffix} ({appData.bankHolder})
                </p>
                <small>Chỉ dùng để nhận tiền bán hoa, không ủy quyền trích nợ.</small>
              </div>
              <div>
                <strong>Phân vùng ô tủ:</strong>
                <p>
                  {appData.walkInSlots} ô vãng lai + {appData.preorderSlots} ô đặt trước (
                  {appData.totalSlots} ô tổng cộng)
                </p>
              </div>
            </div>
          </details>
        </section>
      )}

      {/* Cancel Confirmation Dialog */}
      {cancelDialogOpen && (
        <div
          className="kiosk-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-dialog-title"
        >
          <div className="kiosk-modal-card">
            <div className="kiosk-modal-header">
              <h3 id="cancel-dialog-title">Xác nhận hủy hồ sơ thuê kiosk</h3>
              <button
                type="button"
                className="kiosk-modal-close"
                onClick={() => setCancelDialogOpen(false)}
                aria-label="Đóng"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <p>
              {appData?.status === 'PAID_REVIEW'
                ? 'Bạn đã thanh toán phí thuê. Khi xác nhận hủy lúc này, hồ sơ sẽ chuyển sang quy trình hoàn tiền thủ công của Quản trị viên.'
                : 'Bạn có chắc chắn muốn hủy hồ sơ này không? Thao tác này không thể hoàn tác.'}
            </p>
            {cancelError && (
              <p role="alert" className="kiosk-field-error">
                {cancelError}
              </p>
            )}
            <div className="kiosk-form-field">
              <label htmlFor="cancel-reason">Lý do hủy (bắt buộc):</label>
              <textarea
                id="cancel-reason"
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ví dụ: Thay đổi kế hoạch kinh doanh hoặc vị trí mặt bằng..."
                required
              />
            </div>
            <div className="kiosk-modal-actions">
              <Button
                variant="outline"
                onClick={() => setCancelDialogOpen(false)}
                disabled={cancelMutation.isPending}
              >
                Giữ lại hồ sơ
              </Button>
              <Button
                onClick={() => {
                  if (!cancelReason.trim()) {
                    setCancelError('Vui lòng nhập lý do hủy hồ sơ.');
                    return;
                  }
                  if (appData) {
                    cancelMutation.mutate({ id: appData.id, reason: cancelReason.trim() });
                  }
                }}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending ? 'Đang hủy...' : 'Xác nhận hủy'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Terminal state panels: CANCELLED, REJECTED, REFUNDED */}
      {appData && (appData.status === 'CANCELLED' || appData.status === 'REJECTED') && (
        <section
          className="kiosk-last-app-panel"
          aria-labelledby="last-application-heading"
          style={{ marginBottom: '1.5rem' }}
        >
          <div
            className="status-notice notice-info"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div>
              <h2
                id="last-application-heading"
                style={{ fontSize: '1.05rem', margin: 0, fontWeight: 700 }}
              >
                Hồ sơ trước ({appData.shopName}):{' '}
                {KIOSK_STATUS_LABELS[appData.status] || appData.status}
              </h2>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.88rem' }}>
                Mã hồ sơ: <code>{appData.id.slice(0, 8)}</code> · Gói:{' '}
                <strong>{appData.packageName}</strong> (
                {Number(appData.annualFee).toLocaleString('vi-VN')} đ/năm) · Tạo lúc:{' '}
                {new Date(appData.createdAt).toLocaleDateString('vi-VN')}
              </p>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.88rem' }}>
                Nếu bạn đã chuyển khoản thành công trước đó, bạn có thể yêu cầu máy chủ kiểm tra lại
                với cổng thanh toán để tự động chuyển sang hoàn tiền.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => reconcileMutation.mutate(appData.id)}
              disabled={reconcileMutation.isPending}
            >
              <RefreshCw
                className={reconcileMutation.isPending ? 'kiosk-spin' : ''}
                size={16}
                aria-hidden="true"
              />
              {reconcileMutation.isPending ? 'Đang đối soát...' : 'Kiểm tra thanh toán muộn'}
            </Button>
          </div>
          {reconcileNotice && (
            <div
              role="status"
              className="status-notice notice-info"
              style={{ marginTop: '0.75rem' }}
            >
              <CircleAlert size={18} aria-hidden="true" />
              <span>{reconcileNotice}</span>
            </div>
          )}
          <details className="kiosk-app-summary-details" style={{ marginTop: '0.75rem' }}>
            <summary>Xem lại thông tin đã đăng ký trong hồ sơ trước</summary>
            <div className="kiosk-summary-grid">
              <div>
                <strong>Điểm lắp đặt:</strong>
                <p>{appData.installationAddress}</p>
                <small>
                  Tọa độ: {Number(appData.latitude).toFixed(6)},{' '}
                  {Number(appData.longitude).toFixed(6)}
                </small>
              </div>
              <div>
                <strong>Liên hệ:</strong>
                <p>
                  {appData.phone} · {appData.contactEmail}
                </p>
              </div>
              <div>
                <strong>Tài khoản nhận doanh thu shop:</strong>
                <p>
                  {appData.bankName} - ****{appData.bankAccountSuffix} ({appData.bankHolder})
                </p>
              </div>
              <div>
                <strong>Phân vùng ô tủ:</strong>
                <p>
                  {appData.walkInSlots} ô vãng lai + {appData.preorderSlots} ô đặt trước (
                  {appData.totalSlots} ô tổng cộng)
                </p>
              </div>
            </div>
          </details>
        </section>
      )}

      {appData && appData.status === 'REFUNDED' && (
        <section
          className="kiosk-last-app-panel"
          aria-labelledby="last-application-heading"
          style={{ marginBottom: '1.5rem' }}
        >
          <div
            className="status-notice notice-info"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div>
              <h2
                id="last-application-heading"
                style={{ fontSize: '1.05rem', margin: 0, fontWeight: 700 }}
              >
                Hồ sơ trước ({appData.shopName}):{' '}
                {KIOSK_STATUS_LABELS[appData.status] || 'Đã hoàn tiền'}
              </h2>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.88rem' }}>
                Mã hồ sơ: <code>{appData.id.slice(0, 8)}</code> · Gói:{' '}
                <strong>{appData.packageName}</strong> (
                {Number(appData.annualFee).toLocaleString('vi-VN')} đ/năm) · Tạo lúc:{' '}
                {new Date(appData.createdAt).toLocaleDateString('vi-VN')}
              </p>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.88rem' }}>
                Khoản phí thuê đã được Quản trị viên chuyển khoản hoàn trả về tài khoản{' '}
                <strong>
                  {appData.bankName} - ****{appData.bankAccountSuffix}
                </strong>{' '}
                ({appData.bankHolder}). Bạn có thể nộp hồ sơ thuê mới bất cứ lúc nào bên dưới.
              </p>
            </div>
            <span className="kiosk-status-pill" data-status="REFUNDED">
              {KIOSK_STATUS_LABELS.REFUNDED || 'Đã hoàn tiền'}
            </span>
          </div>
          <details className="kiosk-app-summary-details" style={{ marginTop: '0.75rem' }}>
            <summary>Xem lại thông tin đã đăng ký trong hồ sơ trước</summary>
            <div className="kiosk-summary-grid">
              <div>
                <strong>Điểm lắp đặt:</strong>
                <p>{appData.installationAddress}</p>
                <small>
                  Tọa độ: {Number(appData.latitude).toFixed(6)},{' '}
                  {Number(appData.longitude).toFixed(6)}
                </small>
              </div>
              <div>
                <strong>Liên hệ:</strong>
                <p>
                  {appData.phone} · {appData.contactEmail}
                </p>
              </div>
              <div>
                <strong>Tài khoản nhận doanh thu shop:</strong>
                <p>
                  {appData.bankName} - ****{appData.bankAccountSuffix} ({appData.bankHolder})
                </p>
              </div>
              <div>
                <strong>Phân vùng ô tủ:</strong>
                <p>
                  {appData.walkInSlots} ô vãng lai + {appData.preorderSlots} ô đặt trước (
                  {appData.totalSlots} ô tổng cộng)
                </p>
              </div>
            </div>
          </details>
        </section>
      )}

      {/* SECTION B: CATALOG & APPLICATION FORM (If no active application) */}
      {!hasActiveApplication && (
        <>
          {/* Packages Catalog */}
          <section className="kiosk-packages-section" aria-labelledby="packages-catalog-heading">
            <div className="section-title-wrap">
              <h2 id="packages-catalog-heading">1. Chọn gói thuê kiosk hàng năm</h2>
              <p>
                Mỗi gói tương ứng với một tủ vật lý nguyên chiếc được cấu hình số lượng ô đặt trước
                và ô vãng lai cố định.
              </p>
            </div>

            {packagesQuery.isLoading && (
              <p role="status" className="kiosk-status-loading">
                <RefreshCw className="spin" size={18} aria-hidden="true" />
                Đang tải bảng giá các gói kiosk...
              </p>
            )}

            {packagesQuery.isError && (
              <div role="alert" className="kiosk-packages-error">
                <CircleAlert size={20} aria-hidden="true" />
                <div>
                  <p>Chưa tải được danh mục gói thuê từ máy chủ.</p>
                  <Button variant="outline" onClick={() => void packagesQuery.refetch()}>
                    Thử lại
                  </Button>
                </div>
              </div>
            )}

            {packagesQuery.data && (
              <div
                className="kiosk-packages-grid"
                role="radiogroup"
                aria-labelledby="packages-catalog-heading"
              >
                {packagesQuery.data.map((pkg) => {
                  const isSelected = selectedPackageId === pkg.id;
                  return (
                    <div
                      key={pkg.id}
                      className={`kiosk-package-card ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => {
                        setSelectedPackageId(pkg.id);
                        setFormErrors((prev) => {
                          const next = { ...prev };
                          delete next.package;
                          return next;
                        });
                      }}
                      tabIndex={0}
                      role="radio"
                      aria-checked={isSelected}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          setSelectedPackageId(pkg.id);
                        }
                      }}
                    >
                      <div className="package-card-header">
                        <span className="package-tier-badge">{pkg.name}</span>
                        <div className="package-price">
                          <span className="price-number">
                            {Number(pkg.annualFee).toLocaleString('vi-VN')}
                          </span>
                          <span className="price-unit">đ / năm</span>
                        </div>
                      </div>

                      <div className="package-slots-breakdown">
                        <div className="slot-item">
                          <Boxes size={18} aria-hidden="true" />
                          <span>
                            <strong>{pkg.walkInSlots}</strong> ô vãng lai (Walk-in)
                          </span>
                        </div>
                        <div className="slot-item">
                          <Store size={18} aria-hidden="true" />
                          <span>
                            <strong>{pkg.preorderSlots}</strong> ô đặt trước (Pre-order)
                          </span>
                        </div>
                        <div className="slot-total">
                          Tổng sức chứa: <strong>{pkg.totalSlots} ô tủ</strong>
                        </div>
                      </div>

                      <p className="package-desc">{pkg.description}</p>

                      <div className="package-select-action">
                        <span className={`select-indicator ${isSelected ? 'is-active' : ''}`}>
                          {isSelected ? '✓ Đã chọn gói này' : 'Chọn gói này'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {formErrors.package && (
              <p role="alert" className="kiosk-field-error">
                {formErrors.package}
              </p>
            )}
          </section>

          {/* Application Form */}
          <section className="kiosk-form-section" aria-labelledby="application-form-heading">
            <div className="section-title-wrap">
              <h2 id="application-form-heading">2. Điền thông tin đăng ký mặt bằng & shop</h2>
              <p>
                FloraBot sẽ sử dụng thông tin này để thẩm định vị trí lắp đặt và chuyển doanh thu
                bán hoa cho shop của bạn.
              </p>
            </div>

            {submitError && (
              <div
                ref={errorBannerRef}
                tabIndex={-1}
                role="alert"
                className="kiosk-field-error-banner"
              >
                <CircleAlert size={20} aria-hidden="true" />
                <span>{submitError}</span>
              </div>
            )}

            <form noValidate onSubmit={handleFormSubmit} className="kiosk-application-form">
              <fieldset className="kiosk-form-group">
                <legend>Thông tin cửa hàng hoa</legend>

                <div className="kiosk-form-field">
                  <label htmlFor="shop-name-input">
                    Tên shop hoa <span className="required-star">*</span>
                  </label>
                  <input
                    id="shop-name-input"
                    type="text"
                    maxLength={120}
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="Ví dụ: Tiệm Hoa Xinh Đà Lạt"
                    required
                    aria-invalid={!!formErrors.shopName}
                    aria-describedby={formErrors.shopName ? 'shop-name-error' : undefined}
                  />
                  {formErrors.shopName && (
                    <p id="shop-name-error" className="kiosk-field-error">
                      {formErrors.shopName}
                    </p>
                  )}
                </div>

                <div className="form-fields-grid-2">
                  <div className="kiosk-form-field">
                    <label htmlFor="shop-phone-input">
                      Số điện thoại kinh doanh <span className="required-star">*</span>
                    </label>
                    <input
                      id="shop-phone-input"
                      type="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0901234567"
                      required
                      aria-invalid={!!formErrors.phone}
                      aria-describedby={formErrors.phone ? 'shop-phone-error' : undefined}
                    />
                    {formErrors.phone && (
                      <p id="shop-phone-error" className="kiosk-field-error">
                        {formErrors.phone}
                      </p>
                    )}
                  </div>

                  <div className="kiosk-form-field">
                    <label htmlFor="contact-email-input">
                      Email liên hệ công việc <span className="required-star">*</span>
                    </label>
                    <input
                      id="contact-email-input"
                      type="email"
                      autoComplete="email"
                      maxLength={254}
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="contact@tiemhoaxinh.vn"
                      required
                      aria-invalid={!!formErrors.contactEmail}
                      aria-describedby="contact-email-hint"
                    />
                    <small id="contact-email-hint" className="kiosk-field-hint">
                      Dùng để nhận thông báo vận hành shop. Không thay đổi email đăng nhập của tài
                      khoản.
                    </small>
                    {formErrors.contactEmail && (
                      <p className="kiosk-field-error">{formErrors.contactEmail}</p>
                    )}
                  </div>
                </div>
              </fieldset>

              <fieldset className="kiosk-form-group">
                <legend>Vị trí & Địa chỉ đề xuất đặt kiosk</legend>

                <div className="kiosk-form-field">
                  <label htmlFor="installation-address-input">
                    Địa chỉ lắp đặt cụ thể <span className="required-star">*</span>
                  </label>
                  <input
                    id="installation-address-input"
                    type="text"
                    maxLength={200}
                    value={installationAddress}
                    onChange={(e) => setInstallationAddress(e.target.value)}
                    placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành..."
                    required
                    aria-invalid={!!formErrors.installationAddress}
                    aria-describedby={formErrors.installationAddress ? 'address-error' : undefined}
                  />
                  {formErrors.installationAddress && (
                    <p id="address-error" className="kiosk-field-error">
                      {formErrors.installationAddress}
                    </p>
                  )}
                </div>

                <div className="kiosk-map-picker-block">
                  <div className="map-picker-header">
                    <div>
                      <span className="map-picker-title">Ghim vị trí chính xác trên bản đồ</span>
                      <small className="kiosk-field-hint">
                        Nhấp vào bản đồ để chọn tọa độ, hoặc dùng nút định vị GPS bên dưới.
                      </small>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="gps-btn"
                      onClick={requestGps}
                      disabled={gpsLoading}
                    >
                      <MapPin size={18} aria-hidden="true" />
                      {gpsLoading ? 'Đang dò GPS...' : 'Lấy vị trí hiện tại (GPS)'}
                    </Button>
                  </div>

                  {gpsMessage && (
                    <p className="kiosk-gps-notice" role="status">
                      {gpsMessage}
                    </p>
                  )}

                  <div className="kiosk-picker-embed">
                    <KioskPickerMap
                      latitude={latitude}
                      longitude={longitude}
                      onLocationSelect={handleLocationSelect}
                      interactive={true}
                      ariaLabel="Bản đồ chọn tọa độ lắp đặt kiosk"
                    />
                  </div>

                  {/* Manual Coordinate Fallback (Blank is NOT 0) */}
                  <div className="manual-coords-row">
                    <div className="kiosk-form-field">
                      <label htmlFor="lat-input">Vĩ độ (Latitude)</label>
                      <input
                        id="lat-input"
                        type="text"
                        inputMode="decimal"
                        value={latInput}
                        onChange={(e) => handleLatInputChange(e.target.value)}
                        placeholder="Ví dụ: 10.776889"
                      />
                    </div>
                    <div className="kiosk-form-field">
                      <label htmlFor="lon-input">Kinh độ (Longitude)</label>
                      <input
                        id="lon-input"
                        type="text"
                        inputMode="decimal"
                        value={lonInput}
                        onChange={(e) => handleLonInputChange(e.target.value)}
                        placeholder="Ví dụ: 106.700806"
                      />
                    </div>
                  </div>
                  {formErrors.coordinates && (
                    <p role="alert" className="kiosk-field-error">
                      {formErrors.coordinates}
                    </p>
                  )}
                </div>
              </fieldset>

              <fieldset className="kiosk-form-group">
                <legend>Tài khoản nhận doanh thu bán hoa (Payout)</legend>
                <p className="kiosk-group-note">
                  Đây là tài khoản để FloraBot chuyển tiền doanh thu bán hoa cho shop của bạn khi
                  đối soát hàng kỳ. Chúng tôi tuyệt đối không ủy quyền trích nợ tự động hay thu phí
                  từ tài khoản này.
                </p>

                <div className="form-fields-grid-2">
                  <div className="kiosk-form-field">
                    <label htmlFor="bank-name-input">
                      Tên ngân hàng <span className="required-star">*</span>
                    </label>
                    <input
                      id="bank-name-input"
                      type="text"
                      maxLength={100}
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="Ví dụ: Vietcombank, MB Bank, v.v."
                      required
                      aria-invalid={!!formErrors.bankName}
                    />
                    {formErrors.bankName && (
                      <p className="kiosk-field-error">{formErrors.bankName}</p>
                    )}
                  </div>

                  <div className="kiosk-form-field">
                    <label htmlFor="bank-holder-input">
                      Tên chủ tài khoản (in hoa không dấu) <span className="required-star">*</span>
                    </label>
                    <input
                      id="bank-holder-input"
                      type="text"
                      maxLength={100}
                      value={bankHolder}
                      onChange={(e) => setBankHolder(e.target.value.toUpperCase())}
                      placeholder="NGUYEN VAN A"
                      required
                      aria-invalid={!!formErrors.bankHolder}
                    />
                    {formErrors.bankHolder && (
                      <p className="kiosk-field-error">{formErrors.bankHolder}</p>
                    )}
                  </div>
                </div>

                <div className="kiosk-form-field">
                  <label htmlFor="bank-account-number-input">
                    Số tài khoản ngân hàng <span className="required-star">*</span>
                  </label>
                  <input
                    id="bank-account-number-input"
                    type="text"
                    maxLength={30}
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                    placeholder="Số tài khoản ngân hàng thụ hưởng"
                    required
                    aria-invalid={!!formErrors.bankAccountNumber}
                  />
                  {formErrors.bankAccountNumber && (
                    <p className="kiosk-field-error">{formErrors.bankAccountNumber}</p>
                  )}
                </div>
              </fieldset>

              <div className="kiosk-form-actions">
                <Button
                  type="submit"
                  disabled={applyMutation.isPending}
                  className="submit-application-btn"
                >
                  {applyMutation.isPending ? 'Đang gửi hồ sơ...' : 'Nộp hồ sơ thuê kiosk'}
                </Button>
                <Link href="/tai-khoan" className="button button-outline">
                  Quay lại tài khoản
                </Link>
              </div>
            </form>
          </section>
        </>
      )}
    </main>
  );
}

export default function CustomerKioskOnboarding() {
  const session = useQuery(sessionQuery);
  return (
    <CustomerKioskContent
      key={session.data?.id || 'guest'}
      sessionData={session.data}
      isPending={session.isPending}
    />
  );
}
