import Link from 'next/link';
import Layout from '@/features/marketing/MarketingLayout';
import { HelpCircle, MapPin, Package, ShieldCheck, Store } from '@florabot/ui';

export const metadata = {
  title: 'Liên hệ & hỗ trợ — FloraBot',
  description:
    'Theo dõi đơn, mở biên nhận để báo sự cố hoặc gửi yêu cầu tư vấn thuê tủ cho shop hoa.',
};

export default function LienHePage() {
  return (
    <Layout
      title="Liên hệ & hỗ trợ — FloraBot"
      description="Theo dõi đơn, mở biên nhận để báo sự cố hoặc gửi yêu cầu tư vấn thuê tủ cho shop hoa."
    >
      <main id="main" className="content-page" tabIndex={-1}>
        <div className="guide-hero">
          <div className="guide-badge">
            <HelpCircle size={16} aria-hidden="true" />
            <span>Trung tâm hỗ trợ khách hàng & đối tác</span>
          </div>
          <h1>Bạn cần hỗ trợ điều gì?</h1>
          <p>
            Chọn đúng khu vực hỗ trợ bên dưới để thông tin được chuyển thẳng đến bộ phận liên quan
            cùng mã đơn hoặc hồ sơ shop của bạn.
          </p>
        </div>

        <section aria-labelledby="support-topics-heading">
          <h2 id="support-topics-heading">Các chủ đề trợ giúp thường gặp</h2>
          <div className="guide-support-grid" style={{ marginTop: '1.25rem' }}>
            {/* Card 1: Orders and Quotes */}
            <div className="guide-support-card">
              <Package size={28} style={{ color: '#174b35' }} aria-hidden="true" />
              <h3>Đơn đặt hoa & Báo giá</h3>
              <p>
                Kiểm tra phản hồi của shop, thời hạn hiệu lực của báo giá, lịch nhận và trạng thái
                thanh toán trực tiếp trong tài khoản của bạn.
              </p>
              <div style={{ marginTop: 'auto', paddingTop: '0.75rem' }}>
                <Link
                  className="button button-primary"
                  href="/tai-khoan#web-orders"
                  style={{ width: '100%', fontSize: '0.85rem' }}
                >
                  Mở đơn đặt trước
                </Link>
              </div>
            </div>

            {/* Card 2: Receipt & Issue Report */}
            <div className="guide-support-card">
              <ShieldCheck size={28} style={{ color: '#174b35' }} aria-hidden="true" />
              <h3>Đã thanh toán nhưng chưa nhận hoa</h3>
              <p>
                Tra cứu biên nhận bằng mã đơn và mã bảo mật để xem trạng thái tủ kiosk, gửi phản ánh
                sự cố kỹ thuật hoặc cung cấp thông tin hoàn tiền.
              </p>
              <div style={{ marginTop: 'auto', paddingTop: '0.75rem' }}>
                <Link
                  className="button button-outline"
                  href="/receipt"
                  style={{ width: '100%', fontSize: '0.85rem' }}
                >
                  Tra cứu biên nhận
                </Link>
              </div>
            </div>

            {/* Card 3: Partner with FloraBot */}
            <div className="guide-support-card">
              <Store size={28} style={{ color: '#174b35' }} aria-hidden="true" />
              <h3>Hợp tác mở shop & thuê kiosk</h3>
              <p>
                Bạn là chủ tiệm hoa hoặc thợ cắm hoa muốn tiếp cận khách hàng qua hệ thống tủ kiosk
                tự phục vụ của FloraBot? Hãy tìm hiểu gói thuê và đăng ký mở shop.
              </p>
              <div style={{ marginTop: 'auto', paddingTop: '0.75rem' }}>
                <Link
                  className="button button-outline"
                  href="/thue-kiosk"
                  style={{ width: '100%', fontSize: '0.85rem' }}
                >
                  Xem gói thuê kiosk
                </Link>
              </div>
            </div>

            {/* Card 4: Kiosk Locator */}
            <div className="guide-support-card">
              <MapPin size={28} style={{ color: '#174b35' }} aria-hidden="true" />
              <h3>Vị trí tủ bán hoa</h3>
              <p>
                Tra cứu các điểm đặt tủ kiosk tự phục vụ tại TP.HCM (Trường Đại học FPT, Nhà Văn hóa
                Thanh Niên, Landmark 81, ĐH Bách Khoa...).
              </p>
              <div style={{ marginTop: 'auto', paddingTop: '0.75rem' }}>
                <Link
                  className="button button-outline"
                  href="/tim-kiosk"
                  style={{ width: '100%', fontSize: '0.85rem' }}
                >
                  Xem bản đồ tủ kiosk
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Official Channels Notice */}
        <section aria-labelledby="contact-channels-heading">
          <h2 id="contact-channels-heading">Kênh thông tin trực tiếp</h2>
          <div
            style={{
              background: '#f8fbf6',
              border: '1px solid #d8e8ce',
              borderRadius: '16px',
              padding: '1.5rem',
            }}
          >
            <p style={{ margin: 0, color: '#385540', lineHeight: 1.6 }}>
              Hệ thống đang trong giai đoạn triển khai thử nghiệm. Mọi trao đổi giữa khách hàng và
              cửa hàng được hỗ trợ trực tuyến qua tính năng <strong>Tin nhắn realtime</strong> trên
              website. Các kênh hotline và email chính thức sẽ được công bố khi hoàn tất giai đoạn
              tích hợp.
            </p>
          </div>
        </section>

        <div
          className="content-actions"
          style={{ paddingTop: '1.5rem', borderTop: '1px solid #e1ebe0' }}
        >
          <Link className="button button-primary" href="/dat-hoa">
            Khám phá hoa tươi
          </Link>
          <Link className="button button-outline" href="/huong-dan-dat-hoa">
            Xem hướng dẫn đặt hoa
          </Link>
          <Link className="button button-outline" href="/tai-khoan">
            Vào tài khoản của bạn
          </Link>
        </div>
      </main>
    </Layout>
  );
}
