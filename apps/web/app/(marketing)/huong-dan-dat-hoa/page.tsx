import Link from 'next/link';
import Layout from '@/marketing/MarketingLayout';
import { Flower2, HelpCircle, MapPin, Package, RotateCcw, ShieldCheck } from '@florabot/ui';

export const metadata = {
  title: 'Hướng dẫn đặt & nhận hoa — FloraBot',
  description: 'Cách đặt mẫu riêng, mua hoa có sẵn và nhận hoa tại tủ bằng mã trên biên nhận.',
};

export default function HuongDanDatHoaPage() {
  return (
    <Layout
      title="Hướng dẫn đặt & nhận hoa — FloraBot"
      description="Cách đặt mẫu riêng, mua hoa có sẵn và nhận hoa tại tủ bằng mã trên biên nhận."
    >
      <main id="main" className="content-page" tabIndex={-1}>
        {/* Hero Section */}
        <div className="guide-hero">
          <div className="guide-badge">
            <Flower2 size={16} aria-hidden="true" />
            <span>Quy trình đặt & nhận hoa thông minh</span>
          </div>
          <h1>Từ một ý tưởng nhỏ đến bó hoa trên tay.</h1>
          <p>
            Chọn cách đặt phù hợp với bạn. Giá, tủ nhận và lịch hẹn luôn được hiển thị minh bạch
            trước khi bạn xác nhận.
          </p>
          <div className="content-actions" style={{ marginTop: '1.25rem' }}>
            <Link className="button button-primary" href="/dat-hoa">
              Chọn hoa của bạn
            </Link>
            <Link className="button button-outline" href="/tai-khoan">
              Theo dõi đơn hàng
            </Link>
          </div>
        </div>

        {/* 6-step Process */}
        <section aria-labelledby="steps-heading">
          <h2 id="steps-heading">Quy trình 6 bước nhận hoa trọn vẹn</h2>
          <ol className="guide-steps-grid">
            <li className="guide-step-card">
              <span className="guide-step-number" aria-hidden="true">
                1
              </span>
              <h3>Chọn sản phẩm hoặc mẫu riêng</h3>
              <p>
                Khám phá danh mục hoa tươi từ các shop uy tín. Chọn mẫu ưng ý hoặc nhập mong muốn
                thiết kế riêng theo dịp tặng và ngân sách.
              </p>
            </li>

            <li className="guide-step-card">
              <span className="guide-step-number" aria-hidden="true">
                2
              </span>
              <h3>Chọn shop, tủ kiosk & thời gian</h3>
              <p>
                Chọn điểm nhận tại tủ kiosk FloraBot thuận tiện trên lộ trình của bạn, cùng khung
                giờ dự kiến đến nhận hoa.
              </p>
            </li>

            <li className="guide-step-card">
              <span className="guide-step-number" aria-hidden="true">
                3
              </span>
              <h3>Nhận báo giá chi tiết</h3>
              <p>
                Shop đối tác xem xét yêu cầu, xác nhận khả năng đáp ứng và gửi báo giá trọn gói cùng
                lịch hoàn thành vào tài khoản của bạn.
              </p>
            </li>

            <li className="guide-step-card">
              <span className="guide-step-number" aria-hidden="true">
                4
              </span>
              <h3>Xác nhận và thanh toán</h3>
              <p>
                Kiểm tra kỹ thông tin và thanh toán trực tuyến an toàn. Đơn hàng được kích hoạt ngay
                khi thanh toán hoàn tất.
              </p>
            </li>

            <li className="guide-step-card">
              <span className="guide-step-number" aria-hidden="true">
                5
              </span>
              <h3>Shop chuẩn bị & nạp vào tủ</h3>
              <p>
                Thợ hoa tỉ mỉ chăm chút từng cành hoa tươi. Hoa được bảo quản cẩn thận và chuyển vào
                ô tủ kiosk giữ lạnh trước giờ hẹn.
              </p>
            </li>

            <li className="guide-step-card">
              <span className="guide-step-number" aria-hidden="true">
                6
              </span>
              <h3>Đến tủ nhận hoa bằng mã</h3>
              <p>
                Đến đúng tủ kiosk trong khung giờ hẹn, mở biên nhận điện tử trên điện thoại và nhập
                mã hoặc quét QR để nhận bó hoa tươi thắm.
              </p>
            </li>
          </ol>
        </section>

        {/* Comparison of 2 Purchase Methods */}
        <section aria-labelledby="methods-heading">
          <h2 id="methods-heading">Hai cách chọn hoa, cùng một điểm hẹn</h2>
          <div className="guide-comparison-grid">
            <div className="guide-comparison-card">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.5rem',
                }}
              >
                <Flower2 size={22} style={{ color: '#174b35' }} aria-hidden="true" />
                <h3>Đặt mẫu riêng để shop chuẩn bị</h3>
              </div>
              <p>
                Dành cho những dịp đặc biệt cần sự chăm chút độc đáo. Bạn chọn mẫu gợi ý, nêu màu
                sắc, thông điệp và lời chúc. Shop xác nhận giá trọn gói và lịch hẹn trước khi bạn
                thanh toán.
              </p>
              <ul style={{ paddingLeft: '1.25rem', marginTop: '0.5rem', color: '#385540' }}>
                <li>Phù hợp: Sinh nhật, kỷ niệm, tặng đối tác, sự kiện lớn.</li>
                <li>Thời gian đặt: Trước từ vài giờ đến 30 ngày.</li>
                <li>Được shop chăm chút thủ công theo đúng ý bạn.</li>
              </ul>
            </div>

            <div className="guide-comparison-card">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.5rem',
                }}
              >
                <Package size={22} style={{ color: '#174b35' }} aria-hidden="true" />
                <h3>Mua hoa có sẵn tại tủ</h3>
              </div>
              <p>
                Xem trực tiếp các bó hoa tươi đang sẵn sàng tại tủ kiosk. Hệ thống giữ bó hoa trong
                thời gian thanh toán. Sau khi hoàn tất, bạn chỉ cần đến tủ trước hạn nhận ghi trên
                đơn.
              </p>
              <ul style={{ paddingLeft: '1.25rem', marginTop: '0.5rem', color: '#385540' }}>
                <li>Phù hợp: Cần hoa gấp, quà tặng ngẫu hứng trong ngày.</li>
                <li>Không phải chờ thợ cắm hoa.</li>
                <li>Thanh toán online giữ chỗ và lấy hoa ngay tại tủ.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Support & FAQ */}
        <section aria-labelledby="support-heading">
          <h2 id="support-heading">Nếu kế hoạch thay đổi hoặc cần trợ giúp</h2>
          <p>Mọi quyền lợi của bạn luôn được hệ thống bảo đảm minh bạch và rõ ràng.</p>
          <div className="guide-support-grid">
            <div className="guide-support-card">
              <ShieldCheck size={24} style={{ color: '#174b35' }} aria-hidden="true" />
              <h3>Thanh toán & biên nhận</h3>
              <p>
                Mọi giao dịch đều sinh biên nhận điện tử với mã tra cứu riêng biệt. Bạn có thể xem
                lại bất cứ lúc nào trong tài khoản hoặc trang tra cứu biên nhận.
              </p>
            </div>

            <div className="guide-support-card">
              <RotateCcw size={24} style={{ color: '#174b35' }} aria-hidden="true" />
              <h3>Hủy đơn & hoàn tiền</h3>
              <p>
                Yêu cầu chưa thanh toán có thể hủy ngay trong tài khoản. Với đơn đã thanh toán, đội
                ngũ FloraBot sẽ đối chiếu trạng thái để xử lý hoàn tiền minh bạch.
              </p>
            </div>

            <div className="guide-support-card">
              <HelpCircle size={24} style={{ color: '#174b35' }} aria-hidden="true" />
              <h3>Chưa nhận được hoa tại tủ</h3>
              <p>
                Nếu gặp trở ngại khi mở tủ hoặc sự cố kỹ thuật, bạn có thể gửi phản ánh trực tiếp từ
                biên nhận đơn hàng để đội ngũ kỹ thuật xử lý nhanh nhất.
              </p>
            </div>

            <div className="guide-support-card">
              <MapPin size={24} style={{ color: '#174b35' }} aria-hidden="true" />
              <h3>Địa điểm đặt tủ kiosk</h3>
              <p>
                Hệ thống tủ tự phục vụ hoạt động 24/7 tại các điểm giao thông thuận tiện. Bạn có thể
                tra cứu vị trí chính xác trên bản đồ.
              </p>
            </div>
          </div>
        </section>

        {/* Action CTAs */}
        <div
          className="content-actions"
          style={{ paddingTop: '1.5rem', borderTop: '1px solid #e1ebe0' }}
        >
          <Link className="button button-primary" href="/dat-hoa">
            Chọn hoa của bạn
          </Link>
          <Link className="button button-outline" href="/tai-khoan">
            Theo dõi đơn hàng
          </Link>
          <Link className="button button-outline" href="/tim-kiosk">
            Tìm kiosk gần bạn
          </Link>
          <Link className="button button-outline" href="/lien-he">
            Liên hệ hỗ trợ
          </Link>
        </div>
      </main>
    </Layout>
  );
}
