'use client';

import Link from 'next/link';
import PayosCheckout from '@/shared/components/PayosCheckout';
import { useQuery } from '@tanstack/react-query';
import { Button, CircleAlert, RefreshCw } from '@florabot/ui';
import { ApiError, request, sessionQuery, type Session } from '@/shared/lib/api';
import type { SellerBankResponse } from '@/features/finance/components/payment-channels/ShopBankSection';
import { ApplicationStatusPanel } from './components/ApplicationStatusPanel';
import { CancelApplicationDialog } from './components/CancelApplicationDialog';
import { KioskApplicationForm } from './components/KioskApplicationForm';
import { SlotDemandFields } from '../kiosk-pricing/SlotDemandFields';
import { pricingReady, rentalTotal, rentalMoney } from '../kiosk-pricing/kiosk-pricing';
import { useState } from 'react';
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
  const { pricingQuery, applicationQuery, appData, isTerminalStatus, hasActiveApplication } =
    useKioskApplication(sessionData);

  const additional = sessionData?.role === 'SELLER';
  const sellerId = sessionData?.sellerId;
  const sellerBankQuery = useQuery({
    queryKey: ['seller-shop-bank', sellerId],
    queryFn: () => request<SellerBankResponse>(`/sellers/${sellerId}/bank`),
    enabled: Boolean(additional && sellerId),
  });

  const [acceptedPricingVersion, setAcceptedPricingVersion] = useState<number | null>(null);
  const pricing = pricingQuery.data;
  const form = useKioskApplicationForm(acceptedPricingVersion ?? 0, additional);
  const total = rentalTotal(pricing, form.walkInSlots, form.preorderSlots);
  const canSubmit =
    pricingReady(pricing) && total !== null && acceptedPricingVersion === pricing?.version;
  const geo = useKioskGeolocation(form.handleGpsLocationSelect, form.installationAddress);
  const actions = useKioskApplicationActions(sessionData);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (additional && sellerBankQuery.data && sellerBankQuery.data.status !== 'READY') {
      actions.setSubmitError(
        'Hồ sơ shop chưa có tài khoản ngân hàng nhận hoàn phí thuê (cần ở trạng thái Sẵn sàng - READY). Vui lòng cập nhật thông tin ngân hàng shop bên dưới trước khi gửi đơn.',
      );
      actions.errorBannerRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
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
            <span className="kiosk-lease-eyebrow">FLORABOT · THUÊ KIOSK</span>
            <h1>{additional ? 'Thêm một điểm bán, mở rộng shop' : 'Mở điểm bán hoa của bạn'}</h1>
            <p className="kiosk-onboarding-lead">
              {additional
                ? 'Chọn số ô và địa điểm mới. Mỗi kiosk có hợp đồng thuê riêng.'
                : 'Thiết kế số ô phù hợp, chọn vị trí và bắt đầu kinh doanh cùng FloraBot.'}
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

      {appData?.status === 'AWAITING_PAYMENT' &&
        actions.checkoutApplicationId === appData.id &&
        actions.validatedCheckoutUrl && (
          <PayosCheckout
            checkoutUrl={actions.validatedCheckoutUrl}
            qrCode={actions.latestPaymentData?.qrCode}
            amount={actions.latestPaymentData?.amount ?? appData.annualFee}
            orderCode={actions.latestPaymentData?.orderCode}
            recipientName={actions.latestPaymentData?.recipientName}
            recipientAccountMasked={actions.latestPaymentData?.recipientAccountMasked}
            title="Thanh toán phí thuê kiosk"
            description={`${appData.shopName} · ${rentalMoney(Number(appData.annualFee))}`}
            onClose={(result) => {
              actions.setValidatedCheckoutUrl(null);
              if (result === 'success') actions.reconcileMutation.mutate(appData.id);
              else void applicationQuery.refetch();
            }}
            onRefresh={() => actions.reconcileMutation.mutate(appData.id)}
            onRetryQr={() => actions.paymentLinkMutation.mutate(appData.id)}
            isLoadingQr={actions.paymentLinkMutation.isPending}
            qrError={actions.paymentLinkError}
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

      {/* Demand and registration for first rental or seller additional rental */}
      {!hasActiveApplication && (sessionData.role === 'CUSTOMER' || additional) && (
        <div className="kiosk-registration-layout">
          <div className="kiosk-lease-sidebar">
            <section className="kiosk-packages-section" aria-labelledby="slot-demand-heading">
              <div className="lease-section-heading">
                <span aria-hidden="true">01</span>
                <div>
                  <h2 id="slot-demand-heading">Cấu hình kiosk của bạn</h2>
                  <p>Chọn tổng từ 1 đến 50 ô.</p>
                </div>
              </div>
              {pricingQuery.isPending && <p role="status">Đang tải bảng giá…</p>}
              {pricingQuery.isError && (
                <div role="alert">
                  <p>Chưa tải được bảng giá.</p>
                  <Button onClick={() => void pricingQuery.refetch()}>Tải lại bảng giá</Button>
                </div>
              )}
              {pricingQuery.isSuccess && !pricingReady(pricing) && (
                <p role="status">Chưa có bảng giá. Vui lòng quay lại sau khi quản lý cấu hình.</p>
              )}
              {pricingReady(pricing) && (
                <SlotDemandFields
                  showSteppers
                  pricing={pricing!}
                  walkInSlots={form.walkInSlots}
                  preorderSlots={form.preorderSlots}
                  onChange={(walk, pre) => {
                    form.setWalkInSlots(walk);
                    form.setPreorderSlots(pre);
                    setAcceptedPricingVersion(null);
                  }}
                  disabled={actions.applyMutation.isPending}
                />
              )}
              {form.formErrors.slots && <p role="alert">{form.formErrors.slots}</p>}
            </section>

            <aside className="kiosk-registration-guide" aria-label="Hướng dẫn đăng ký">
              <h2>Sau khi gửi hồ sơ</h2>
              <ol>
                <li>
                  <strong>Thanh toán phí thuê</strong>
                  <span>Thanh toán cho FloraBot qua PayOS.</span>
                </li>
                <li>
                  <strong>Xác nhận & lắp đặt</strong>
                  <span>Quản lý kiểm tra hồ sơ và hẹn lịch kỹ thuật.</span>
                </li>
                <li>
                  <strong>Bàn giao kiosk</strong>
                  <span>Kỳ thuê 12 tháng bắt đầu từ ngày bàn giao.</span>
                </li>
              </ol>
              <p className="kiosk-guide-note">
                Sau khi nộp, bạn có thể theo dõi thanh toán và tiến độ lắp đặt ngay tại đây.
              </p>
            </aside>
          </div>
          <KioskApplicationForm
            additional={additional}
            sellerId={additional ? sellerId || undefined : undefined}
            sellerBank={sellerBankQuery.data}
            rentalReview={
              <div className="kiosk-rental-review">
                <span className="lease-review-label">KIỂM TRA TRƯỚC KHI GỬI</span>
                <p>
                  {form.walkInSlots || 0} ô bán sẵn · {form.preorderSlots || 0} ô đặt trước
                </p>
                <div className="lease-review-price">
                  <span>Phí thuê 12 tháng</span>
                  <strong>{total === null ? 'Chưa xác định' : rentalMoney(total)}</strong>
                </div>
                <p className="lease-payment-note">
                  Phí thuê thanh toán cho FloraBot. Tiền bán hoa nhận qua kênh PayOS riêng của shop.
                </p>
                {pricingReady(pricing) && (
                  <label className="rental-consent">
                    <input
                      type="checkbox"
                      checked={acceptedPricingVersion === pricing?.version}
                      disabled={total === null || actions.applyMutation.isPending}
                      onChange={(e) =>
                        setAcceptedPricingVersion(e.target.checked ? pricing!.version : null)
                      }
                    />{' '}
                    Tôi đã kiểm tra số ô, phân bổ Walk-in / Pre-order và tổng phí thuê.
                  </label>
                )}
                {acceptedPricingVersion !== null && acceptedPricingVersion !== pricing?.version && (
                  <p role="alert">Bảng giá đã thay đổi. Vui lòng xem và xác nhận lại tổng phí.</p>
                )}
              </div>
            }
            shopInfo={{
              shopName: additional ? appData?.shopName || sessionData?.name || '' : form.shopName,
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
            disabled={!canSubmit}
            onSubmit={handleFormSubmit}
          />
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
