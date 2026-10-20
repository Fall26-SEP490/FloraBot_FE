export const workspaceSections = {
  ADMIN: [
    ['managers', 'Quản lý vận hành', 'Tạo tài khoản và quản lý trạng thái Quản lý vận hành.'],
    ['orders', 'Đơn đặt trước', 'Theo dõi yêu cầu đặt hoa và tiến độ chuẩn bị.'],
    ['incidents', 'Sự cố tủ', 'Kiểm tra lỗi thiết bị, cửa tủ và tiền bị kẹt.'],
    [
      'tasks',
      'Giám sát công việc',
      'Theo dõi trạng thái sự cố và giao hoa trên toàn hệ thống ở chế độ chỉ đọc.',
    ],
    ['shops', 'Shop hoa', 'Duyệt hồ sơ và theo dõi trạng thái hoạt động.'],
    ['slots', 'Phân bổ kiosk', 'Gán toàn bộ kiosk cho một shop và theo dõi trạng thái phân bổ.'],
    ['complaints', 'Phản ánh', 'Xem bằng chứng và xử lý phản ánh của khách.'],
    ['refunds', 'Hoàn tiền', 'Kiểm tra khoản hoàn và xác nhận chi trả.'],
    [
      'kiosk-refunds',
      'Hoàn tiền thuê kiosk',
      'Kiểm tra và xử lý hoàn tiền đơn đăng ký thuê kiosk hàng năm.',
    ],
    ['withdrawals', 'Rút tiền', 'Duyệt yêu cầu và ghi nhận khoản đã chi cho shop.'],
    ['reconciliation', 'Đối soát', 'Kiểm tra giao dịch và kết quả đối soát.'],
    ['reports', 'Báo cáo vận hành', 'Đọc hàng đợi, giá trị đơn và doanh thu phí thuê từ API.'],
  ],
  SELLER: [
    ['orders', 'Đơn đặt trước', 'Báo giá, chuẩn bị hoa và theo dõi lịch nhận.'],
    ['chats', 'Tin nhắn', 'Trao đổi và giải đáp thắc mắc với khách hàng.'],
    ['staff-chats', 'Tin nhắn nhân viên', 'Trao đổi công việc và gửi ảnh với nhân viên của shop.'],
    [
      'products',
      'Mẫu hoa',
      'Quản lý mẫu hoa giả, ảnh, giá bán và kích thước bó hoa bao gồm bao bì.',
    ],
    ['stock', 'Hoa tại tủ', 'Nạp hoa, kiểm tra tồn kho và báo sự cố.'],
    ['accessories', 'Phụ kiện', 'Quản lý phụ kiện đi kèm chỉ áp dụng cho đơn đặt trước.'],
    ['tasks', 'Giao việc nhân viên', 'Phân công giao hoa và theo dõi tiến độ nhân viên shop.'],
    ['staff', 'Nhân viên shop', 'Tạo tài khoản và quản lý trạng thái nhân viên shop.'],
    [
      'kiosks',
      'Vị trí kiosk',
      'Cập nhật địa chỉ và tọa độ kiosk để khách hàng tìm thấy điểm nhận hoa.',
    ],
    ['subscriptions', 'Gói thuê', 'Đăng ký, thanh toán và gia hạn ô tủ.'],
    ['wallet', 'Ví & tài khoản nhận tiền', 'Theo dõi số dư, khoản chi và yêu cầu rút tiền.'],
  ],
  OPERATIONS_MANAGER: [
    ['tasks', 'Công việc kỹ thuật', 'Phân công sự cố và kiểm tra báo cáo của kỹ thuật viên.'],
    [
      'installations',
      'Hồ sơ thuê & Lắp đặt',
      'Tiếp nhận hồ sơ thuê kiosk, xác nhận liên hệ, phân công kỹ thuật và nghiệm thu bàn giao.',
    ],
    ['technicians', 'Kỹ thuật viên', 'Tạo tài khoản và quản lý trạng thái Kỹ thuật viên.'],
  ],
} as const;
export type WorkspaceRole = keyof typeof workspaceSections;
export const workspaceBase = (role: string) => {
  switch (role) {
    case 'ADMIN':
      return '/admin';
    case 'OPERATIONS_MANAGER':
      return '/operations';
    case 'TECHNICIAN':
      return '/technician';
    case 'SELLER':
      return '/seller';
    case 'SELLER_STAFF':
      return '/staff';
    case 'CUSTOMER':
      return '/tai-khoan';
    case 'STAFF':
    default:
      return '/workspace';
  }
};
