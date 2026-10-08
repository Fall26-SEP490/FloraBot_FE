import Layout from '@/marketing/MarketingLayout';
const portal = '';

export const metadata = {
  title: 'Hướng dẫn đặt & nhận hoa — FloraBot',
  description: 'Cách đặt mẫu riêng, mua hoa có sẵn và nhận hoa tại tủ bằng mã trên biên nhận.',
};
export default function Page() {
  return (
    <Layout
      title="Hướng dẫn đặt & nhận hoa — FloraBot"
      description="Cách đặt mẫu riêng, mua hoa có sẵn và nhận hoa tại tủ bằng mã trên biên nhận."
    >
      <main id="main" className="content-page" tabIndex={-1}>
        <h1>Từ một ý tưởng nhỏ đến bó hoa trên tay.</h1>
        <p>
          Chọn cách đặt phù hợp với bạn. Giá, tủ nhận và lịch hẹn luôn cần được kiểm tra trước khi
          xác nhận.
        </p>
        <section>
          <h2>Đặt mẫu riêng để shop chuẩn bị</h2>
          <ol className="reading-steps">
            <li>
              <h3>Chọn mẫu và tủ nhận</h3>
              <p>
                Đăng nhập, mở sản phẩm hoa và chọn mẫu bạn thích. Ghi dịp tặng, màu sắc, ngân sách
                và thời gian mong muốn.
              </p>
            </li>
            <li>
              <h3>Xem báo giá từ shop</h3>
              <p>
                Mở “Đơn đặt trước” trong tài khoản để xem giá trọn gói, ghi chú và lịch nhận. Giá
                trên danh mục là giá mẫu tham khảo.
              </p>
            </li>
            <li>
              <h3>Xác nhận và thanh toán</h3>
              <p>
                Chỉ xác nhận khi thông tin phù hợp. Hoàn tất thanh toán trước thời hạn ghi trên đơn
                để shop bắt đầu chuẩn bị.
              </p>
            </li>
            <li>
              <h3>Đến tủ khi hoa sẵn sàng</h3>
              <p>
                Kiểm tra trạng thái trong tài khoản. Đến đúng tủ trong khung giờ hẹn, mở biên nhận
                và dùng mã nhận hoa tại tủ.
              </p>
            </li>
          </ol>
        </section>
        <section>
          <h2>Mua bó hoa có sẵn</h2>
          <p>
            Trong mẫu hoa, chọn “Mua hoa có sẵn tại tủ”. Hệ thống giữ bó hoa trong thời gian thanh
            toán. Sau khi thanh toán được xác nhận, bạn đến tủ trước hạn nhận ghi trên đơn.
          </p>
          <p>
            Thanh toán online không mở cửa tủ ngay. Bạn cần đến đúng tủ và dùng mã trên biên nhận để
            nhận hoa.
          </p>
        </section>
        <section>
          <h2>Nếu kế hoạch thay đổi</h2>
          <p>
            Yêu cầu chưa thanh toán có thể hủy trong tài khoản. Với đơn đã thanh toán, cần shop hoặc
            đội ngũ vận hành đối chiếu trước khi xử lý. Khoản hoàn được theo dõi trên biên nhận;
            không mặc định hoàn tiền ngay khi gửi yêu cầu.
          </p>
          <p>
            Đừng thanh toán lại khi chưa rõ giao dịch trước đã thành công hay chưa. Hãy cập nhật
            trạng thái đơn trước.
          </p>
          <a className="text-link" href="/lien-he">
            Tìm đúng nơi hỗ trợ
          </a>
        </section>
        <div className="content-actions">
          <a className="button button-primary" href={`${portal}/dat-hoa`}>
            Chọn hoa của bạn
          </a>
          <a className="text-link" href={`${portal}/tai-khoan`}>
            Theo dõi đơn hàng
          </a>
        </div>
      </main>
    </Layout>
  );
}
