# Chat nội bộ Seller ↔ Seller Staff trên FE

BE tại `58b9f46` đã có đầy đủ API và migration `025_seller_staff_chat.sql`. Đợt này bổ sung FE sử dụng các API đó; không sửa BE, không seed/reset DB.

## Giao diện

- Chủ shop: `/seller/staff-chats` → chọn nhân viên đang hoạt động → Nhắn với nhân viên. Trong `/seller/staff`, liên kết Nhắn tin mở màn chat và chọn sẵn đúng nhân viên.
- Nhân viên shop: `/staff/chats` → Nhắn với chủ shop. Không nhận seller/staff ID từ form để lựa chọn shop khác.
- Danh sách hội thoại có tin gần nhất, chưa đọc, phân trang. Mở lịch sử, tải tin cũ, gửi văn bản/ảnh, xem ảnh riêng tư và trạng thái đã xem.
- Giao diện desktop hai cột; điện thoại chuyển giữa danh sách và hội thoại. Phân trang danh sách không làm mất hội thoại đang chọn hay bản nháp.
- Không tự mở/tạo hội thoại bằng POST khi chỉ truy cập trang. Đánh dấu đã đọc sau khi tải lịch sử thành công và hội thoại thực sự được hiển thị; không đánh dấu khi danh sách mobile đang che hội thoại.
- Chỉ cho mở chat với nhân viên hoạt động. Với lịch sử của đối phương bị khóa, có thể đọc nhưng phần soạn/gửi bị khóa.

## API BE sẵn có

| Method  | API                                                           | Sử dụng                                                             |
| ------- | ------------------------------------------------------------- | ------------------------------------------------------------------- |
| POST    | `/api/sellers/{sellerId}/staff/{staffId}/chat/open`           | Chủ shop mở/tiếp tục chat với nhân viên                             |
| POST    | `/api/staff/chats/open`                                       | Nhân viên mở/tiếp tục chat với shop, không có body                  |
| GET     | `/api/seller-staff/chats?page=`                               | Danh sách theo tài khoản/shop hiện tại                              |
| GET     | `/api/seller-staff/chats/{chatId}/messages?page=`             | Lịch sử, trang 1 chứa tin mới nhất                                  |
| POST    | `/api/seller-staff/chats/{chatId}/messages`                   | Gửi `content` và/hoặc `imageReference`                              |
| POST    | `/api/seller-staff/chats/{chatId}/read`                       | Đánh dấu tin đến đã đọc                                             |
| POST    | `/api/seller-staff/chats/{chatId}/images`                     | Upload raw PNG/JPEG/WebP tối đa 5 MiB                               |
| GET     | `/api/seller-staff/chats/{chatId}/messages/{messageId}/image` | Hiển thị ảnh qua API có xác thực                                    |
| GET     | `/api/sellers/{sellerId}/staff/accounts`                      | Danh sách nhân viên để chọn, lọc ACTIVE                             |
| SignalR | `/hub/chat`                                                   | `ChatMessageReceived`, `ChatMessagesRead`; đọc REST khi kết nối lại |

Các kiểu response được dùng từ OpenAPI đã sinh sẵn trong `packages/contracts`. Đã đối chiếu lại với OpenAPI của BE local, không viết tay các generated types.

## Quy tắc

- Văn bản tối đa 2.000 ký tự, phải có nội dung hoặc ảnh. Chat nội bộ cho phép điện thoại, email, liên kết; validation chat khách hàng vẫn giữ quy tắc cũ.
- HTTP giữ cookie phiên. Upload đi qua BE, không đưa Cloudinary key/secret vào FE và không dùng link ảnh CDN công khai cho chat riêng.
- Query cache lịch sử/danh sách được tách theo kênh, tài khoản, vai trò và shop. BE vẫn kiểm tra quyền/tenant ở từng request; không cấp quyền chat cho Admin, Operations Manager, Technician hoặc Customer.
- Ảnh upload lỗi giữ lại nội dung/ảnh đã chọn để người dùng thử lại; không gửi tin nếu chưa nhận reference hợp lệ. Lỗi đọc lịch sử/tải trang cũ có thể thử lại.
- Realtime chống trùng message ID, cập nhật read receipt, đồng bộ REST khi kết nối lại; polling 30 giây là dự phòng. Không tự gửi lại POST tin nhắn khi mất kết nối.

## Giới hạn kiểm tra

Ngày 20/10/2026: **55/55 unit tests**, **19/19 browser tests được chọn** (13 cho chat nội bộ, 6 hồi quy chat khách hàng), ESLint, TypeScript và production build đều đạt. Kiểm tra responsive/accessibility chat nội bộ ở 390 và 1440 px; API qua proxy trả 401 khi chưa đăng nhập. Đã sửa lỗi ảnh lazy loading bị `display: none`, kiểm tra tải ảnh/phóng to và đóng bằng Escape.

Browser tests mô phỏng HTTP và giao thức SignalR để kiểm tra FE. Unit tests kiểm tra validation, URL/payload và tách hai kênh chat. Không dùng các kết quả này để khẳng định đã nghiệm thu Cloudinary thật hoặc chat giữa tài khoản production. Upload ảnh thật vẫn cần BE được cấu hình Cloudinary.

Chi tiết giao diện và API Operations Manager được ghi tại [operations-manager-ui.md](operations-manager-ui.md).
