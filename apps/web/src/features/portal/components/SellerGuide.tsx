import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { ChevronDown, HelpCircle } from '@florabot/ui';

type Guide = { title: string; steps: string[]; href: string; action: string };
const guides: Record<string, Guide> = {
  overview: {
    title: 'Hướng dẫn nhanh',
    steps: [
      'Tạo mẫu hoa và bật bán khi đủ ảnh, giá.',
      'Đơn đặt trước: báo giá → khách thanh toán → nạp hoa vào ô.',
      'Hoa tại tủ: chọn đúng tủ và ô trống để nạp. Tạo mẫu chưa có nghĩa là đã có bó hoa trong tủ.',
    ],
    href: '/seller/products',
    action: 'Tạo mẫu hoa',
  },
  orders: {
    title: 'Hướng dẫn đơn đặt trước',
    steps: [
      'Chọn “Cần xử lý” để phản hồi yêu cầu mới.',
      'Chờ xác nhận thanh toán trước khi chuẩn bị hoa.',
      'Ghi nhận nạp hoa trực tiếp từ chi tiết đơn.',
    ],
    href: '/seller/tasks',
    action: 'Giao việc nhân viên',
  },
  products: {
    title: 'Hướng dẫn mẫu hoa',
    steps: [
      'Mẫu mới ở trạng thái bản nháp cho đến khi thêm ảnh và bật bán.',
      'Chuyển sang tab Phụ kiện đi kèm để quản lý thiệp, túi quà.',
    ],
    href: '/seller/stock',
    action: 'Quản lý hoa tại tủ',
  },
  accessories: {
    title: 'Hướng dẫn phụ kiện',
    steps: [
      'Phụ kiện áp dụng cho đơn đặt trước tại từng tủ.',
      'Chỉ xác nhận bổ sung sau khi đã đặt phụ kiện vào tủ.',
    ],
    href: '/seller/products',
    action: 'Xem mẫu hoa',
  },
  stock: {
    title: 'Hướng dẫn nạp hoa',
    steps: [
      'Chọn tủ và ô trống trước khi ghi nhận nạp bó hoa.',
      'Đơn đặt trước đã thanh toán cần nạp từ chi tiết đơn.',
    ],
    href: '/seller/orders?filter=preparing',
    action: 'Đơn đang chuẩn bị',
  },
  kiosks: {
    title: 'Hướng dẫn vị trí tủ',
    steps: [
      'Cập nhật địa chỉ và ghim bản đồ để khách tìm điểm nhận hoa.',
      'Liên hệ Quản lý vận hành khi cần di dời tủ vật lý.',
    ],
    href: '/seller/stock',
    action: 'Xem hoa tại tủ',
  },
  tasks: {
    title: 'Hướng dẫn giao việc',
    steps: [
      'Chọn nhân viên và tủ Kiosk cần giao hoa.',
      'Xem ảnh nghiệm thu trong chi tiết công việc.',
    ],
    href: '/seller/staff',
    action: 'Danh sách nhân viên',
  },
  staff: {
    title: 'Hướng dẫn nhân sự',
    steps: [
      'Mỗi nhân viên dùng tài khoản riêng để nhận việc và gửi báo cáo.',
      'Khóa tài khoản khi nhân viên nghỉ việc hoặc không còn được phép truy cập shop.',
    ],
    href: '/seller/tasks',
    action: 'Giao việc nhân viên',
  },
  'staff-chats': {
    title: 'Trao đổi nội bộ',
    steps: [
      'Chọn nhân viên để nhắn tin và gửi ảnh hiện trường.',
      'Dùng mục Giao việc để phân công nhiệm vụ chính thức.',
    ],
    href: '/seller/tasks',
    action: 'Giao việc nhân viên',
  },
  chats: {
    title: 'Trao đổi khách hàng',
    steps: [
      'Thống nhất mẫu hoa trong chat, sau đó gửi báo giá ở Đơn đặt trước.',
      'Chuyển sang tab Nội bộ nhân viên để nhắn với đội ngũ.',
    ],
    href: '/seller/orders',
    action: 'Mở đơn đặt trước',
  },
  commerce: {
    title: 'Hướng dẫn thanh toán',
    steps: [
      'Tiền bán hoa qua PayOS chuyển trực tiếp về tài khoản shop.',
      'Chuyển tab Hoàn tiền hoặc Dự báo mùa để xem chi tiết.',
    ],
    href: '/seller/refunds',
    action: 'Xem khoản hoàn',
  },
  refunds: {
    title: 'Hướng dẫn hoàn tiền',
    steps: ['Mở thông tin tài khoản khách, chuyển khoản và tải ảnh chứng từ.'],
    href: '/seller/commerce',
    action: 'Về doanh số',
  },
  seasonal: {
    title: 'Dự báo mùa vụ',
    steps: ['Chọn khoảng ngày lịch sử để xem số lượng bán và ước tính tháng tới.'],
    href: '/seller/commerce',
    action: 'Về doanh số',
  },
  subscriptions: {
    title: 'Hướng dẫn thuê tủ',
    steps: ['Phí thuê tính theo số ô Walk-in và Pre-order trong kỳ 12 tháng.'],
    href: '/seller/kiosks',
    action: 'Xem tủ của shop',
  },
  terminations: {
    title: 'Chấm dứt thuê tủ',
    steps: ['Gửi yêu cầu và lý do; shop vẫn quản lý tủ cho đến khi bàn giao xong.'],
    href: '/seller/subscriptions',
    action: 'Xem gói thuê',
  },
};
export default function SellerGuide({ section }: { section: string }) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const element = disclosure.current;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && element?.open) {
        event.preventDefault();
        event.stopPropagation();
        element.open = false;
        element.querySelector('summary')?.focus();
      }
    };
    const closeOutside = (event: PointerEvent) => {
      if (disclosure.current && !disclosure.current.contains(event.target as Node)) {
        disclosure.current.open = false;
      }
    };
    const closeOnBlur = (event: FocusEvent) => {
      if (element && !element.contains(event.relatedTarget as Node | null)) {
        element.open = false;
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    element?.addEventListener('keydown', closeOnEscape);
    element?.addEventListener('focusout', closeOnBlur);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      element?.removeEventListener('keydown', closeOnEscape);
      element?.removeEventListener('focusout', closeOnBlur);
    };
  }, []);
  const guide = guides[section];
  if (!guide) return null;
  return (
    <details className="seller-guide" ref={disclosure}>
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
