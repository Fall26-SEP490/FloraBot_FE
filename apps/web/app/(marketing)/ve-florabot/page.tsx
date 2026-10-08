import Layout from '@/marketing/MarketingLayout';
const portal = '';

export const metadata = {
  title: 'Về chúng tôi — FloraBot',
  description:
    'FloraBot kết nối bạn với shop hoa và điểm nhận tại tủ: đặt theo yêu cầu hoặc chọn bó có sẵn.',
};
export default function Page() {
  return (
    <Layout
      title="Về chúng tôi — FloraBot"
      description="FloraBot kết nối bạn với shop hoa và điểm nhận tại tủ: đặt theo yêu cầu hoặc chọn bó có sẵn."
    >
      <main id="main" className="content-page" tabIndex={-1}>
        <div className="content-intro">
          <div>
            <h1>Hoa cho những điều bạn muốn nói.</h1>
            <p>
              Một lời cảm ơn, một ngày sinh nhật, hay đơn giản là chút dịu dàng dành cho mình.
              FloraBot giúp bạn chọn hoa và hẹn một điểm nhận thuận tiện.
            </p>
            <a className="button button-primary" href={`${portal}/dat-hoa`}>
              Khám phá sản phẩm hoa
            </a>
          </div>
          <img
            src="/images/floral-white-online.webp"
            width="900"
            height="1440"
            alt="Hoa hồng nhiều màu bên những nhành lá xanh"
          />
        </div>
        <section>
          <h2>FloraBot là gì?</h2>
          <p>
            FloraBot là website đặt hoa kết hợp tủ nhận hoa tự phục vụ. Bạn chọn mẫu từ các shop
            đang hoạt động, trao đổi mong muốn qua yêu cầu đặt hoa và theo dõi đơn trong tài khoản.
          </p>
          <p>
            Shop chịu trách nhiệm chuẩn bị và nạp hoa. FloraBot cung cấp nơi đặt hàng, theo dõi
            thanh toán, điểm nhận tại tủ và quy trình xử lý khi đơn gặp sự cố.
          </p>
        </section>
        <section>
          <h2>Hai cách chọn hoa, cùng một điểm hẹn.</h2>
          <h3>Một bó hoa dành riêng cho bạn</h3>
          <p>
            Chọn mẫu làm gợi ý, ghi màu sắc, dịp tặng và ngân sách. Shop xác nhận giá và lịch nhận
            trước khi bạn thanh toán.
          </p>
          <h3>Một bó hoa đã sẵn sàng</h3>
          <p>
            Xem những bó đang có tại tủ, chọn bó phù hợp và thanh toán trong thời hạn giữ hàng. Tài
            khoản của bạn hiển thị thời gian cần đến nhận.
          </p>
          <a className="text-link" href="/huong-dan-dat-hoa">
            Xem cách đặt và nhận hoa
          </a>
        </section>
        <section>
          <h2>Bạn là chủ shop hoa?</h2>
          <p>
            FloraBot có gói thuê ô tủ theo tháng, cùng công cụ quản lý mẫu hoa, hàng trong tủ và đơn
            đặt trước từ website.
          </p>
          <a className="text-link" href="/#goi-thue">
            Tìm hiểu gói thuê dành cho shop
          </a>
        </section>
      </main>
    </Layout>
  );
}
