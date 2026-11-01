# FloraBot — UML Activity Diagram: luồng kiosk

Mở file FloraBot-Kiosk-Activity.drawio bằng diagrams.net (File → Open From → Device). Có 4 trang, mọi action, decision, guard, swimlane và đường nối đều chỉnh sửa được.

1. Tổng quan
2. Mua hoa trực tiếp (Walk-in)
3. Nhận đơn đặt trước bằng mã email
4. Nhận tiếp đơn đã thanh toán và hỗ trợ

Nguồn đối chiếu: FloraBot_Kios commit 2fa0420; apps/kiosk/src/main.tsx, KioskHome.tsx, CustomerLogin.tsx, PreorderPickup.tsx, PickupRecovery.tsx; FloraBot_BE/Modules/Ordering/PreorderPickupOtp*.cs và ADR 0038.

Lưu ý: mã nhận preorder hiện là 8 chữ số gửi qua email; OTP đăng nhập thành viên là 6 chữ số qua SMS. Không đồng nhất hai cơ chế này. Luồng Walk-in hiển thị hiện không mở chức năng phụ kiện. Các nhánh lỗi được gom để dễ đọc, không liệt kê toàn bộ HTTP code hoặc sự kiện thiết bị.

Sơ đồ mô tả logic code, không phải bằng chứng đã chạy thử phần cứng / thanh toán thật. Trạng thái nhận hoa chỉ hoàn tất sau sự kiện từ thiết bị, không phải ngay khi API chấp nhận lệnh mở.
