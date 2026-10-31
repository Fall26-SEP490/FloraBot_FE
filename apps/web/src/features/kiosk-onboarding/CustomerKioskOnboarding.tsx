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
  const geo = useKioskGeolocation(form.handleGpsLocationSelect, form.installationAddress);
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
        <div className="kiosk-lease-heading">
          <div>
            <span className="kiosk-lease-eyebrow">ĐỒNG HÀNH CÙNG FLORABOT</span>
            <h1>Mở điểm bán hoa của bạn</h1>
            <p className="kiosk-onboarding-lead">
              Chọn gói thuê, đề xuất vị trí và gửi hồ sơ để bắt đầu kinh doanh cùng FloraBot.
            </p>
          </div>
          <p className="kiosk-lease-term">
            Thuê theo năm<span>Tính từ ngày bàn giao thực tế</span>
          </p>
        </div>
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

      {/* Catalog & Registration Form (only for CUSTOMER role when no active application) */}
      {!hasActiveApplication && sessionData.role === 'CUSTOMER' && (
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

          <div className="kiosk-registration-layout">
            <aside className="kiosk-registration-guide" aria-label="Hướng dẫn đăng ký">
              <span className="kiosk-lease-eyebrow">BƯỚC TIẾP THEO</span>
              <h2>Chuẩn bị điểm bán của bạn</h2>
              <p>Hoàn thiện thông tin để FloraBot xem xét vị trí và liên hệ với bạn.</p>
              <ol>
                <li>
                  <strong>Thông tin cửa hàng</strong>
                  <span>Tên shop và kênh liên hệ.</span>
                </li>
                <li>
                  <strong>Vị trí lắp đặt</strong>
                  <span>Địa chỉ cụ thể và ghim bản đồ.</span>
                </li>
                <li>
                  <strong>Tài khoản nhận tiền</strong>
                  <span>Thông tin ngân hàng của shop.</span>
                </li>
              </ol>
              <p className="kiosk-guide-note">
                Sau khi nộp, bạn có thể theo dõi thanh toán và tiến độ lắp đặt ngay tại đây.
              </p>
            </aside>
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
                addressSelected: form.addressSelected,
                addressEditedAfterSelect: form.addressEditedAfterSelect,
                locationSource: form.locationSource,
                onAddressChange: form.handleAddressChange,
                onSuggestionSelect: form.handleSuggestionSelect,
                addressError: form.formErrors.installationAddress,
                latitude: form.latitude,
                longitude: form.longitude,
                onLocationSelect: form.handleLocationSelect,
                coordinatesError: form.formErrors.coordinates,
                gpsLoading: geo.gpsLoading,
                gpsMessage: geo.gpsMessage,
                gpsError: geo.gpsError,
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
          </div>
        </>
      )}

      {/* Already SELLER notice (if no active onboarding in progress) */}
      {!hasActiveApplication && sessionData.role === 'SELLER' && (
        <div role="status" className="status-action-box active-success-banner" data-action="active">
          <h3>Tài khoản đã là Chủ shop (SELLER)</h3>
          <p>
            Tài khoản của bạn hiện đã sở hữu vai trò Chủ shop. Quy trình đăng ký thuê kiosk mới chỉ
            áp dụng cho tài khoản Khách hàng (CUSTOMER). Vui lòng chuyển sang Bảng điều khiển Chủ
            shop để quản lý hoa và vận hành kiosk.
          </p>
          <div style={{ marginTop: '1rem' }}>
            <Link href="/seller" className="button button-primary">
              Đến Bảng điều khiển Chủ shop
            </Link>
          </div>
        </div>
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
