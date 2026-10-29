# Hồ sơ cá nhân — FE và API (29/10/2026)

Nhánh FE: `feat/profile-api-completion`, tách từ `main`. Thay đổi chỉ thuộc repo FE. Dùng các API BE đã có, không tạo hoặc sửa API BE.

## Phần FE đã hoàn thiện

- Thông tin cá nhân: họ tên, số điện thoại, địa chỉ, giới tính, ngày sinh; kiểm tra dữ liệu, lưu, hủy và gỡ các trường không bắt buộc.
- Khi gỡ giới tính/ngày sinh, gửi đúng `clearGender` và `clearDateOfBirth` theo BE. Không nhận ngày sinh tương lai; tính ngày hiện tại theo giờ Việt Nam.
- Email liên hệ: yêu cầu OTP, xác thực, gửi lại, đếm thời gian hết hạn theo BE, khôi phục email mặc định; hiển thị lỗi thay vì báo gửi thành công khi dịch vụ chưa sẵn sàng.
- Ngân hàng cá nhân: khai báo, xem lại trước khi lưu, đổi/xóa; hiển thị trạng thái cần cập nhật. Dùng GET hồ sơ hợp nhất khi cần xem đầy đủ số tài khoản; không lưu số đầy đủ trong query cache. Tự ẩn sau 60 giây, khi chuyển tab hoặc đổi phiên.
- Bảo mật: Customer/Seller dùng API đổi mật khẩu và liên kết Google có sẵn. Vai trò khác hiển thị hướng dẫn liên hệ quản trị viên, không gọi API sai quyền.
- Sửa đăng nhập từ trang hồ sơ: đăng nhập thành công quay về `/ho-so`, cả cổng thành viên và cổng vận hành. Chỉ chấp nhận đường dẫn hồ sơ cho `returnUrl`.
- Giao diện hoạt động trên mobile; giữ bản nháp khi tải lại dữ liệu nền và xóa bản nháp khi đổi tài khoản.
- Trau chuốt UI/UX: thu gọn phần định danh, bỏ vai trò lặp lại; chia form hai cột trên desktop, một cột trên điện thoại; rút ngắn nội dung email/ngân hàng.
- Danh mục bên trái trên desktop và nằm ngang trên mobile, giữ trong tầm nhìn khi cuộn và đánh dấu mục đang xem.
- Hiện/ẩn từng trường mật khẩu. Nhắc bản nháp khi bấm liên kết rời trang hoặc đăng xuất; trình duyệt nhắc khi tải lại/đóng tab. Chọn tiếp tục giữ nguyên nội dung, hủy thay đổi xóa nhắc. Thay đổi UI này không thêm API.

## Đối chiếu API

| API BE đã có                             | FE sử dụng                                    |
| ---------------------------------------- | --------------------------------------------- |
| GET `/api/account/profile`               | Đọc hồ sơ và xem ngân hàng theo yêu cầu       |
| PUT `/api/account/profile`               | Sửa thông tin, giới tính/ngày sinh, ngân hàng |
| POST `/api/account/contact-email`        | Gửi/gửi lại OTP                               |
| POST `/api/account/contact-email/verify` | Xác thực OTP                                  |
| POST `/api/account/contact-email/reset`  | Khôi phục email mặc định                      |
| POST `/api/member/password`              | Customer/Seller đổi mật khẩu                  |
| POST `/api/member/google/link`           | Customer/Seller liên kết Google               |
| GET `/api/auth/config`                   | Cấu hình khả dụng Google/email                |

Không cần BE viết lại các API trên. Endpoint POST `/api/account/profile/bank/reveal` còn trong Swagger nhưng FE dùng GET hồ sơ hợp nhất thay cho endpoint cũ.

## Đã kiểm tra

- Build, TypeScript, lint: đạt.
- 150/150 unit test: đạt; bao gồm xử lý dữ liệu hồ sơ, che số tài khoản và đường dẫn sau đăng nhập.
- 44 trường hợp browser test đã đạt, gồm hồ sơ 6 role, đăng nhập, OTP, Google giả lập, ngân hàng, lỗi API, bố cục hai cột, menu đang xem, hiện mật khẩu, nhắc bản nháp và accessibility tại 320/390/1440px. Các bài này giả lập HTTP để kiểm tra FE.
- 21 bước kiểm tra API thật qua FE `localhost:8088` → BE local `127.0.0.1:5080`: đạt. Gồm lưu/đọc lại/gỡ thông tin, ngân hàng giả, đổi mật khẩu, thu hồi phiên và đăng nhập lại.
- Thao tác trực tiếp trên trình duyệt với API local thật: lưu giới tính/ngày sinh, tải lại vẫn còn; gỡ rồi lưu lại thành công.
- Tài khoản test local đã được khôi phục về dữ liệu và mật khẩu gốc. Không thay đổi source BE, không đổi cấu hình DB hoặc tài khoản thật của team.

## Cần phối hợp với BE

1. **OTP email và Google:** API đã có. Local đang tắt cả hai provider; gửi OTP trả 503. BE đã deploy công khai báo hai provider đang bật, nhưng cần môi trường/tài khoản test và hộp thư thật để kiểm tra nhận OTP, xác thực và Google OAuth đến hết luồng. Chưa khẳng định hai dịch vụ ngoài này chạy thành công trên deploy.
2. **Đổi mật khẩu cho Admin / Operations Manager / Technician / Seller Staff:** BE hiện chưa cho các role này dùng `/api/member/password`. Nếu yêu cầu nghiệp vụ là tự đổi trong hồ sơ, cần BE bổ sung endpoint hoặc chính sách self-service đúng quyền, kèm thu hồi phiên và audit.
3. **Ảnh đại diện / đổi email đăng nhập:** chưa thấy API self-service tương ứng. FE hiện dùng chữ cái đại diện và email đăng nhập chỉ đọc. Chỉ cần bổ sung nếu team xác nhận hai chức năng này thuộc yêu cầu.

Không tự tạo API giả, bỏ kiểm tra quyền, đổi email đăng nhập hoặc cấu hình gửi email để làm bài kiểm tra vượt qua.
