import type { RefObject } from 'react';
import Link from 'next/link';
import { Button, CircleAlert, Store } from '@florabot/ui';
import ShopBankSection, {
  type SellerBankResponse,
} from '@/features/finance/components/payment-channels/ShopBankSection';
import { KioskLocationFields } from './KioskLocationFields';
import { PayoutAccountFields } from './PayoutAccountFields';

export interface ShopInfoFieldsProps {
  shopName: string;
  onShopNameChange: (val: string) => void;
  shopNameError?: string;
  phone: string;
  onPhoneChange: (val: string) => void;
  phoneError?: string;
  contactEmail: string;
  onContactEmailChange: (val: string) => void;
  contactEmailError?: string;
}

interface KioskApplicationFormProps {
  additional?: boolean;
  sellerId?: string;
  sellerBank?: SellerBankResponse | null;
  rentalReview?: React.ReactNode;
  shopInfo: ShopInfoFieldsProps;
  location: React.ComponentProps<typeof KioskLocationFields>;
  payout: React.ComponentProps<typeof PayoutAccountFields>;
  submitError: string;
  errorBannerRef: RefObject<HTMLDivElement | null>;
  isPending: boolean;
  disabled?: boolean;
  submitHint?: string;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

export function KioskApplicationForm({
  shopInfo,
  additional = false,
  sellerId,
  sellerBank,
  rentalReview,
  location,
  payout,
  submitError,
  errorBannerRef,
  isPending,
  disabled = false,
  submitHint,
  onSubmit,
}: KioskApplicationFormProps) {
  return (
    <section
      className={['kiosk-form-section', additional && 'is-additional'].filter(Boolean).join(' ')}
      aria-labelledby="application-form-heading"
    >
      <div className="section-title-wrap">
        <h2 id="application-form-heading">{additional ? 'Vị trí lắp đặt' : 'Thông tin đăng ký'}</h2>
      </div>

      {submitError && (
        <div ref={errorBannerRef} tabIndex={-1} role="alert" className="kiosk-field-error-banner">
          <CircleAlert size={20} aria-hidden="true" />
          <span>{submitError}</span>
        </div>
      )}

      {additional && sellerId && sellerBank && sellerBank.status !== 'READY' && (
        <div className="lease-seller-bank-embedded">
          <ShopBankSection
            sellerId={sellerId}
            variant="embedded"
            title="Khai báo tài khoản ngân hàng của shop (Bắt buộc trước khi thuê)"
          />
        </div>
      )}

      <form noValidate onSubmit={onSubmit} className="kiosk-application-form">
        {additional && (
          <div className="lease-seller-card" role="region" aria-label="Cửa hàng đăng ký">
            <div className="lease-seller-header">
              <span className="lease-seller-icon" aria-hidden="true">
                <Store size={22} />
              </span>
              <div>
                <span className="lease-seller-badge">Cửa hàng đăng ký</span>
                <strong className="lease-seller-name">
                  {shopInfo.shopName || 'Cửa hàng của bạn'}
                </strong>
              </div>
            </div>

            {sellerBank?.status === 'READY' && (
              <div className="lease-seller-bank-row is-ready">
                <span className="lease-seller-bank-badge">Ngân hàng nhận hoàn phí</span>
                <strong>{sellerBank.bankName}</strong> · <span>{sellerBank.holder}</span> ·{' '}
                <code>••••{sellerBank.accountSuffix}</code>
                <Link
                  href="/seller/commerce"
                  className="lease-seller-link"
                  style={{ marginLeft: 'auto' }}
                >
                  Thay đổi
                </Link>
              </div>
            )}
          </div>
        )}
        {!additional && (
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
                value={shopInfo.shopName}
                onChange={(e) => shopInfo.onShopNameChange(e.target.value)}
                placeholder="Ví dụ: Tiệm Hoa Xinh Đà Lạt"
                required
                aria-invalid={!!shopInfo.shopNameError}
                aria-describedby={shopInfo.shopNameError ? 'shop-name-error' : undefined}
              />
              {shopInfo.shopNameError && (
                <p id="shop-name-error" className="kiosk-field-error">
                  {shopInfo.shopNameError}
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
                  value={shopInfo.phone}
                  onChange={(e) => shopInfo.onPhoneChange(e.target.value)}
                  placeholder="0901234567"
                  required
                  aria-invalid={!!shopInfo.phoneError}
                  aria-describedby={shopInfo.phoneError ? 'shop-phone-error' : undefined}
                />
                {shopInfo.phoneError && (
                  <p id="shop-phone-error" className="kiosk-field-error">
                    {shopInfo.phoneError}
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
                  value={shopInfo.contactEmail}
                  onChange={(e) => shopInfo.onContactEmailChange(e.target.value)}
                  placeholder="contact@tiemhoaxinh.vn"
                  required
                  aria-invalid={!!shopInfo.contactEmailError}
                  aria-describedby="contact-email-hint"
                />
                <small id="contact-email-hint" className="kiosk-field-hint">
                  Dùng để nhận thông báo vận hành shop. Không thay đổi email đăng nhập của tài
                  khoản.
                </small>
                {shopInfo.contactEmailError && (
                  <p className="kiosk-field-error">{shopInfo.contactEmailError}</p>
                )}
              </div>
            </div>
          </fieldset>
        )}

        <KioskLocationFields {...location} />
        {!additional && <PayoutAccountFields {...payout} />}
        {rentalReview}

        {submitHint && !isPending && (
          <p id="lease-submit-hint" className="lease-submit-hint">
            {submitHint}
          </p>
        )}
        <div className="kiosk-form-actions">
          <Button
            type="submit"
            disabled={isPending || disabled}
            className="submit-application-btn"
            aria-describedby={
              submitHint && !isPending
                ? 'lease-submit-hint lease-submit-payment-note'
                : 'lease-submit-payment-note'
            }
          >
            {isPending ? 'Đang gửi hồ sơ...' : 'Nộp hồ sơ thuê kiosk'}
          </Button>
        </div>
        <p id="lease-submit-payment-note" className="lease-submit-hint">
          Gửi hồ sơ chưa thu tiền. Bạn thanh toán ở bước tiếp theo.
        </p>
      </form>
    </section>
  );
}
