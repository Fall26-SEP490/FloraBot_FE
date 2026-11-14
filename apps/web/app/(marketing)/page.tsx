import Layout from '@/features/marketing/MarketingLayout';
import { LandingPricing } from '@/features/marketing/LandingPricing';
import StorefrontFlowers from '@/features/marketing/StorefrontFlowers';
import OccasionsCarousel from '@/features/marketing/OccasionsCarousel';
import '@/features/marketing/styles/home-storefront.css';

export const metadata = { title: 'FloraBot - Đặt hoa theo ý bạn, nhận tại tủ' };
export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <Layout>
      <main id="main" className="home-storefront" tabIndex={-1}>
        {/* Hero Banner: 1 bên ảnh tủ Kiosk thông minh, 1 bên khối nội dung */}
        <section className="home-hero" aria-labelledby="hero-title">
          <div className="home-hero-inner">
            <div className="home-hero-copy">
              <p className="home-hero-eyebrow">BỘ SƯU TẬP HOA CAO CẤP</p>
              <h1 id="hero-title" className="home-hero-title">
                Một bó hoa,
                <br />
                nhiều yêu thương.
              </h1>
              <p className="home-hero-subtitle">
                Chọn mẫu hoa từ các shop, nhận báo giá và hẹn lấy hoa tại kiosk FloraBot.
              </p>
              <div className="home-hero-actions">
                <a className="home-hero-cta" href="#mau-hoa">
                  KHÁM PHÁ NGAY
                </a>
                <a className="home-hero-location" href="/tim-kiosk">
                  Tìm kiosk nhận hoa <span aria-hidden="true">→</span>
                </a>
              </div>
            </div>

            <div className="home-hero-garden">
              <figure className="hero-cabinet">
                <img
                  className="home-hero-photo garden-photo"
                  src="/images/generated/florabot-hero.webp"
                  alt="Minh họa tủ hoa tự phục vụ FloraBot"
                  fetchPriority="high"
                />
              </figure>
            </div>
          </div>
        </section>

        {/* Khối giới thiệu thương hiệu phong cách Editorial Laflora */}
        <section className="home-brand-intro" aria-labelledby="brand-intro-title">
          <div className="brand-intro-content">
            <h2 id="brand-intro-title" className="brand-intro-title">
              Đặt hoa từ shop, nhận tại kiosk — FloraBot
            </h2>
            <p className="brand-intro-text">
              FloraBot kết nối các shop hoa với hệ thống kiosk tự phục vụ. Bạn chọn mẫu, gửi yêu cầu
              và xác nhận báo giá từ shop trước khi thanh toán. Khi hoa sẵn sàng, hãy đến đúng kiosk
              trong thời gian nhận của đơn và dùng mã nhận hoa để lấy hoa.
            </p>
          </div>
        </section>

        {/* Dải hoa văn phân cách phần giới thiệu và danh mục mua sắm */}
        <div className="graphic-divider" aria-hidden="true" />

        <div className="home-content">
          {/* Mục 3: Chọn hoa theo dịp / Shop by collections phong cách Laflora Dubai */}
          <OccasionsCarousel />

          <StorefrontFlowers />

          {/* Dải hoa văn phân cách giữa sản phẩm và hướng dẫn đặt hoa */}
          <div className="graphic-divider" aria-hidden="true" />

          <section id="dat-truoc" className="home-receive" aria-labelledby="preorder-title">
            <div className="home-section-heading">
              <h2 id="preorder-title">Đặt hoa trong 3 bước</h2>
              <a className="text-link" href="/huong-dan-dat-hoa">
                Xem hướng dẫn <span aria-hidden="true">→</span>
              </a>
            </div>
            <ol className="home-steps">
              <li>
                <span aria-hidden="true">01</span>
                <div>
                  <h3>Chọn hoa & gửi yêu cầu</h3>
                  <p>Chọn mẫu, kiosk và thời gian nhận phù hợp với bạn.</p>
                </div>
              </li>
              <li>
                <span aria-hidden="true">02</span>
                <div>
                  <h3>Duyệt báo giá từ shop</h3>
                  <p>Kiểm tra giá và lịch nhận. Xác nhận rồi mới thanh toán.</p>
                </div>
              </li>
              <li>
                <span aria-hidden="true">03</span>
                <div>
                  <h3>Ghé kiosk nhận hoa</h3>
                  <p>Khi hoa sẵn sàng, dùng mã OTP trong email để nhận tại tủ.</p>
                </div>
              </li>
            </ol>
          </section>
          <section className="home-faq" aria-labelledby="faq-title">
            <div>
              <h2 id="faq-title">Trước khi bạn đặt hoa</h2>
              <p>Một vài điều cần biết để chọn hoa và nhận đúng hẹn.</p>
              <a className="text-link" href="/lien-he">
                Liên hệ hỗ trợ <span aria-hidden="true">→</span>
              </a>
            </div>
            <div>
              <details>
                <summary>Giá trên mẫu có phải giá cuối cùng không?</summary>
                <p>
                  Đây là giá tham khảo. Shop gửi báo giá theo yêu cầu và lịch nhận của bạn. Bạn kiểm
                  tra, xác nhận báo giá rồi mới thanh toán.
                </p>
              </details>
              <details>
                <summary>Đã thanh toán nhưng không nhận được hoa?</summary>
                <p>
                  Dùng mã biên nhận để báo sự cố và theo dõi xử lý. Bạn cũng có thể liên hệ hỗ trợ
                  để được hướng dẫn.
                </p>
              </details>
            </div>
          </section>

          {/* Dải hoa văn phân cách trước phần Dành cho shop đối tác */}
          <div className="graphic-divider" aria-hidden="true" />

          <section id="danh-cho-shop" className="home-partner" aria-labelledby="partner-title">
            <div className="home-partner-intro">
              <div>
                <h2 id="partner-title">Mang shop hoa của bạn đến kiosk</h2>
                <p>Thêm điểm bán, nhận đơn đặt trước và quản lý cửa hàng cùng FloraBot.</p>
              </div>
              <a className="button button-primary" href="/thue-kiosk">
                Khám phá dịch vụ thuê kiosk <span aria-hidden="true">→</span>
              </a>
            </div>
            <section
              id="goi-thue"
              className="pricing-section section"
              aria-labelledby="pricing-title"
            >
              <div className="section-intro">
                <h2 id="pricing-title">Phí thuê ô kiosk</h2>
                <p>Giá thuê ô dành cho đối tác tiệm hoa.</p>
              </div>
              <LandingPricing />
            </section>
          </section>
        </div>
      </main>
    </Layout>
  );
}
