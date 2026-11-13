export const workspaceSections = {
  ADMIN: [
    ['approvals', 'Trung tâm duyệt', 'Xem hồ sơ chờ xử lý và tiến độ vận hành.'],
    [
      'accounts',
      'Tài khoản hệ thống',
      'Tra cứu tài khoản theo vai trò và xem hồ sơ toàn hệ thống.',
    ],
    ['managers', 'Quản lý vận hành', 'Tạo tài khoản và quản lý trạng thái Quản lý vận hành.'],
    [
      'orders',
      'Giám sát đơn đặt trước',
      'Theo dõi tiến độ, phản ánh và hoàn tiền của các shop. Shop phụ trách báo giá và chuẩn bị hoa.',
    ],
    ['incidents', 'Sự cố tủ', 'Kiểm tra lỗi thiết bị, cửa tủ và tiền bị kẹt.'],
    [
      'tasks',
      'Giám sát công việc',
      'Theo dõi trạng thái sự cố và giao hoa trên toàn hệ thống ở chế độ chỉ đọc.',
    ],
    ['installations', 'Hồ sơ thuê kiosk', 'Tra cứu hồ sơ thuê theo từng giai đoạn lắp đặt.'],
    ['shops', 'Shop hoa', 'Tra cứu shop và duyệt gói cho hồ sơ shop có sẵn trong hệ thống.'],
    [
      'slots',
      'Phân bổ kiosk',
      'Theo dõi từng kiosk, gán shop và phân công người phụ trách vận hành.',
    ],
    ['complaints', 'Phản ánh', 'Xem bằng chứng và xử lý phản ánh của khách.'],
    ['refunds', 'Hoàn tiền', 'Duyệt khoản hoàn và đối chiếu chứng từ chuyển khoản của shop.'],
    [
      'kiosk-refunds',
      'Hoàn tiền thuê kiosk',
      'Kiểm tra và xử lý hoàn tiền đơn đăng ký thuê kiosk hàng năm.',
    ],
    ['reconciliation', 'Đối soát', 'Kiểm tra giao dịch và kết quả đối soát.'],
    [
      'payment-channels',
      'Kênh thanh toán shop',
      'Gắn cấu hình PayOS và xác thực kênh nhận tiền cho từng shop.',
    ],
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
      'commerce',
      'Thanh toán & doanh số',
      'Theo dõi kênh nhận tiền, giao dịch và tích điểm của shop.',
    ],
    [
      'refunds',
      'Hoàn tiền trực tiếp',
      'Chuyển khoản hoàn tiền đã duyệt và gửi chứng từ đối chiếu.',
    ],
    ['seasonal', 'Doanh số theo mùa', 'Xem dữ liệu bán thực tế và dự báo có điều kiện.'],
    ['terminations', 'Chấm dứt thuê kiosk', 'Gửi yêu cầu chấm dứt và theo dõi tiến độ bàn giao.'],
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
      'maintenance-recovery',
      'Phiên bảo trì hết hạn',
      'Khôi phục các ô đang khóa sau khi kiểm tra tại tủ.',
    ],
    [
      'installations',
      'Hồ sơ thuê & Lắp đặt',
      'Tiếp nhận hồ sơ thuê kiosk, xác nhận liên hệ, phân công kỹ thuật và nghiệm thu bàn giao.',
    ],
    ['technicians', 'Kỹ thuật viên', 'Tạo tài khoản và quản lý trạng thái Kỹ thuật viên.'],
    ['terminations', 'Chấm dứt thuê kiosk', 'Xét duyệt yêu cầu và ghi nhận bàn giao kiosk.'],
  ],
} as const;
export type WorkspaceRole = keyof typeof workspaceSections;
export { workspaceBase } from './roleRoutes';
