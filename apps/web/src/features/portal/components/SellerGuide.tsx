import Link from 'next/link';
import { ChevronDown, HelpCircle } from '@florabot/ui';

type Guide = { title: string; steps: string[]; href: string; action: string };
const guides: Record<string, Guide> = {
  overview: {
    title: 'Mới dùng FloraBot? Xem cách vận hành shop',
    steps: [
      'Tạo mẫu hoa trong danh mục, thêm ảnh và bật bán khi thông tin đã đầy đủ.',
      'Đơn đặt trước: báo giá, chờ khách xác nhận và thanh toán, rồi chuẩn bị và nạp hoa từ chi tiết đơn.',
      'Hoa bán tại tủ: vào Hoa tại tủ, chọn đúng tủ và ô trước khi ghi nhận nạp. Tạo mẫu chưa có nghĩa là đã có bó hoa trong tủ.',
    ],
    href: '/seller/products',
    action: 'Bắt đầu với mẫu hoa',
  },
  orders: {
    title: 'Xử lý đơn đặt trước như thế nào?',
    steps: [
      'Chọn “Cần xử lý” để xem các đơn cần shop phản hồi trong trang đang xem.',
      'Mở chi tiết để kiểm tra yêu cầu, báo giá và lịch nhận. Chờ hệ thống xác nhận thanh toán trước khi chuẩn bị.',
      'Khi hoa đã đặt đúng ô, ghi nhận nạp từ chính đơn này. Có thể giao việc cho nhân viên ở mục Giao việc nhân viên.',
    ],
    href: '/seller/tasks',
    action: 'Giao việc cho nhân viên',
  },
  products: {
    title: 'Mẫu hoa khác bó hoa trong tủ thế nào?',
    steps: [
      'Mẫu hoa lưu tên, ảnh, giá và kích thước để khách tham khảo và đặt trước.',
      'Mẫu mới là bản nháp. Mở chi tiết để thêm ảnh, kiểm tra thông tin rồi bật bán.',
      'Bó hoa thực tế được ghi nhận riêng khi nạp. Với đơn đã thanh toán, nạp từ chi tiết đơn; với hoa bán trực tiếp, dùng Hoa tại tủ.',
    ],
    href: '/seller/stock',
    action: 'Quản lý hoa tại tủ',
  },
  stock: {
    title: 'Chọn đúng cách nạp hoa',
    steps: [
      'Chọn tủ cần quản lý, sau đó kiểm tra khu vực, trạng thái ô và mẫu hoa.',
      'Bó gắn với đơn đặt trước đã thanh toán cần được nạp từ chi tiết đơn để liên kết đúng đơn.',
      'Chỉ xác nhận sau khi đã đặt hoa vào đúng ô. Mở chi tiết ô để xem thông tin bó, thu hồi hoặc báo sự cố khi được phép.',
    ],
    href: '/seller/orders?filter=preparing',
    action: 'Xem đơn đang chuẩn bị',
  },
  kiosks: {
    title: 'Thông tin vị trí này dùng để làm gì?',
    steps: [
      'Địa chỉ và ghim bản đồ giúp khách tìm đúng điểm nhận hoa.',
      'Chọn đúng tủ, kiểm tra địa chỉ và tọa độ rồi lưu. Thay thông tin trên web không tự di chuyển thiết bị.',
      'Khi cần chuyển vị trí lắp đặt thực tế, trao đổi với Quản lý vận hành trước.',
    ],
    href: '/seller/stock',
    action: 'Xem hoa trong tủ',
  },
  tasks: {
    title: 'Giao việc cho nhân viên theo thứ tự nào?',
    steps: [
      'Chọn công việc giao hoa và nhân viên được phân công cho đúng tủ.',
      'Theo dõi tiến độ và ảnh báo cáo trong chi tiết công việc.',
      'Tạo tài khoản nhân viên tại Nhân viên shop; trao đổi trong Tin nhắn nhân viên.',
    ],
    href: '/seller/staff',
    action: 'Quản lý nhân viên shop',
  },
  staff: {
    title: 'Tài khoản nhân viên dùng để làm gì?',
    steps: [
      'Mỗi nhân viên dùng tài khoản riêng để nhận việc và báo cáo tiến độ.',
      'Tạo tài khoản tại đây, sau đó phân công giao hoa ở mục Giao việc nhân viên.',
      'Khóa hoặc vô hiệu hóa tài khoản sẽ ảnh hưởng quyền làm việc của nhân viên. Kiểm tra người nhận trước khi xác nhận.',
    ],
    href: '/seller/tasks',
    action: 'Mở giao việc nhân viên',
  },
  'staff-chats': {
    title: 'Trao đổi với nhân viên của shop',
    steps: [
      'Chọn nhân viên để mở cuộc trò chuyện và xem lịch sử tin nhắn.',
      'Gửi nội dung hoặc ảnh để phối hợp công việc. Tin nhắn không thay thế thao tác phân công hay xác nhận hoàn thành.',
    ],
    href: '/seller/tasks',
    action: 'Theo dõi công việc',
  },
  chats: {
    title: 'Trao đổi với khách và xử lý đơn',
    steps: [
      'Chọn cuộc trò chuyện để xem khách đang quan tâm mẫu hoa nào.',
      'Thống nhất mong muốn trong chat; báo giá và lịch nhận cần được ghi nhận ở chi tiết đơn đặt trước.',
    ],
    href: '/seller/orders',
    action: 'Mở đơn đặt trước',
  },
  accessories: {
    title: 'Bổ sung phụ kiện vào đúng tủ',
    steps: [
      'Phụ kiện áp dụng cho đơn đặt trước. Chọn xem tồn để tải số lượng hiện có tại từng tủ.',
      'Nhập lượng vừa bổ sung, kiểm tra lại rồi xác nhận. Chỉ ghi nhận sau khi đã đặt phụ kiện vào tủ.',
    ],
    href: '/seller/orders',
    action: 'Xem đơn đặt trước',
  },
  wallet: {
    title: 'Phân biệt số dư và yêu cầu rút tiền',
    steps: [
      'Có thể rút là phần tiền đủ điều kiện; tiền đang chờ chưa thể rút.',
      'Kiểm tra tài khoản nhận tiền của shop, nhập số tiền và xem lại trước khi gửi yêu cầu.',
      'Gửi yêu cầu chưa có nghĩa là đã nhận tiền. Theo dõi trạng thái xử lý và lịch sử ngay bên dưới.',
    ],
    href: '/seller/orders',
    action: 'Đối chiếu với đơn đặt trước',
  },
  subscriptions: {
    title: 'Xem gói và thanh toán kỳ thuê',
    steps: [
      'Kiểm tra gói đang được cấp cho shop và các kỳ thuê hiện có.',
      'Nếu được phép đăng ký hoặc gia hạn, xem lại số kỳ và phí trước khi tạo liên kết thanh toán.',
      'Sau khi thanh toán, quay lại và cập nhật trạng thái. Gói chỉ kích hoạt khi hệ thống xác nhận đã nhận tiền.',
    ],
    href: '/seller/kiosks',
    action: 'Xem tủ của shop',
  },
};
export default function SellerGuide({ section }: { section: string }) {
  const guide = guides[section];
  if (!guide) return null;
  return (
    <details className="seller-guide">
      <summary>
        <HelpCircle size={18} aria-hidden="true" />
        <span>{guide.title}</span>
        <ChevronDown size={17} aria-hidden="true" />
      </summary>
      <div className="seller-guide-content">
        <ol>
          {guide.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <Link href={guide.href}>{guide.action}</Link>
      </div>
    </details>
  );
}
