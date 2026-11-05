export const workspaceSections = {
  ADMIN: [
    [
      'approvals',
      'Trung tâm duyệt',
      'Kiểm tra phản ánh, hoàn tiền và yêu cầu rút tiền. Các hồ sơ vận hành được theo dõi riêng.',
    ],
    [
      'accounts',
      'Tài khoản hệ thống',
      'Tra cứu tài khoản theo vai trò và xem hồ sơ toàn hệ thống.',
    ],
    ['managers', 'Quản lý vận hành', 'Tạo tài khoản và quản lý trạng thái Quản lý vận hành.'],
    [
      'orders',
      'Đơn đặt trước',
      'Giám sát đơn đặt hoa và tiến độ chuẩn bị. Shop phụ trách báo giá và xử lý đơn.',
    ],
    ['incidents', 'Sự cố tủ', 'Kiểm tra lỗi thiết bị, cửa tủ và tiền bị kẹt.'],
    [
      'tasks',
      'Giám sát công việc',
      'Theo dõi trạng thái sự cố và giao hoa trên toàn hệ thống ở chế độ chỉ đọc.',
    ],
    [
      'installations',
      'Hồ sơ thuê kiosk',
      'Theo dõi hồ sơ thuê và tiến độ lắp đặt. Quản lý vận hành xác nhận, phân công và bàn giao.',
    ],
    ['shops', 'Shop hoa', 'Tra cứu shop và duyệt gói cho hồ sơ shop có sẵn trong hệ thống.'],
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
    [
      'reports',
      'Báo cáo vận hành',
      'Theo dõi yêu cầu, giá trị đơn và doanh thu phí thuê từ hệ thống.',
    ],
  ],
  SELLER: [
    ['orders', 'Đơn đặt trước', 'Báo giá, chuẩn bị hoa và theo dõi lịch nhận.'],
    [
      'chats',
      'Tin nhắn khách hàng',
      'Trao đổi mong muốn của khách; ghi nhận báo giá và lịch nhận trong đơn đặt trước.',
    ],
    ['staff-chats', 'Tin nhắn nhân viên', 'Trao đổi công việc và gửi ảnh với nhân viên của shop.'],
    [
      'products',
      'Mẫu hoa',
      'Tạo mẫu giới thiệu cho khách: ảnh, giá và kích thước. Việc nạp bó hoa vào tủ được thực hiện riêng.',
    ],
    ['stock', 'Hoa tại tủ', 'Kiểm tra từng ô, nạp bó hoa bán tại tủ, thu hồi hoa và báo sự cố.'],
    ['accessories', 'Phụ kiện', 'Quản lý phụ kiện đi kèm chỉ áp dụng cho đơn đặt trước.'],
    ['tasks', 'Giao việc nhân viên', 'Phân công giao hoa và theo dõi tiến độ nhân viên shop.'],
    ['staff', 'Nhân viên shop', 'Tạo tài khoản và quản lý trạng thái nhân viên shop.'],
    [
      'kiosks',
      'Vị trí kiosk',
      'Cập nhật địa chỉ và tọa độ kiosk để khách hàng tìm thấy điểm nhận hoa.',
    ],
    ['subscriptions', 'Thuê kiosk', 'Xem phí thuê đã chốt và đăng ký thuê thêm kiosk.'],
    [
      'wallet',
      'Ví & rút tiền',
      'Theo dõi tiền bán hoa, tài khoản ngân hàng và tiến độ yêu cầu rút tiền.',
    ],
  ],
  OPERATIONS_MANAGER: [
    ['sellers', 'Quản lý shop hoa', 'Thông tin shop, tài khoản chủ shop và lịch sử trạng thái.'],
    [
      'customers',
      'Khách hàng',
      'Tạo tài khoản, cập nhật thông tin và quản lý trạng thái khách hàng.',
    ],
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
export { workspaceBase } from './roleRoutes';
