import Layout from '@/marketing/MarketingLayout';
import InfoHint from '@/marketing/InfoHint';
const sections = [
  { id: 'dang-ky', title: 'Thông tin đăng ký' },
  { id: 'giao-dich', title: 'Đơn hàng & giao dịch' },
  { id: 'hoan-tien', title: 'Thông tin nhận hoàn' },
  { id: 'quyen-du-lieu', title: 'Quyền của bạn' },
  { id: 'dich-vu', title: 'Dịch vụ bên ngoài' },
];

export const metadata = {
  title: 'Chính sách riêng tư — FloraBot',
  description:
    'Thông tin FloraBot sử dụng, mục đích xử lý và quyền của bạn đối với dữ liệu trong bản thử nghiệm.',
};
export default function Page() {
  return (
    <Layout
      title="Chính sách riêng tư — FloraBot"
      description="Thông tin FloraBot sử dụng, mục đích xử lý và quyền của bạn đối với dữ liệu trong bản thử nghiệm."
    >
      <main id="main" className="privacy-page" tabIndex={-1}>
        <header className="privacy-hero">
          <div>
            <h1>Quyền riêng tư của bạn.</h1>
            <p>Thông tin được dùng để tư vấn và xử lý giao dịch.</p>
          </div>
          <div className="privacy-meta">
            <span className="context-label">Bản thử nghiệm · 08/10/2026</span>
            <InfoHint label="Phạm vi áp dụng">
              <p>
                Chính sách này áp dụng cho bản thử nghiệm FloraBot. Thông tin pháp nhân, địa chỉ và
                đầu mối bảo vệ dữ liệu cần được công bố trước khi triển khai thương mại.
              </p>
            </InfoHint>
          </div>
        </header>
        <div className="privacy-layout">
          <nav className="privacy-nav" aria-label="Nội dung chính sách">
            <p>Trong trang này</p>
            {sections.map((section) => (
              <a href={`#${section.id}`}>{section.title}</a>
            ))}
          </nav>
          <div className="privacy-content">
            <section id="dang-ky" aria-labelledby="privacy-registration-title">
              <h2 id="privacy-registration-title">Thông tin đăng ký</h2>
              <p>
                Tên shop, số điện thoại, khu vực và gói quan tâm giúp FloraBot tư vấn điểm bán phù
                hợp.
              </p>
              <InfoHint label="Mục đích sử dụng">
                <p>
                  Thông tin được dùng để liên hệ tư vấn, kiểm tra vị trí và duyệt hồ sơ shop. Đăng
                  ký tư vấn không yêu cầu thông tin ngân hàng.
                </p>
              </InfoHint>
            </section>
            <section id="giao-dich" aria-labelledby="privacy-orders-title">
              <h2 id="privacy-orders-title">Đơn hàng &amp; giao dịch</h2>
              <p>
                Dữ liệu đơn hàng phục vụ vận hành, đối soát và xử lý sự cố. Khách có thể mua hoa
                không cần tạo tài khoản.
              </p>
              <p>
                Sau khi nhận hoa thành công, bạn có thể chủ động lưu biên nhận trên thiết bị riêng.
                Trình duyệt lưu ID đơn, mã tra cứu, mã đơn và ngày lưu, tối đa 50 biên nhận; không
                tự đồng bộ sang thiết bị khác. Người dùng chung thiết bị có thể xem các biên nhận đã
                lưu. Bạn có thể xóa từng bản lưu hoặc toàn bộ trong mục Biên nhận đã lưu. Việc xóa
                bản lưu không xóa giao dịch trong hệ thống. Kiosk không tự lưu danh sách này.
              </p>
              <a className="text-link" href="/lich-su-mua">
                Quản lý biên nhận đã lưu
              </a>
              <InfoHint label="Thông tin đăng nhập">
                <p>
                  OTP đăng nhập chỉ được lưu tạm trong cache, không lưu trong cơ sở dữ liệu nghiệp
                  vụ.
                </p>
              </InfoHint>
            </section>
            <section id="hoan-tien" aria-labelledby="privacy-refund-title">
              <h2 id="privacy-refund-title">Thông tin nhận hoàn</h2>
              <p>
                Ngân hàng, số tài khoản và tên chủ tài khoản chỉ được yêu cầu khi khách nhận hoàn
                tiền.
              </p>
              <InfoHint label="Bảo vệ và lưu trữ">
                <p>
                  Số tài khoản được mã hóa. Thông tin nhận hoàn được xóa sau khi chi hết các khoản
                  hoàn của đơn.
                </p>
              </InfoHint>
            </section>
            <section id="quyen-du-lieu" aria-labelledby="privacy-rights-title">
              <h2 id="privacy-rights-title">Quyền của bạn</h2>
              <p>Bạn có thể yêu cầu truy cập, chỉnh sửa, rút lại sự đồng ý hoặc xóa dữ liệu.</p>
              <a className="text-link" href="/#dang-ky">
                Liên hệ đội ngũ FloraBot
              </a>
              <InfoHint label="Quy định và thời hạn lưu trữ">
                <p>
                  Quyền đối với dữ liệu được thực hiện theo quy định áp dụng, trong đó có Nghị định
                  13/2023/NĐ-CP. Một số chứng từ giao dịch cần được lưu theo nghĩa vụ pháp lý. Trong
                  bản thử nghiệm, đầu mối liên hệ và thời hạn lưu trữ được xác nhận tại bước tư vấn.
                </p>
              </InfoHint>
            </section>
            <section id="dich-vu" aria-labelledby="privacy-services-title">
              <h2 id="privacy-services-title">Dịch vụ bên ngoài</h2>
              <p>
                OpenStreetMap cung cấp bản đồ. payOS xử lý thanh toán khi tính năng này được cấu
                hình.
              </p>
              <InfoHint label="Dữ liệu được gửi khi nào?">
                <p>
                  Khi bạn mở bản đồ, trình duyệt gửi yêu cầu tải bản đồ tới OpenStreetMap. Dữ liệu
                  thanh toán được gửi qua payOS trong luồng thanh toán đã được cấu hình.
                </p>
              </InfoHint>
            </section>
            <a className="button button-outline" href="/">
              Trở về trang chủ
            </a>
          </div>
        </div>
      </main>
    </Layout>
  );
}
