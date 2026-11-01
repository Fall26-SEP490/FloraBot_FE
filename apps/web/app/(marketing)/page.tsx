import Layout from '@/features/marketing/MarketingLayout';
import Registration from '@/features/marketing/Registration';
import { LandingPackagesProvider, LandingPricing } from '@/features/marketing/LandingPackages';
import GiftDemo from '@/features/marketing/GiftDemo';
import FlowerPhoto from '@/features/marketing/FlowerPhoto';
import FlowerGallery from '@/features/marketing/FlowerGallery';
import { flowerPhotos } from '@florabot/ui/flower-photos';
const portal = '';
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      name: 'FloraBot',
      url: process.env.SITE_URL || 'http://localhost:8088',
      description: 'Đặt hoa giả theo yêu cầu, duyệt báo giá từ shop và nhận tại tủ kiosk.',
    },
  ],
};

import MarketingEffects from '@/features/marketing/MarketingEffects';

export const metadata = { title: 'FloraBot - Đặt hoa theo ý bạn, nhận tại tủ' };
export const dynamic = 'force-dynamic';
export default function Page() {
  const content = (
    <Layout>
      <link
        rel="preload"
        as="image"
        href="/images/generated/florabot-hero.webp"
        fetchPriority="high"
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <main id="main" tabIndex={-1}>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <h1 id="hero-title">
              <span>Một bó hoa, </span>
              <span className="hero-highlight">thật nhiều thương.</span>
            </h1>
            <p>
              Chọn mẫu hoa giả bạn thích, gửi mong muốn và duyệt báo giá từ shop trước khi thanh
              toán. Nhận tại tủ theo lịch hẹn, hoặc đến kiosk để mua bó hoa có sẵn.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href={`${portal}/dat-hoa`}>
                Chọn hoa & đặt trước{' '}
                <svg
                  aria-hidden="true"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M5 12h14m-6-6 6 6-6 6"></path>
                </svg>
              </a>
              <p className="hero-rate">
                <a href="#goi-thue">Bạn là shop hoa? Khám phá gói thuê tủ</a>
              </p>
            </div>
          </div>
          <div className="hero-garden">
            <figure className="hero-cabinet">
              <img
                className="garden-photo"
                src="/images/generated/florabot-hero.webp"
                width="1200"
                height="800"
                fetchPriority="high"
                alt="Minh họa tủ bán hoa xanh với tám ngăn hoa, bao quanh bởi tulip và hoa cúc"
              />
            </figure>
          </div>
        </section>

        <section id="dat-truoc" className="section preorder-story" aria-labelledby="preorder-title">
          <div className="preorder-intro">
            <h2 id="preorder-title">
              Bạn chọn lời thương.
              <br />
              Shop chăm chút bó hoa.
            </h2>
            <p>
              Chọn mẫu, gửi màu hoa, ngân sách và lời nhắn. Shop xác nhận báo giá cùng lịch nhận tại
              tủ bạn chọn.
            </p>
            <div className="preorder-actions">
              <a className="button button-primary" href={`${portal}/dat-hoa`}>
                Chọn một bó hoa{' '}
                <svg
                  aria-hidden="true"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M5 12h14m-6-6 6 6-6 6"></path>
                </svg>
              </a>
              <a className="text-link" href="/huong-dan-dat-hoa">
                Xem hướng dẫn đặt hoa
              </a>
            </div>
            <div className="preorder-ready">
              <FlowerPhoto photo={flowerPhotos.pastelBouquet} sizes="96px" />
              <p>
                <strong>Cần hoa sớm hơn?</strong>
                <br />
                Xem hoa có sẵn, đến kiosk để chọn bó, thanh toán và nhận hoa trực tiếp.
              </p>
            </div>
          </div>
          <ol className="preorder-steps">
            <li>
              <span aria-hidden="true">01</span>
              <div>
                <h3>Chọn hoa, gửi mong muốn</h3>
                <p>
                  Chọn mẫu, tủ nhận và thời gian mong muốn. Ghi thêm màu hoa, ngân sách hoặc lời
                  nhắn của bạn.
                </p>
              </div>
            </li>
            <li>
              <span aria-hidden="true">02</span>
              <div>
                <h3>Ưng ý rồi mới thanh toán</h3>
                <p>
                  Shop gửi báo giá và lịch nhận. Bạn kiểm tra, xác nhận rồi thanh toán để shop chuẩn
                  bị.
                </p>
              </div>
            </li>
            <li>
              <span aria-hidden="true">03</span>
              <div>
                <h3>Hoa sẵn sàng, bạn ghé nhận</h3>
                <p>
                  Khi đơn sẵn sàng, đến đúng tủ, chọn “Nhận đơn đặt trước” và nhập mã OTP được gửi
                  tới email đăng nhập của bạn.
                </p>
              </div>
            </li>
          </ol>
        </section>
        <div className="graphic-divider" aria-hidden="true"></div>

        <section id="cach-hoat-dong" className="section how" aria-labelledby="how-title">
          <h2 id="how-title">Bán hoa tại tủ như thế nào?</h2>
          <ol className="steps">
            <li>
              <img
                className="step-art"
                src="/images/generated/florabot-step-stock.webp"
                width="600"
                height="600"
                loading="lazy"
                alt=""
              />
              <div className="step-copy">
                <span className="step-number" aria-hidden="true">
                  01
                </span>
                <div>
                  <h3>Shop đưa hoa vào tủ</h3>
                  <p>Phân loại ô Walk-in, chọn mẫu và nạp bó hoa để bán trực tiếp tại tủ.</p>
                </div>
              </div>
            </li>
            <li>
              <img
                className="step-art"
                src="/images/generated/florabot-step-buy.webp"
                width="600"
                height="600"
                loading="lazy"
                alt=""
              />
              <div className="step-copy">
                <span className="step-number" aria-hidden="true">
                  02
                </span>
                <div>
                  <h3>Khách mua tại tủ</h3>
                  <p>Chọn bó có sẵn trên màn hình kiosk, thanh toán và nhận hoa tại ô tủ.</p>
                </div>
              </div>
            </li>
            <li>
              <img
                className="step-art"
                src="/images/generated/florabot-step-manage.webp"
                width="600"
                height="600"
                loading="lazy"
                alt=""
              />
              <div className="step-copy">
                <span className="step-number" aria-hidden="true">
                  03
                </span>
                <div>
                  <h3>Shop theo dõi bán hàng</h3>
                  <p>Theo dõi đơn đặt trước, hoa tại tủ và số dư trong kênh người bán.</p>
                </div>
              </div>
            </li>
          </ol>

          <a className="section-next" href="#goi-thue">
            So sánh gói thuê{' '}
            <span aria-hidden="true">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 5v14m-6-6 6 6 6-6"></path>
              </svg>
            </span>
          </a>
        </section>

        <section id="goi-thue" className="pricing-section section" aria-labelledby="pricing-title">
          <div className="section-intro">
            <h2 id="pricing-title">Gói thuê ô tủ</h2>
            <p>
              Xem phí thuê, tổng số ô và thời hạn của các gói đang được cung cấp. Shop tự phân loại
              ô Walk-in hoặc Pre-order sau khi bàn giao.
            </p>
          </div>
          <LandingPricing />

          <a className="section-next" href="#bo-suu-tap">
            Khám phá hoa{' '}
            <span aria-hidden="true">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 5v14m-6-6 6 6 6-6"></path>
              </svg>
            </span>
          </a>
        </section>

        <section id="bo-suu-tap" className="section gift-section" aria-labelledby="gift-title">
          <h2 id="gift-title">Bộ ảnh cảm hứng hoa</h2>
          <p>Ảnh minh họa để tham khảo phong cách, không phải danh sách sản phẩm đang bán.</p>
          <FlowerGallery />
          <div className="flower-ribbon">
            <FlowerPhoto photo={flowerPhotos.tulipVase} sizes="(max-width: 700px) 90vw, 30vw" />
            <FlowerPhoto photo={flowerPhotos.redRoses} sizes="(max-width: 700px) 90vw, 30vw" />
            <FlowerPhoto photo={flowerPhotos.pastelBouquet} sizes="(max-width: 700px) 90vw, 30vw" />
          </div>
          <div className="gift-tool">
            <GiftDemo />
            <noscript>
              <p>Bật JavaScript để chọn hoa theo ngân sách.</p>
            </noscript>
          </div>

          <a className="section-next" href="#quan-ly">
            Xem cách quản lý{' '}
            <span aria-hidden="true">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 5v14m-6-6 6 6 6-6"></path>
              </svg>
            </span>
          </a>
        </section>

        <section id="quan-ly" className="section money-section" aria-labelledby="money-title">
          <img
            className="money-photo"
            src="/images/floral-white-online.webp"
            width="900"
            height="1440"
            loading="lazy"
            decoding="async"
            alt="Hoa hồng nhiều màu và hoa tím trên nền lá xanh"
          />
          <div className="money-copy">
            <h2 id="money-title">Quản lý đơn hàng và tiền bán</h2>
            <div className="money-benefits">
              <article>
                <h3>Theo dõi từng đơn hàng</h3>
                <p>Báo giá yêu cầu mới, chuẩn bị hoa và cập nhật tiến độ để khách theo dõi.</p>
              </article>
              <article>
                <h3>Xem số dư và rút tiền</h3>
                <p>
                  Kiểm tra số dư có thể rút, khoản đang chờ và gửi yêu cầu về tài khoản nhận tiền
                  của shop.
                </p>
              </article>
              <article>
                <h3>Xử lý đơn gặp sự cố</h3>
                <p>
                  Theo dõi phản ánh và phối hợp với đội ngũ vận hành khi việc nhận hoa không thành
                  công.
                </p>
              </article>
            </div>
          </div>
          <a className="section-next" href="#cau-hoi">
            Câu hỏi thường gặp{' '}
            <span aria-hidden="true">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 5v14m-6-6 6 6 6-6"></path>
              </svg>
            </span>
          </a>
        </section>

        <section id="cau-hoi" className="section faq-section" aria-labelledby="faq-title">
          <div className="faq-visual">
            <h2 id="faq-title">Câu hỏi thường gặp</h2>
            <img
              src="/images/floral-pink-online.webp"
              width="900"
              height="1125"
              loading="lazy"
              decoding="async"
              alt="Một cành hoa diên vĩ hồng trên nền sáng"
            />
          </div>
          <div className="faq-list">
            <details>
              <summary>Đăng ký tư vấn có mất phí không?</summary>
              <p>
                Gửi form tư vấn bên dưới không thu phí. Khi đăng ký thuê chính thức tại mục “Thuê tủ
                kiosk”, bạn nộp hồ sơ và thanh toán phí thuê, sau đó theo dõi xác nhận liên hệ, lắp
                đặt và bàn giao.
              </p>
            </details>
            <details>
              <summary>Shop cần chuẩn bị những gì?</summary>
              <p>
                Shop tạo mẫu hoa giả, ảnh, giá bán và kích thước gồm bao bì; phân loại ô để bán trực
                tiếp hoặc nhận đơn đặt trước, đồng thời bố trí nhân viên nạp và thu hồi hoa.
              </p>
            </details>
            <details>
              <summary>Khách mua hoa tại tủ như thế nào?</summary>
              <p>
                Với bó có sẵn, khách chọn và thanh toán trên màn hình kiosk rồi nhận hoa tại ô tủ.
                Với đơn đặt trước, khách chờ shop báo sẵn sàng, lấy mã OTP trong email đăng nhập và
                chọn “Nhận đơn đặt trước” tại đúng kiosk.
              </p>
            </details>
            <details>
              <summary>Khách trả tiền nhưng không nhận được hoa?</summary>
              <p>
                Khách dùng mã biên nhận để báo sự cố và theo dõi xử lý. Khi xác nhận không giao được
                hoa, yêu cầu hoàn tiền được kiểm tra và chi trả theo quy trình của hệ thống.
              </p>
            </details>
            <details>
              <summary>Hoa hết hạn bán được xử lý ra sao?</summary>
              <p>
                Shop theo dõi trạng thái “Chờ lấy hoa hết hạn” trong mục Hoa tại tủ, kiểm tra và thu
                hồi bó hoa trước khi nạp bó mới.
              </p>
            </details>
          </div>
          <a className="section-next" href="#dang-ky">
            Đăng ký tư vấn{' '}
            <span aria-hidden="true">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 5v14m-6-6 6 6 6-6"></path>
              </svg>
            </span>
          </a>
        </section>

        <section
          id="dang-ky"
          className="section registration-section"
          aria-labelledby="registration-title"
          tabIndex={-1}
        >
          <div className="registration-copy">
            <h2 id="registration-title">Tư vấn thuê ô tủ</h2>
            <span className="context-label">Miễn phí tư vấn</span>
            <FlowerPhoto
              photo={flowerPhotos.flowerShop}
              className="registration-flowers"
              sizes="(max-width: 700px) 90vw, 40vw"
            />
          </div>
          <div>
            <Registration />
            <noscript>
              <p>Bật JavaScript để gửi đăng ký trực tuyến.</p>
            </noscript>
          </div>
        </section>
      </main>
      <MarketingEffects />
    </Layout>
  );
  return <LandingPackagesProvider>{content}</LandingPackagesProvider>;
}
