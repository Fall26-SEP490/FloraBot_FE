# Hướng dẫn kiểm thử quản lý tài khoản

## Phân quyền

- Admin tạo, xem và đổi trạng thái Operations Manager.
- Operations Manager tạo, xem và đổi trạng thái Technician.
- Seller tạo, xem và đổi trạng thái Seller Staff của chính shop mình.
- Không có chức năng tạo Seller trực tiếp trong màn hình này. Customer mua gói thành công mới trở thành Seller là luồng riêng đang chờ hoàn thiện.

## Các trang

- `/admin/login` → `/admin/managers`: Admin quản lý Manager.
- `/admin/login` → `/operations/technicians`: Manager quản lý Technician.
- `/dang-nhap` → `/seller/staff`: Seller quản lý nhân viên shop.

## Kiểm thử theo từng cấp

1. Đăng nhập đúng vai trò, mở trang tương ứng và xác nhận danh sách tải từ API.
2. Nhấn Thêm, thử tên ngắn hơn 2 ký tự, email sai, mật khẩu ngắn hơn 6 ký tự hoặc số điện thoại sai. Form phải báo lỗi từng trường. Điện thoại được phép bỏ trống.
3. Dùng email chưa có để tạo. Tài khoản phải xuất hiện với đúng vai trò, không có lựa chọn tự cấp Admin hoặc Seller. Mật khẩu không được hiển thị trong bảng hay thông báo.
4. Dùng email đã có: phải báo trùng và giữ form để sửa, không báo thành công giả.
5. Khóa tài khoản mới và xác nhận: trạng thái Tạm khóa vẫn hiện trong danh sách. Người bị khóa không đăng nhập được. Mở khóa: đăng nhập lại được.
6. Vô hiệu hóa rồi khôi phục; tài khoản vẫn tìm được trong bộ lọc trạng thái.
7. Với Seller Staff, người bị khóa/vô hiệu không được xuất hiện trong danh sách giao việc. Đổi sellerId hoặc staffId sang shop khác phải bị API từ chối.
8. Technician, Seller Staff và Customer không truy cập được các màn hình quản lý nhân sự. Admin cũng không được tạo/đổi trạng thái Seller Staff qua API.
9. Thử tìm theo email, tên, điện thoại, lọc trạng thái, mở chi tiết và tải lại trang. Không có mật khẩu trong trang chi tiết.
10. Kiểm tra màn hình điện thoại, thao tác bằng Tab/Shift+Tab/Escape; khi đang cập nhật trạng thái, không được bấm gửi lặp hay đóng xác nhận giữa chừng.

## Giới hạn

Danh sách Technician hiện dùng phạm vi nền tảng, chưa có sở hữu kỹ thuật viên theo khu vực. Phần này không bổ sung lease kiosk, thanh toán gói hoặc phần cứng IoT. Kiểm thử giao diện giả lập không thay thế kiểm thử backend thật; xem kết quả nghiệm thu của lần triển khai.
