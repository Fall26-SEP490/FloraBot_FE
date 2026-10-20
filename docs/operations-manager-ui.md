# Operations Manager — FE UI/UX và API

Nhánh: `feat/operations-manager-ui`, tách từ `main` tại `35ad4c9`.

## Giao diện

- `/operations`: tổng quan, báo cáo kỹ thuật chờ duyệt, kỹ thuật viên hoạt động, kiosk có thể phân bổ và 5 hồ sơ mới nhất. Chỉ số công việc là số trên trang đầu; dấu `+` cho biết còn trang sau, không suy diễn tổng hệ thống.
- `/operations/installations`: lọc nhanh/lọc đầy đủ trạng thái, phân trang và mở chi tiết từ tổng quan. Mỗi trang chỉ có một H1; thông tin liên hệ có thể gọi điện/gửi email. Chi tiết có tiến độ, lịch hẹn, báo cáo và ảnh minh chứng.
- `/operations/tasks`: trang riêng cho phân công, đổi người phụ trách, xem/duyệt báo cáo sự cố. Giữ phạm vi kỹ thuật, không thêm quyền giao hoa hay tài chính.
- `/operations/technicians`: giữ luồng tạo tài khoản, xem và đổi trạng thái kỹ thuật viên qua API hiện có.

## API BE đã có và đang dùng

Tất cả đường dẫn bên dưới có tiền tố `/api`. Không tạo/sửa API BE trong đợt này.

| Method   | Đường dẫn                                                                          | FE sử dụng                                      |
| -------- | ---------------------------------------------------------------------------------- | ----------------------------------------------- |
| GET      | `/operations/kiosk-applications?status=&page=&limit=`                              | Tổng quan, danh sách và lọc hồ sơ               |
| GET      | `/operations/kiosk-applications/{id}`                                              | Thông tin, lịch và báo cáo lắp đặt              |
| POST     | `/operations/kiosk-applications/{id}/confirm`                                      | Xác nhận liên hệ, ghi chú tối thiểu 5 ký tự     |
| POST     | `/operations/kiosk-applications/{id}/schedule`                                     | Xếp/đổi lịch, chọn kỹ thuật viên và kiosk       |
| POST     | `/operations/kiosk-applications/{id}/handover`                                     | Bàn giao sau khi có báo cáo và ảnh minh chứng   |
| POST     | `/operations/kiosk-applications/{id}/rework`                                       | Yêu cầu làm lại                                 |
| POST     | `/operations/kiosk-applications/{id}/reject`                                       | Từ chối hồ sơ chưa thanh toán hoặc chờ xác nhận |
| POST     | `/operations/kiosk-applications/{id}/platform-failure`                             | Ghi nhận không thể tiếp tục lắp đặt             |
| GET      | `/operations/kiosk-applications/{id}/evidence/{attachmentId}`                      | Đọc ảnh minh chứng qua API xác thực             |
| GET      | `/operations/eligible-kiosks?packageId=`                                           | Chọn kiosk phù hợp và thẻ tổng quan             |
| POST     | `/operations/kiosks/enroll`                                                        | Đăng ký thiết bị, nhận khóa một lần             |
| POST     | `/operations/kiosks/{id}/provision-key`                                            | Cấp lại khóa thiết bị                           |
| GET/POST | `/operations/technicians`                                                          | Danh sách và tạo tài khoản kỹ thuật viên        |
| PATCH    | `/operations/technicians/{id}/status`                                              | Đổi trạng thái tài khoản                        |
| GET      | `/operations/staff`, `/operations/incidents`                                       | Đội ngũ và sự cố trong phạm vi được giao        |
| GET/POST | `/operations/staff-tasks`                                                          | Danh sách và phân công công việc                |
| GET      | `/operations/staff-tasks/{id}`                                                     | Chi tiết/lịch sử công việc                      |
| POST     | `/operations/staff-tasks/{id}/transition`, `/operations/staff-tasks/{id}/reassign` | Duyệt/chuyển trạng thái và đổi người phụ trách  |

## Sửa lỗi và giới hạn

- Khi đổi lịch, giữ kỹ thuật viên, ngày, khung giờ và kiosk hiện tại. BE loại kiosk đã giữ chỗ khỏi danh sách kiosk trống; FE bổ sung lựa chọn kiosk đang gán cho chính hồ sơ, BE vẫn quyết định hợp lệ cuối cùng.
- Phân biệt đang tải, không có dữ liệu và lỗi; có thử lại khi đọc chi tiết/đội ngũ/kiosk thất bại. Lỗi không được hiển thị như số 0 trên tổng quan.
- Ghi chú/lý do tối thiểu 5 ký tự; khung giờ đúng `HH:mm - HH:mm`, kết thúc sau bắt đầu; số ô nguyên dương, tổng không quá 50 theo BE.
- Chặn các thao tác đồng thời trong chi tiết; chưa đủ báo cáo/ảnh thì nút bàn giao bị vô hiệu hóa. BE vẫn kiểm tra trạng thái và minh chứng thật.
- Modal đăng ký/cấp khóa dùng focus trap, Escape, trả focus. Thông báo sao chép chỉ thành công sau khi Clipboard API thành công. Khóa giữ trong bộ nhớ, không ghi localStorage hay tài liệu.
- Admin chỉ giám sát hồ sơ; không gọi API đội ngũ/kiosk hay mở form tác nghiệp của Manager. Sự cố theo cụm được phân quyền; danh sách hồ sơ/technician theo phạm vi nền tảng của BE.
- Không tạo số liệu, tài khoản hay hồ sơ mẫu trong DB; không mô phỏng cảm biến/mở cửa thật. Cloudinary và phần cứng thật chưa được nghiệm thu trong đợt này.

## Kiểm tra

Kết quả local ngày 20/10/2026: **55/55 unit tests**, **24/24 browser tests tập trung Operations Manager**, TypeScript, ESLint và production build đều đạt. Browser tests tập trung vào tổng quan, lỗi/thử lại, đổi lịch giữ kiosk, payload API, thiếu minh chứng, quyền Admin/Manager, đăng ký/cấp khóa, phân công/đổi người phụ trách, responsive và accessibility. Kiểm tra giao diện tổng quan/hồ sơ ở 390/1440 px và điều phối công việc ở 320/390/1440 px.

Kiểm tra mở rộng: kết quả cuối **107/107 browser tests** gồm 26 đăng ký/xác thực, 62 dashboard/vận hành và 19 chat. Lần đầu 104/107 đạt; ba fixture Seller Products dùng endpoint cũ được cập nhật sang `/api/me/products` cùng mock kiosk/ảnh, sau đó chạy lại đúng ba bài và đạt 3/3. Đây là tổng hợp hai lần chạy, không phải một lần chạy 107 bài đều xanh ngay từ đầu.

Browser tests dùng HTTP fixtures để kiểm tra hành vi FE, không thay thế nghiệm thu thao tác thật trên BE/Cloudinary/thiết bị. Không reset hay seed DB đang chạy.
