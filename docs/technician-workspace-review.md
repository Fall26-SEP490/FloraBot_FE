# Technician — giao diện làm việc tại tủ

Ngày 01/11/2026. Nhánh `feat/technician-workspace-usability`, tách từ main sau PR #59. Chỉ FloraBot_FE.

## Thay đổi

- Trang công việc đưa phiếu sự cố lên trước, bỏ lời chào/khối chào mừng và thống kê lặp. Trạng thái lọc có nhãn; số lượng ghi rõ trong trang, theo hasMore.
- Mỗi phiếu có nút mở Bắt đầu xử lý / Tiếp tục xử lý / Xem báo cáo. Form chỉ mở khi cần; thu/mở giữ nội dung đang nhập. Hướng dẫn chuyển thành mục mở rộng.
- Lắp đặt có tìm kiếm không dấu theo shop, mã tủ, địa chỉ và lọc trạng thái trên danh sách API trả về. Không tự tạo tổng hoặc lịch hẹn.
- Điện thoại xem danh sách rồi mở từng phiếu, có nút Danh sách lắp đặt và trả focus. Quay lại không tháo form nên giữ báo cáo của phiếu đang chọn. Chọn phiếu khác vẫn chuyển ngữ cảnh theo hành vi cũ; không có lưu bản nháp qua tải lại trang.
- Máy tính có danh sách/chi tiết cạnh nhau. Địa chỉ, mã tủ và liên hệ rõ hơn; hiển thị chỉ dẫn bước tiếp theo từ trạng thái hồ sơ. Liên kết chỉ đường chỉ xuất hiện khi có tọa độ hợp lệ.
- Giữ bắt đầu → tải/đính kèm ảnh → báo cáo → chờ Manager bàn giao. Technician không có thao tác handover. ACTIVE được diễn đạt Đã bàn giao, không suy ra thiết bị đã ONLINE.
- CSS chỉ áp dụng trong khung Technician; các component task dùng chung giữ hiển thị cũ cho role khác.

## API và giới hạn

Giữ request /api, cấu hình BE deploy, phiên và quyền hiện có. Không sửa BE, kiosk, contracts hoặc thêm API.

- GET /staff/tasks?page=...&status=...; POST /staff/tasks/{id}/transition, /resolve-incident và API ảnh/chi tiết công việc hiện có.
- GET /staff/kiosk-installations; GET /staff/kiosk-installations/{id}; POST /start, /evidence/upload, /evidence, /submit cùng các API đọc ảnh hiện có.
- Không gọi ghi dữ liệu, điều khiển IoT, bàn giao hoặc tạo tài khoản trên BE deploy trong lượt này. Test trình duyệt dùng response giả lập; không chứng minh thiết bị hoặc hồ sơ thật đã hoàn tất.

## Kiểm tra

- pnpm lint, pnpm typecheck: đạt.
- pnpm test: 199/199 unit test đạt.
- pnpm --filter @florabot/web build: đạt.
- Impeccable detector: 7 file giao diện, 0 finding trong lượt quét; vẫn rà ảnh desktop/mobile và kiểm thử tương tác.
- Playwright: 42 ca khác nhau đã đạt qua các lượt chạy. Lượt rộng có 40/42 đạt; sửa lỗi CSS và test điều kiện báo cáo rồi xác nhận 13/13 ca liên quan đạt, gồm hai ca trước đó lỗi. Không phải một lượt nguyên bộ 42/42. Bao gồm sự cố/khôi phục sau mất phản hồi, tải ảnh/đính kèm lại, báo cáo thiếu ảnh, 403/404, Manager bàn giao, phân quyền và trạng thái tải/rỗng/lỗi.
- Ảnh desktop/mobile 390/1440 đã được xem, không tràn ngang; kiểm tra axe trong các ca liên quan đạt. Dùng Chrome cài sẵn vì Chromium mặc định của Playwright chưa cài; cấu hình test tạm và ảnh nằm trong artifacts, ngoài commit.
- Không kiểm tra CI GitHub.

## Bổ sung: xác minh BE deploy và dữ liệu thật — 01/11/2026

Phần này là kết quả mới, thay thế giới hạn chỉ kiểm tra giả lập của lượt UI phía trên.

- FE chạy localhost:8088, PUBLIC_API_URL=/api, API_PROXY_TARGET=https://api.florabot.site. Không khởi động BE hoặc DB local. Không sửa BE/contract/kiosk.
- Swagger/OpenAPI và health BE deploy HTTP 200, health status ok. Các API Technician đang sử dụng đều có trong OpenAPI deploy; chưa phát hiện thiếu endpoint trong phạm vi này.
- Đăng nhập Technician BE cấp thành công, đúng Lợi Technical. GET công việc sự cố trả 200, trang 1 có 0 công việc và hasMore=false. Đây là danh sách thật rỗng; không dựng sự cố hay suy ra thiếu API.
- GET danh sách, chi tiết và ảnh lắp đặt đều 200. Phiếu Shop Hoa Dĩ An / K-DIAN-01, ID 01a18b85-2db2-734e-b26d-4ee12120fe5a được phân công cho tài khoản này; lúc bắt đầu test ở SCHEDULED, lịch 02/11/2026.
- Đã chạy 2/2 bài kiểm thử tích hợp UI với BE deploy qua FE 8088, không route.fulfill, không mock response, không thay data nghiệp vụ. Đọc danh sách; bấm bắt đầu thật; upload ảnh mô hình kiosk có sẵn; đính kèm; gửi báo cáo và đọc lại từ BE. Sau gửi phiếu ở AWAITING_HANDOVER, có ảnh đọc lại HTTP 200 và nội dung báo cáo đúng.
- Người dùng cho phép ảnh minh họa tạm vì chưa có ảnh tủ thực tế. Tên file TEST-anh-mo-hinh-chua-lap-dat.webp; báo cáo mở đầu KIỂM THỬ TÍCH HỢP FE, ghi rõ chưa xác nhận lắp đặt vật lý/nguồn điện/thiết bị. Không được dùng báo cáo này làm bằng chứng nghiệm thu vật lý.
- Không gọi handover, không tạo seller, không tạo tài khoản, không đổi mật khẩu, không điều khiển IoT. Manager cần xem lại hồ sơ trước khi quyết định bước tiếp theo.
- Đã hoàn thiện xem lại ảnh sau khi gửi báo cáo và sau bàn giao bằng API đọc ảnh hiện có, kèm mở ảnh riêng/thử lại khi lỗi. Không hiện số 0 giả khi ảnh đang tải hoặc lỗi.

### Phần cần team phối hợp

Không thiếu API lắp đặt trong phạm vi đã kiểm tra. Luồng xử lý sự cố có đủ endpoint trong OpenAPI nhưng chưa có công việc thực tế giao cho Technician để xác minh POST transition/upload/evidence/resolve-incident. Cần Manager phân công một sự cố phù hợp rồi kiểm thử tiếp; không cần BE tạo endpoint mới chỉ vì danh sách đang rỗng.

### Chạy kiểm thử thật

File playwright.deployed.config.ts và tests/deployed/technician.spec.ts. Mặc định không chạy khi chưa bật RUN_LIVE_TECHNICIAN=1 và cấp LIVE_TECHNICIAN_EMAIL/LIVE_TECHNICIAN_PASSWORD qua môi trường; không ghi thông tin đăng nhập vào repo. Chỉ định LIVE_WEB_ORIGIN nếu FE khác localhost:8088. Kiểm thử đọc không ghi nghiệp vụ. Test bắt đầu/gửi báo cáo chỉ bật khi cấp chính xác LIVE_WRITE_APPLICATION_ID, không tự chọn hồ sơ đầu tiên và không bàn giao. Chạy bằng pnpm exec playwright test --config playwright.deployed.config.ts.

Bài kiểm thử ghi ảnh/báo cáo không dùng cho hồ sơ lắp đặt thật đã nghiệm thu; phải chỉ định hồ sơ được cho phép dùng kiểm thử. Các ảnh kết quả lưu trong test-results/deployed ngoài Git.
