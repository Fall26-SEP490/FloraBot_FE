import Link from 'next/link';
import Layout from '@/features/marketing/MarketingLayout';
import GuideFlowTabs from '@/features/marketing/GuideFlowTabs';
import {
  ArrowRight,
  Flower2,
  HelpCircle,
  MapPin,
  Package,
  RotateCcw,
  ShieldCheck,
} from '@florabot/ui';

export const metadata = {
  title: 'Hướng dẫn đặt & nhận hoa — FloraBot',
  description: 'Cách đặt mẫu riêng, mua hoa có sẵn và nhận hoa tại tủ bằng mã QR hoặc PIN.',
};

export default function HuongDanDatHoaPage() {
  return (
    <Layout
      title="Hướng dẫn đặt & nhận hoa — FloraBot"
      description="Cách đặt mẫu riêng, mua hoa có sẵn và nhận hoa tại tủ bằng mã QR hoặc PIN."
    >
      <main id="main" className="guide-fullwidth-page" tabIndex={-1}>
        {/* Section 1: Hero (Clean White) */}
        <section className="guide-hero-section">
          <div className="guide-container">
            <div className="guide-hero">
              <div className="guide-hero-copy">
                <h1>Từ một ý tưởng nhỏ đến bó hoa trên tay.</h1>
                <p className="guide-hero-lead">
                  Chọn cách mua phù hợp, xem đầy đủ giá và lịch nhận trước khi xác nhận.
                </p>
                <div className="content-actions guide-hero-actions">
                  <Link className="button button-primary guide-cta-primary" href="/dat-hoa">
                    <span>Chọn hoa ngay</span>
                    <ArrowRight size={18} aria-hidden="true" />
                  </Link>
                  <Link className="button button-outline guide-cta-outline" href="/tim-kiosk">
                    <MapPin size={18} aria-hidden="true" />
                    <span>Tìm kiosk</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Methods (Light Sage Section) */}
        <section className="guide-methods-section" aria-labelledby="methods-heading">
          <div className="guide-container">
            <h2 id="methods-heading">Chọn cách mua phù hợp với bạn</h2>
            <div className="guide-comparison-grid">
              <article className="guide-comparison-card guide-comparison-card-featured">
                <div className="guide-card-top">
                  <div className="guide-card-title">
                    <span className="guide-icon-box" aria-hidden="true">
                      <Package size={20} />
                    </span>
                    <h3>Mua có sẵn tại tủ</h3>
                  </div>
                  <span className="guide-card-badge">Nhanh nhất</span>
                </div>
                <p>
                  Chọn mẫu hoa nghệ thuật đang có sẵn tại kiosk, thanh toán online và nhận mã mở tủ.
                </p>
                <div className="guide-pill-group" aria-label="Ưu điểm">
                  <span className="guide-pill">Nhận ngay trong ngày</span>
                  <span className="guide-pill">Không chờ chuẩn bị</span>
                </div>
                <Link className="guide-card-link" href="/dat-hoa?mode=available">
                  Chọn hoa có sẵn <span aria-hidden="true">→</span>
                </Link>
              </article>

              <article className="guide-comparison-card">
                <div className="guide-card-top">
                  <div className="guide-card-title">
                    <span className="guide-icon-box" aria-hidden="true">
                      <Flower2 size={20} />
                    </span>
                    <h3>Đặt mẫu riêng để shop chuẩn bị</h3>
                  </div>
                </div>
                <p>
                  Gửi yêu cầu theo ngân sách; shop báo giá và lịch hẹn trước khi bạn thanh toán.
                </p>
                <div className="guide-pill-group" aria-label="Ưu điểm">
                  <span className="guide-pill">Thiết kế theo yêu cầu</span>
                  <span className="guide-pill">Chủ động lịch nhận</span>
                </div>
                <Link className="guide-card-link" href="/dat-hoa?mode=custom">
                  Gửi yêu cầu đặt riêng <span aria-hidden="true">→</span>
                </Link>
              </article>
            </div>
          </div>
        </section>

        {/* Section 3: Process Tabs (Clean White Section) */}
        <section className="guide-process-wrap-section">
          <div className="guide-container">
            <GuideFlowTabs />
          </div>
        </section>

        {/* Section 4: Support & Trust Badges (Light Sage Section) */}
        <section className="guide-support-section" aria-labelledby="support-heading">
          <div className="guide-container">
            <h2 id="support-heading">Cam kết &amp; hỗ trợ</h2>
            <p className="guide-support-lead">Thông tin rõ ràng từ lúc thanh toán đến khi mở tủ.</p>
            <div className="guide-support-grid">
              <article className="guide-support-card">
                <span className="guide-icon-box" aria-hidden="true">
                  <ShieldCheck size={22} />
                </span>
                <h3>Mã nhận hoa minh bạch</h3>
                <p>Tra cứu mã mở tủ và trạng thái đơn bất cứ lúc nào.</p>
              </article>

              <article className="guide-support-card">
                <span className="guide-icon-box" aria-hidden="true">
                  <RotateCcw size={22} />
                </span>
                <h3>Hủy đơn linh hoạt</h3>
                <p>Hủy đơn chưa thanh toán; hoàn tiền rõ ràng sau đối chiếu.</p>
              </article>

              <article className="guide-support-card">
                <span className="guide-icon-box" aria-hidden="true">
                  <HelpCircle size={22} />
                </span>
                <h3>Hỗ trợ khi nhận hoa</h3>
                <p>Báo lỗi mở tủ ngay trong chi tiết đơn để được xử lý.</p>
              </article>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
