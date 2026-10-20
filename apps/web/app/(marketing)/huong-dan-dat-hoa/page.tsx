import Link from 'next/link';
import Layout from '@/marketing/MarketingLayout';
import GuideFlowTabs from '@/marketing/GuideFlowTabs';
import { Flower2, HelpCircle, Package, RotateCcw, ShieldCheck } from '@florabot/ui';

export const metadata = {
  title: 'Hướng dẫn đặt & nhận hoa — FloraBot',
  description: 'Cách đặt mẫu riêng, mua hoa có sẵn và nhận hoa tại tủ bằng mã trên biên nhận.',
};

function ReceiptPreview() {
  return (
    <figure className="guide-hero-visual" aria-labelledby="receipt-preview-caption">
      <div className="guide-receipt-card">
        <div className="guide-receipt-note">Dữ liệu minh họa</div>
        <div className="guide-receipt-header">
          <div>
            <span className="guide-receipt-eyebrow">Biên nhận điện tử</span>
            <strong className="guide-receipt-id">#FB-2084</strong>
          </div>
          <span className="guide-receipt-status">
            <span className="guide-status-dot" aria-hidden="true" />
            Sẵn sàng tại tủ
          </span>
        </div>

        <div className="guide-receipt-meta">
          <div className="guide-receipt-row">
            <span>Mẫu hoa</span>
            <strong>Bó hoa nghệ thuật pastel</strong>
          </div>
          <div className="guide-receipt-row">
            <span>Điểm nhận</span>
            <strong>Kiosk Thảo Điền · Ô B04</strong>
          </div>
        </div>

        <div className="guide-receipt-access">
          <div className="guide-qr-box" aria-hidden="true">
            <svg viewBox="0 0 64 64" width="64" height="64" fill="none">
              <rect width="64" height="64" rx="8" fill="#FFFFFF" />
              <path
                fill="#174b35"
                d="M8 8h18v18H8V8zm3.5 3.5v11h11v-11h-11zm3 3h5v5h-5v-5zM38 8h18v18H38V8zm3.5 3.5v11h11v-11h-11zm3 3h5v5h-5v-5zM8 38h18v18H8V38zm3.5 3.5v11h11v-11h-11zm3 3h5v5h-5v-5zm15.5-36.5h4v8h-4V8zm0 12h4v6h-4v-6zM8 30h8v4H8v-4zm12 0h10v4H20v-4zm14 0h6v6h-6v-6zm10-2h4v6h-4v-6zm6 2h6v8h-6v-8zM30 40h4v16h-4V40zm8 0h8v4h-8v-4zm10 4h8v12h-8V44zm-8 8h4v4h-4v-4z"
              />
            </svg>
            <span>Quét QR</span>
          </div>

          <div className="guide-pin-box">
            <span className="guide-pin-label">Hoặc nhập PIN 6 số</span>
            <div className="guide-pin-digits" aria-label="Mã PIN minh họa 849206">
              {'849206'.split('').map((digit, index) => (
                <span key={`${digit}-${index}`}>{digit}</span>
              ))}
            </div>
            <span className="guide-pin-caption">Dùng tại màn hình kiosk</span>
          </div>
        </div>
      </div>
      <figcaption id="receipt-preview-caption" className="sr-only">
        Minh họa biên nhận điện tử gồm mã QR và PIN 6 số để nhận hoa tại kiosk.
      </figcaption>
    </figure>
  );
}

export default function HuongDanDatHoaPage() {
  return (
    <Layout
      title="Hướng dẫn đặt & nhận hoa — FloraBot"
      description="Cách đặt mẫu riêng, mua hoa có sẵn và nhận hoa tại tủ bằng mã trên biên nhận."
    >
      <main id="main" className="content-page guide-page" tabIndex={-1}>
        <div className="guide-hero guide-hero-split">
          <div className="guide-hero-copy">
            <div className="guide-badge">
              <Flower2 size={16} aria-hidden="true" />
              <span>Quy trình đặt & nhận hoa thông minh</span>
            </div>
            <h1>Từ một ý tưởng nhỏ đến bó hoa trên tay.</h1>
            <p className="guide-hero-lead">
              Chọn cách mua phù hợp, xem đầy đủ giá và lịch nhận trước khi xác nhận.
            </p>
            <div className="content-actions guide-hero-actions">
              <Link className="button button-primary" href="/dat-hoa">
                Chọn hoa ngay
              </Link>
              <Link className="button button-outline" href="/tim-kiosk">
                Tìm kiosk
              </Link>
            </div>
          </div>
          <ReceiptPreview />
        </div>

        <section className="guide-methods-section" aria-labelledby="methods-heading">
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
              <p>Gửi yêu cầu theo ngân sách; shop báo giá và lịch hẹn trước khi bạn thanh toán.</p>
              <div className="guide-pill-group" aria-label="Ưu điểm">
                <span className="guide-pill">Thiết kế theo yêu cầu</span>
                <span className="guide-pill">Chủ động lịch nhận</span>
              </div>
              <Link className="guide-card-link" href="/dat-hoa?mode=custom">
                Gửi yêu cầu đặt riêng <span aria-hidden="true">→</span>
              </Link>
            </article>
          </div>
        </section>

        <GuideFlowTabs />

        <section className="guide-support-section" aria-labelledby="support-heading">
          <h2 id="support-heading">Cam kết & hỗ trợ</h2>
          <p className="guide-support-lead">Thông tin rõ ràng từ lúc thanh toán đến khi mở tủ.</p>
          <div className="guide-support-grid">
            <article className="guide-support-card">
              <span className="guide-icon-box" aria-hidden="true">
                <ShieldCheck size={20} />
              </span>
              <h3>Biên nhận minh bạch</h3>
              <p>Tra cứu mã mở tủ và trạng thái đơn bất cứ lúc nào.</p>
            </article>

            <article className="guide-support-card">
              <span className="guide-icon-box" aria-hidden="true">
                <RotateCcw size={20} />
              </span>
              <h3>Hủy đơn linh hoạt</h3>
              <p>Hủy đơn chưa thanh toán; hoàn tiền rõ ràng sau đối chiếu.</p>
            </article>

            <article className="guide-support-card">
              <span className="guide-icon-box" aria-hidden="true">
                <HelpCircle size={20} />
              </span>
              <h3>Hỗ trợ khi nhận hoa</h3>
              <p>Báo lỗi mở tủ ngay trên biên nhận để được xử lý.</p>
            </article>
          </div>
        </section>
      </main>
    </Layout>
  );
}
