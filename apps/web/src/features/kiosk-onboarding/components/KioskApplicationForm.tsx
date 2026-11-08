import type { RefObject } from 'react';
import Link from 'next/link';
import { Button, CircleAlert } from '@florabot/ui';
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
  rentalReview?: React.ReactNode;
  shopInfo: ShopInfoFieldsProps;
  location: React.ComponentProps<typeof KioskLocationFields>;
  payout: React.ComponentProps<typeof PayoutAccountFields>;
  submitError: string;
  errorBannerRef: RefObject<HTMLDivElement | null>;
  isPending: boolean;
  disabled?: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function KioskApplicationForm({
  shopInfo,
  additional = false,
  rentalReview,
  location,
  payout,
  submitError,
  errorBannerRef,
  isPending,
  disabled = false,
  onSubmit,
}: KioskApplicationFormProps) {
  return (
    <section className="kiosk-form-section" aria-labelledby="application-form-heading">
      <div className="section-title-wrap">
        <span className="lease-form-eyebrow">02 · HỒ SƠ THUÊ KIOSK</span>
        <h2 id="application-form-heading">
          {additional ? 'Kiosk mới sẽ đặt ở đâu?' : 'Thông tin đăng ký'}
        </h2>
        <p>
          {additional
            ? 'Thông tin cửa hàng được dùng lại từ hồ sơ shop. Bạn chỉ cần chọn địa điểm lắp đặt mới.'
            : 'Điền thông tin cửa hàng và vị trí lắp đặt. Các mục có dấu * là bắt buộc.'}
        </p>
      </div>

      {submitError && (
        <div ref={errorBannerRef} tabIndex={-1} role="alert" className="kiosk-field-error-banner">
          <CircleAlert size={20} aria-hidden="true" />
          <span>{submitError}</span>
        </div>
      )}

      <form noValidate onSubmit={onSubmit} className="kiosk-application-form">
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
        {additional && (
          <p className="lease-profile-note">
            Hồ sơ này sử dụng thông tin liên hệ và tài khoản ngân hàng đã lưu của shop.{' '}
            <Link href="/seller">Về trang quản lý shop</Link>
          </p>
        )}
        {rentalReview}

        {disabled && !isPending && (
          <p className="lease-submit-hint">
            Chọn số ô hợp lệ và đánh dấu xác nhận phí thuê để có thể gửi hồ sơ.
          </p>
        )}
        <div className="kiosk-form-actions">
          <Button type="submit" disabled={isPending || disabled} className="submit-application-btn">
            {isPending ? 'Đang gửi hồ sơ...' : 'Nộp hồ sơ thuê kiosk'}
          </Button>
          <Link href="/tai-khoan" className="button button-outline">
            Quay lại tài khoản
          </Link>
        </div>
      </form>
    </section>
  );
}
