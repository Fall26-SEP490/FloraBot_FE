import Layout from '@/features/marketing/MarketingLayout';
import Registration from '@/features/marketing/Registration';
import { LandingPackagesProvider, LandingPricing } from '@/features/marketing/LandingPackages';
import StorefrontFlowers from '@/features/marketing/StorefrontFlowers';
import '@/features/marketing/styles/home-storefront.css';

export const metadata = { title: 'FloraBot - Đặt hoa theo ý bạn, nhận tại tủ' };
export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <Layout>
      <main id="main" className="home-storefront" tabIndex={-1}>
        <section className="home-hero" aria-labelledby="hero-title">
          <div className="home-hero-inner">
            <div className="home-hero-copy">
              <h1 id="hero-title">
                Một bó hoa,
                <br />
                thật nhiều thương.
              </h1>
              <p>Hoa giả theo yêu cầu của bạn, nhận tại kiosk theo lịch hẹn.</p>
              <a className="button button-primary" href="#mau-hoa">
                Khám phá mẫu hoa <span aria-hidden="true">→</span>
              </a>
              <a className="home-hero-location" href="/tim-kiosk">
                Tìm kiosk nhận hoa
              </a>
            </div>
            <img
              className="home-hero-image"
              src="/images/generated/florabot-hero.webp"
              width={1200}
              height={800}
              fetchPriority="high"
              alt="Minh họa tủ FloraBot giữa khu vườn hoa"
            />
          </div>
        </section>
        <div className="home-content">
          <StorefrontFlowers />
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
            <div className="home-location">
              <p>Chưa biết nhận hoa ở đâu?</p>
              <a href="/tim-kiosk">
                Xem vị trí kiosk <span aria-hidden="true">→</span>
              </a>
            </div>
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
                <summary>Tôi nhận hoa tại kiosk như thế nào?</summary>
                <p>
                  Khi shop báo hoa đã sẵn sàng, đến đúng kiosk, chọn “Nhận đơn đặt trước” và nhập mã
                  OTP được gửi tới email đăng nhập của bạn.
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
            <details className="home-partner-details">
              <summary>Xem gói thuê & đăng ký tư vấn</summary>
              <LandingPackagesProvider>
                <section
                  id="goi-thue"
                  className="pricing-section section"
                  aria-labelledby="pricing-title"
                >
                  <div className="section-intro">
                    <h2 id="pricing-title">Gói thuê kiosk</h2>
                    <p>Phí thuê hằng năm và số ô theo từng gói.</p>
                  </div>
                  <LandingPricing />
                </section>
                <section
                  id="dang-ky"
                  className="section registration-section"
                  aria-labelledby="registration-title"
                  tabIndex={-1}
                >
                  <div>
                    <h2 id="registration-title">Tư vấn thuê kiosk</h2>
                    <p>
                      Để lại thông tin để FloraBot liên hệ tư vấn gói phù hợp. Gửi yêu cầu tư vấn
                      không mất phí.
                    </p>
                  </div>
                  <Registration />
                </section>
              </LandingPackagesProvider>
            </details>
          </section>
        </div>
      </main>
    </Layout>
  );
}
