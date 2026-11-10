'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { kioskPricingQuery, pricingReady, rentalMoney } from '../kiosk-pricing/kiosk-pricing';

export function LandingPricing() {
  const query = useQuery(kioskPricingQuery);

  return (
    <div className="landing-pricing-data" aria-busy={query.isPending}>
      {query.isPending && <p role="status">Đang tải bảng giá…</p>}
      {query.isError && (
        <div role="alert">
          <p>Chưa tải được bảng giá thuê ô.</p>
          <Button onClick={() => void query.refetch()}>Tải lại bảng giá</Button>
        </div>
      )}
      {query.isSuccess && !pricingReady(query.data) && (
        <p role="status">Chưa có bảng giá. Quản lý đang cập nhật giá thuê.</p>
      )}
      {pricingReady(query.data) && (
        <div className="landing-pricing-cards">
          <div className="pricing-card">
            <div className="pricing-card-header">
              <span className="pricing-card-type">Ô bán sẵn</span>
              <span className="pricing-card-subtitle">(Walk-in)</span>
            </div>
            <p className="pricing-card-desc">Nạp hoa để khách ghé mua trực tiếp tại kiosk.</p>
            <div className="pricing-card-rate">
              <span className="pricing-amount">{rentalMoney(query.data!.walkInAnnualPrice!)}</span>
              <span className="pricing-unit"> / ô / năm</span>
            </div>
            <ul className="pricing-card-features">
              <li>Thanh toán qua mã QR tại kiosk</li>
              <li>Tự chủ cập nhật tồn kho qua portal đối tác</li>
            </ul>
          </div>

          <div className="pricing-card featured">
            <div className="pricing-card-header">
              <span className="pricing-card-type">Ô đặt trước</span>
              <span className="pricing-card-subtitle">(Pre-order)</span>
            </div>
            <p className="pricing-card-desc">
              Chuẩn bị hoa theo đơn đặt trước và lưu trữ cho khách lấy theo hẹn.
            </p>
            <div className="pricing-card-rate">
              <span className="pricing-amount">
                {rentalMoney(query.data!.preorderAnnualPrice!)}
              </span>
              <span className="pricing-unit"> / ô / năm</span>
            </div>
            <ul className="pricing-card-features">
              <li>Khách nhận hoa tự phục vụ bằng mã OTP bảo mật</li>
              <li>Trao đổi yêu cầu và gửi báo giá cho khách</li>
              <li>Theo dõi trạng thái chuẩn bị và nhận hoa</li>
            </ul>
          </div>

          <div className="pricing-cta-wrap">
            <Link className="button button-primary pricing-cta-btn" href="/thue-kiosk">
              Đăng ký thuê kiosk →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
