'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button, CircleAlert, RefreshCw } from '@florabot/ui';
import { ApiError, sessionQuery, type Session } from '@/shared/lib/api';
import { ApplicationStatusPanel } from './components/ApplicationStatusPanel';
import { CancelApplicationDialog } from './components/CancelApplicationDialog';
import { KioskApplicationForm } from './components/KioskApplicationForm';
import { KioskPackageCatalog } from './components/KioskPackageCatalog';
import { TerminalApplicationPanel } from './components/TerminalApplicationPanel';
import { useKioskApplication } from './hooks/useKioskApplication';
import { useKioskApplicationActions } from './hooks/useKioskApplicationActions';
import { useKioskApplicationForm } from './hooks/useKioskApplicationForm';
import { useKioskGeolocation } from './hooks/useKioskGeolocation';
import './styles/onboarding.css';

function CustomerKioskContent({
  sessionData,
  isPending,
}: {
  sessionData: Session | undefined;
  isPending: boolean;
}) {
  const { packagesQuery, applicationQuery, appData, isTerminalStatus, hasActiveApplication } =
    useKioskApplication(sessionData);

  const form = useKioskApplicationForm();
  const geo = useKioskGeolocation(form.handleLocationSelect);
  const actions = useKioskApplicationActions(sessionData);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = form.validateAndGetPayload();
    if (!payload) return;
    actions.applyMutation.mutate(payload);
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

      {/* Active Application Status Panel */}
      {hasActiveApplication && appData && (
        <ApplicationStatusPanel
          appData={appData}
          onOpenCancelDialog={() => {
            actions.setCancelDialogOpen(true);
            actions.setCancelError('');
            actions.setCancelReason('');
          }}
          reconcileNotice={actions.reconcileNotice}
          validatedCheckoutUrl={actions.validatedCheckoutUrl}
          paymentLinkError={actions.paymentLinkError}
          isGeneratingLink={actions.paymentLinkMutation.isPending}
          isReconciling={actions.reconcileMutation.isPending}
          onGenerateLink={() => actions.paymentLinkMutation.mutate(appData.id)}
          onReconcile={() => actions.reconcileMutation.mutate(appData.id)}
          refreshingSession={actions.refreshingSession}
          refreshError={actions.refreshError}
          onRefreshSession={actions.handleActiveSessionRefresh}
        />
      )}

      {/* Terminal State Panels: CANCELLED, REJECTED, REFUNDED */}
      {isTerminalStatus && appData && (
        <TerminalApplicationPanel
          appData={appData}
          reconcileNotice={actions.reconcileNotice}
          isReconciling={actions.reconcileMutation.isPending}
          onReconcile={() => actions.reconcileMutation.mutate(appData.id)}
        />
      )}

      {/* Catalog & Registration Form (if no active application) */}
      {!hasActiveApplication && (
        <>
          <KioskPackageCatalog
            packages={packagesQuery.data}
            isLoading={packagesQuery.isLoading}
            isError={packagesQuery.isError}
            onRefetch={() => void packagesQuery.refetch()}
            selectedPackageId={form.selectedPackageId}
            onSelectPackage={(id) => {
              form.setSelectedPackageId(id);
              form.clearFieldError('package');
            }}
            error={form.formErrors.package}
          />

          <KioskApplicationForm
            shopInfo={{
              shopName: form.shopName,
              onShopNameChange: (val) => {
                form.setShopName(val);
                form.clearFieldError('shopName');
              },
              shopNameError: form.formErrors.shopName,
              phone: form.phone,
              onPhoneChange: (val) => {
                form.setPhone(val);
                form.clearFieldError('phone');
              },
              phoneError: form.formErrors.phone,
              contactEmail: form.contactEmail,
              onContactEmailChange: (val) => {
                form.setContactEmail(val);
                form.clearFieldError('contactEmail');
              },
              contactEmailError: form.formErrors.contactEmail,
            }}
            location={{
              installationAddress: form.installationAddress,
              onAddressChange: (val) => {
                form.setInstallationAddress(val);
                form.clearFieldError('installationAddress');
              },
              addressError: form.formErrors.installationAddress,
              latitude: form.latitude,
              longitude: form.longitude,
              latInput: form.latInput,
              lonInput: form.lonInput,
              onLocationSelect: form.handleLocationSelect,
              onLatInputChange: form.handleLatInputChange,
              onLonInputChange: form.handleLonInputChange,
              coordinatesError: form.formErrors.coordinates,
              gpsLoading: geo.gpsLoading,
              gpsMessage: geo.gpsMessage,
              onRequestGps: geo.requestGps,
            }}
            payout={{
              bankName: form.bankName,
              onBankNameChange: (val) => {
                form.setBankName(val);
                form.clearFieldError('bankName');
              },
              bankNameError: form.formErrors.bankName,
              bankHolder: form.bankHolder,
              onBankHolderChange: (val) => {
                form.setBankHolder(val);
                form.clearFieldError('bankHolder');
              },
              bankHolderError: form.formErrors.bankHolder,
              bankAccountNumber: form.bankAccountNumber,
              onBankAccountNumberChange: (val) => {
                form.setBankAccountNumber(val);
                form.clearFieldError('bankAccountNumber');
              },
              bankAccountNumberError: form.formErrors.bankAccountNumber,
            }}
            submitError={actions.submitError}
            errorBannerRef={actions.errorBannerRef}
            isPending={actions.applyMutation.isPending}
            onSubmit={handleFormSubmit}
          />
        </>
      )}

      {/* Cancel Confirmation Dialog */}
      <CancelApplicationDialog
        isOpen={actions.cancelDialogOpen}
        status={appData?.status}
        reason={actions.cancelReason}
        onReasonChange={actions.setCancelReason}
        error={actions.cancelError}
        isPending={actions.cancelMutation.isPending}
        onClose={() => actions.setCancelDialogOpen(false)}
        onConfirm={() => {
          if (!actions.cancelReason.trim()) {
            actions.setCancelError('Vui lòng nhập lý do hủy hồ sơ.');
            return;
          }
          if (appData) {
            actions.cancelMutation.mutate({ id: appData.id, reason: actions.cancelReason.trim() });
          }
        }}
      />
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
