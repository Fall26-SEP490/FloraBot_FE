# Kiểm chứng preorder với PayOS và kiosk thật

Các bài Playwright dùng API giả lập không chứng nhận thanh toán hay cửa tủ thật. Chỉ chạy các bước thanh toán sau trên môi trường kiểm thử được phép, với kiosk và tài khoản riêng.

Callback dùng `orderCode` theo [tài liệu return URL của PayOS](https://payos.vn/docs/du-lieu-tra-ve/return-url/) để tìm lại yêu cầu trong tab đang thanh toán. Trạng thái tiền luôn đọc lại từ BE. Cấu hình return/cancel URL cần trỏ về `/tai-khoan` trên cùng origin với website.

1. Customer tạo yêu cầu CUSTOM tại kiosk có ô PREORDER trống; seller báo giá và giờ nhận.
2. Customer chấp nhận báo giá: trạng thái AWAITING_PAYMENT, chưa hiển thị QR nhận hoa.
3. Mở PayOS trong cùng tab. Thanh toán thành công; webhook hợp lệ cập nhật PAID. Trang trở về tự mở đúng đơn, hiển thị chờ shop chuẩn bị. Callback URL tự khai status=PAID không được làm đơn thành đã trả tiền.
4. Seller hoặc staff được phân công đặt hoa vào đúng ô PREORDER và xác nhận fulfill. Đơn hiển thị sẵn sàng, QR, hai mã, kiosk và khung giờ nhận. Website không gửi lệnh mở cửa.
5. Tại đúng kiosk, chọn Nhận hoa đã đặt. Quét QR bằng máy quét dạng bàn phím hoặc nhập ID và mã 8 ký tự. Kiểm tra rồi xác nhận: chỉ gửi một request_pickup.
6. Đối chiếu lệnh MQTT và phản hồi SENT → ACK → OPENED → CLOSED. Chỉ sau phản hồi cửa đóng hợp lệ, đơn mới COMPLETED và ô được giải phóng.
7. Kiểm tra sai mã, sai kiosk, trước giờ nhận, quá hạn, kiosk offline, mất mạng sau khi gửi lệnh và cửa không mở. Không tự gửi lại lệnh hoặc báo đã nhận khi chưa có xác nhận thiết bị.
8. Kiểm tra hủy PayOS, webhook đến chậm/trùng và tiền về sau hạn. Trạng thái phải theo BE; trường hợp hoàn tiền phải có nghĩa vụ hoàn và thông tin hỗ trợ, không hiển thị mã đi nhận.

Ghi lại requestId, orderId, kioskId, slotId, thời điểm, trạng thái đơn và cmdId; che QR/mã biên nhận trong bằng chứng chia sẻ. Không ghi khóa kiosk hoặc credential PayOS.

Thông báo sẵn sàng trên website hiện chỉ hoạt động khi trang đơn đang mở. Email/push khi khách rời trang cần bổ sung sự kiện và kênh gửi từ BE. Máy quét QR dạng bàn phím được hỗ trợ; camera cần tích hợp theo phần cứng thực tế.
