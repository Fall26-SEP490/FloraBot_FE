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
  shopInfo: ShopInfoFieldsProps;
  location: React.ComponentProps<typeof KioskLocationFields>;
  payout: React.ComponentProps<typeof PayoutAccountFields>;
  submitError: string;
  errorBannerRef: RefObject<HTMLDivElement | null>;
  isPending: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function KioskApplicationForm({
  shopInfo,
  location,
  payout,
  submitError,
  errorBannerRef,
  isPending,
  onSubmit,
}: KioskApplicationFormProps) {
  return (
    <section className="kiosk-form-section" aria-labelledby="application-form-heading">
      <div className="section-title-wrap">
        <h2 id="application-form-heading">2. Thông tin đăng ký</h2>
        <p>Các mục có dấu * là bắt buộc. Kiểm tra thông tin trước khi gửi hồ sơ.</p>
      </div>

      {submitError && (
        <div ref={errorBannerRef} tabIndex={-1} role="alert" className="kiosk-field-error-banner">
          <CircleAlert size={20} aria-hidden="true" />
          <span>{submitError}</span>
        </div>
      )}

      <form noValidate onSubmit={onSubmit} className="kiosk-application-form">
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
                Dùng để nhận thông báo vận hành shop. Không thay đổi email đăng nhập của tài khoản.
              </small>
              {shopInfo.contactEmailError && (
                <p className="kiosk-field-error">{shopInfo.contactEmailError}</p>
              )}
            </div>
          </div>
        </fieldset>

        <KioskLocationFields {...location} />
        <PayoutAccountFields {...payout} />

        <div className="kiosk-form-actions">
          <Button type="submit" disabled={isPending} className="submit-application-btn">
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
