# Manager — thao tác theo công việc

Ngày 01/11/2026. Chỉ thay đổi FloraBot_FE; chưa commit/push. Giữ nguyên các sửa Seller đang có.

## Đã triển khai

- Tổng quan bỏ banner giới thiệu lớn, mở bằng Việc cần xử lý: chờ xác nhận liên hệ, chờ xếp lịch, chờ bàn giao và báo cáo sự cố chờ duyệt. Bấm vào nhóm dẫn đúng bộ lọc; số lượng lấy từ API qua các trang theo hasMore, loại ID trùng.
- Menu ưu tiên Hồ sơ thuê/lắp đặt và Công việc kỹ thuật, sau đó đến kỹ thuật viên, shop và khách hàng. Có tìm kiếm không dấu, xóa tìm kiếm trả focus về ô nhập; giữ hành vi Escape/menu điện thoại.
- Hồ sơ dùng nhãn mở chi tiết theo trạng thái: Xác nhận liên hệ, Xếp lịch, Xem lịch, Theo dõi lắp đặt, Kiểm tra bàn giao. Các nút này chỉ mở chi tiết, chưa gọi API ghi dữ liệu.
- Chi tiết đưa liên hệ, địa điểm và lịch được giao ra trước. Gói thuê, ngân hàng, tọa độ nằm trong mục mở rộng. Khóa kết nối thiết bị nằm riêng phía dưới, giữ cảnh báo vô hiệu khóa cũ và xác nhận cấp lại.
- Công việc kỹ thuật bỏ ba khối số liệu lặp, dùng số lượng trong trang, bộ lọc rõ nhãn và form phân công mở theo nhu cầu. Hướng dẫn dài thu gọn.
- Sáu màn tổng quan, hồ sơ/lắp đặt, công việc, kỹ thuật viên, shop, khách hàng dùng chung lớp trình bày Manager. Trang kỹ thuật viên bỏ thống kê trùng với bộ lọc; nhãn trường vẫn rõ. Danh sách hồ sơ điện thoại được thu ngắn.

## API và quyền

Dùng request /api hiện có, không hardcode URL production.

- GET /operations/kiosk-applications?page=...&limit=...&status=PAID_REVIEW|CONFIRMED|AWAITING_HANDOVER: số lượng từng nhóm; danh sách/chi tiết vẫn dùng API hiện có.
- GET /operations/staff-tasks?page=...&status=SUBMITTED: số báo cáo chờ duyệt và link đến đúng trạng thái.
- GET /operations/eligible-kiosks: kho tủ; link tổng quan mở đúng dialog kho.
- GET /operations/technicians: kỹ thuật viên hoạt động.
- Giữ API và form hiện có của quản lý shop, khách hàng, tài khoản kỹ thuật viên, confirm/schedule/rework/handover, enroll/delete/provision-key.
- Admin vẫn chỉ giám sát hồ sơ; Technician không được bàn giao. Không đổi endpoint, payload, quy tắc tiền/thiết bị hoặc contract sinh tự động.

## Giới hạn

- Bộ đếm tự tải tối đa 50 trang mỗi nhóm. Khi còn dữ liệu, hiện ≥ và ghi rõ phạm vi, không xem trang đầu là tổng hệ thống. Từng nguồn lỗi độc lập; không thay lỗi bằng 0.
- Luồng UNDER_REVIEW và các trạng thái khác vẫn tra cứu từ bộ lọc hiện có; không tự thêm thao tác BE chưa cung cấp.
- Đã thử lại và đăng nhập thành công bằng tài khoản Manager BE cấp sau khi người dùng xác nhận thông tin không đổi. Lần thử đầu chưa đủ kết luận tài khoản có vấn đề. Không tạo tài khoản hay đổi mật khẩu. Tổng quan BE thật có 2 hồ sơ, 1 kỹ thuật viên hoạt động, 1 tủ khả dụng; các nhóm chờ xử lý hiện là 0. Các thao tác ghi vẫn chỉ nghiệm thu bằng API giả lập.
- Không gọi thanh toán, bàn giao, xóa tủ, cấp lại khóa hoặc thay đổi tài khoản thật. Các API nghiệp vụ POST/DELETE trong test được chặn/giả lập; đăng nhập tài khoản BE thật là thao tác đã được người dùng cho phép.

## Kiểm tra

- pnpm lint: đạt sau dọn một import không còn dùng; file thay đổi tiếp được ESLint lại.
- pnpm typecheck: đạt.
- pnpm test: 195/195, 19 file, gồm 4 unit test mới cho bộ đếm và nhãn/trạng thái.
- Production build: đạt; build lại sau lượt thu gọn responsive cuối.
- Playwright production: hồi quy 92 ca đạt 88; 4 ca cũ dừng ở nhãn Chi tiết trước bước bàn giao. Sau cập nhật đúng nhãn Kiểm tra bàn giao và thu gọn responsive, chạy lại 44 ca: 43 đạt; ca tài khoản còn dùng tiêu đề cũ, đổi sang Danh sách kỹ thuật viên rồi chạy lại đầy đủ ca đó đạt 1/1. Tất cả 92 ca khác nhau đã đạt qua hồi quy/các lượt chạy lại có mục tiêu; không phải một lượt 92/92. Giữ nguyên kiểm tra tạo tài khoản, trạng thái, ảnh, báo cáo, thiếu bằng chứng, payload xếp lịch/bàn giao và phân quyền.
- Manager mới có 17 ca: 6 màn x 390/1440, đếm nhiều trang, điều hướng vào đúng hồ sơ/báo cáo/kho, tìm menu, lỗi nguồn độc lập và không ghi dữ liệu.
- Impeccable detector: 8 file UI, không finding. Đã xem desktop/mobile, tập trung vào thông tin và bước tiếp theo. Không kiểm tra GitHub CI.

## File chính

- Dashboard: OperationsOverview.tsx, operations-queue.ts.
- Portal: ManagerNavigation.tsx, WorkspaceNavigation.tsx, OperationsWorkspace.tsx, styles/manager-usability.css.
- Installations: operations-presentation.ts, hooks/useInstallationList.ts, OperationsInstallations.tsx, components/InstallationList.tsx, InstallationDetails.tsx, InstallationActionCards.tsx.
- Tasks: TaskManagement.tsx và task-management.types.ts.
- Tests: operations-queue.test.ts, fixtures/manager-usability.ts, portal/manager-usability.spec.ts; cập nhật thao tác mở khóa và nút bàn giao trong các test hiện có.

## Xác minh bằng tài khoản BE thật

- Đăng nhập vận hành trả HTTP 200, vào đúng role OPERATIONS_MANAGER.
- Bấm nhóm Chờ xác nhận đến bộ lọc PAID_REVIEW; kết quả rỗng khớp số 0 trên tổng quan. Bỏ lọc hiển thị 2 hồ sơ.
- Mở hồ sơ Shop Hoa Dĩ An: kỹ thuật viên Lợi Technical, tủ K-DIAN-01, ngày 02/11/2026, 09:00–12:00. Chỉ đối chiếu thông tin; không lưu lịch.
- Đã mở bảng kỹ thuật viên, shop và khách hàng bằng API thật, không có thông báo lỗi. Link Báo cáo chờ duyệt vào đúng bộ lọc SUBMITTED, hiện chưa có công việc.
- Kho tủ đã kiểm tra đầy đủ bằng API giả lập; lần xem thật dừng trước thao tác mở kho, nên không ghi là đã xác minh dialog kho với dữ liệu thật.
- Công cụ trình duyệt sau đó bị tắt trong Work settings. Không thực hiện thêm thao tác UI hay thay đổi tài khoản để vượt qua cài đặt này. FE vẫn phục vụ cổng 8088, dùng BE deploy.
- Ảnh bàn giao Manager là ảnh production test với dữ liệu giả lập, lưu ngoài Git: manager-workspace-preview.png và manager-installations-mobile-preview.png trong thư mục visualizations của phiên.

## Làm lại tổng quan theo phản hồi giao diện trống

- Bỏ hàng 4 số 0 lớn và lời chào lặp; desktop dùng hồ sơ làm vùng chính, hàng đợi/nguồn lực thành cột phụ.
- Hàng đợi chuyển thành các dòng thao tác gọn với số đếm nhỏ. Chỉ hiện “Không có việc đang chờ” khi cả 4 nguồn thành công, bằng 0 và đã tải đủ. API đang tải, lỗi hoặc chưa đầy đủ không được kết luận như vậy.
- Hồ sơ SCHEDULED/INSTALLING có ngày hợp lệ hiển thị lịch, khung giờ, kỹ thuật viên và mã tủ từ response hiện có; không dựng lịch giả. Hồ sơ ACTIVE không được gắn lịch cũ như lịch triển khai hiện tại.
- Điện thoại đưa nguồn lực xuống sau hồ sơ, giữ bộ lọc dẫn đúng màn và vùng bấm rõ ràng. Trạng thái nhỏ dùng màu dịu; không thêm biểu đồ, API ghi hay dữ liệu hardcode.
- ESLint file TSX/test và typecheck đạt. Build production đạt. 29/29 ca Manager/operations-workspace đạt; lượt xác nhận responsive cuối 7/7 ca tổng quan liên quan đều đạt.
- Ảnh xem trước là production test với dữ liệu giả lập; không khẳng định đó là ảnh dữ liệu BE thật. FE thực vẫn dùng cấu hình BE deploy.
