# FE Manager, Technician và Admin — 26/10/2026

Nhánh `feat/platform-role-workspaces`, tách từ `main` tại `fd9349e`.
Phạm vi đợt này là quản lý tài khoản, shop và độ tin cậy của màn lắp đặt kỹ thuật.
Các API đều do BE có sẵn; chỉ bổ sung UI/UX và kết nối trong repository FE.

## Phần đã làm

- Manager — `/operations/customers`: tìm kiếm, lọc trạng thái, phân trang từ server; tạo Customer; đọc/sửa hồ sơ; xác nhận khóa, mở hoặc vô hiệu hóa tài khoản.
- Manager — `/operations/sellers`: danh sách và chi tiết shop, gói hiện tại; sửa tên/điện thoại/địa chỉ shop và hồ sơ chủ shop; tạm ngừng/khôi phục shop với lý do, bước xác nhận và lịch sử phân trang. Chỉ cho ACTIVE ↔ SUSPENDED; BE quyết định điều kiện gói và quyền cuối cùng.
- Manager — `/operations/technicians`: bổ sung đọc chi tiết và sửa hồ sơ kỹ thuật viên vào màn quản lý hiện có.
- Admin — `/admin/managers`: bổ sung đọc chi tiết và sửa hồ sơ Manager vào màn quản lý hiện có.
- Admin — `/admin/accounts`: tra cứu tài khoản của 6 vai trò, lọc trạng thái, phân trang và đọc hồ sơ. Ngân hàng cá nhân tách khỏi ngân hàng shop; mặc định che số, chỉ hiện khi bấm. Hồ sơ chi tiết không lưu trong query cache hay localStorage; đóng/ẩn tab hoặc hết một phút sẽ xóa dữ liệu khỏi dialog.
- Technician — `/technician/installations`: chờ chi tiết thật trước khi cho thao tác; lỗi danh sách/chi tiết/minh chứng có nút thử lại; chặn nộp khi đang tải ảnh hoặc chưa đọc được minh chứng; báo cáo ít nhất 10 ký tự, cần ảnh đã đính kèm. Bổ sung nhãn cho chọn ảnh.
- Bổ sung menu, trạng thái tải/lỗi/rỗng, phản hồi sau lưu và bố cục thẻ trên mobile. Gửi chuỗi rỗng khi người dùng xóa điện thoại/địa chỉ vì BE dùng null với nghĩa giữ nguyên.
- Đồng bộ OpenAPI và sinh lại TypeScript từ BE hiện tại: 240 operations, gồm 18 API quản lý trước đây thiếu trong contract FE.

## 18 API được bổ sung kết nối

Đường dẫn dưới đây đều có tiền tố `/api`.

| Vai trò | Method    | Đường dẫn                                          | Chức năng                |
| ------- | --------- | -------------------------------------------------- | ------------------------ |
| Manager | GET       | `/operations/sellers`                              | Danh sách shop           |
| Manager | GET       | `/operations/sellers/{sellerId}`                   | Chi tiết shop            |
| Manager | PATCH     | `/operations/sellers/{sellerId}/status`            | Tạm ngừng/khôi phục shop |
| Manager | GET       | `/operations/sellers/{sellerId}/status-history`    | Lịch sử trạng thái       |
| Admin   | GET, PUT  | `/admin/managers/{id}`                             | Đọc/sửa Manager          |
| Manager | GET, PUT  | `/operations/technicians/{id}`                     | Đọc/sửa Technician       |
| Manager | GET, POST | `/operations/customers`                            | Danh sách/tạo Customer   |
| Manager | GET, PUT  | `/operations/customers/{id}`                       | Đọc/sửa Customer         |
| Manager | PATCH     | `/operations/customers/{id}/status`                | Đổi trạng thái Customer  |
| Manager | PUT       | `/operations/sellers/{sellerId}`                   | Sửa shop                 |
| Manager | GET       | `/operations/sellers/{sellerId}/accounts`          | Danh sách chủ shop       |
| Manager | PUT       | `/operations/sellers/{sellerId}/accounts/{userId}` | Sửa chủ shop             |
| Admin   | GET       | `/admin/accounts`                                  | Tra cứu 6 vai trò        |
| Admin   | GET       | `/admin/accounts/{userId}/profile`                 | Hồ sơ và ngân hàng       |

## Chỉnh UI/UX các luồng nền tảng

- Giao diện chung của Admin, Manager và Technician dùng sidebar sáng, nền xanh nhạt, tiêu đề phân cấp và nút chính/phụ rõ hơn. Styles được giới hạn bằng `platform-workspace`, không áp vào Seller, Seller Staff hay trang công khai.
- Danh sách Customer, shop và tài khoản hệ thống có ảnh đại diện chữ cái, thông tin chính/phụ, số mục đúng theo trang hiện tại; thanh tìm kiếm/lọc cùng hàng và nút xóa bộ lọc.
- Hồ sơ có phần nhận diện và trạng thái riêng; thông tin liên hệ chia nhóm, form có gợi ý số điện thoại và đếm ký tự địa chỉ. Hồ sơ shop chia hai cột ở desktop: thông tin shop bên trái, chủ shop và lịch sử bên phải.
- Technician có tiến độ bốn bước theo trạng thái BE. Chọn ảnh dùng nút tiếng Việt, hiện tên file/định dạng/dung lượng; nút báo cáo ngắn gọn hơn. Trạng thái chưa được phân công giải thích bước tiếp theo.
- Menu mobile không còn chiếm một khoảng trống lớn. Bảng chuyển thành thẻ trên điện thoại, modal có tiêu đề/nút đóng giữ ở trên khi cuộn, hỗ trợ bàn phím và giảm chuyển động theo hệ điều hành.

## Kiểm tra và giới hạn

- TypeScript, ESLint, production build và 58/58 unit tests đạt.
- 52/52 bài kiểm tra trình duyệt với HTTP fixtures đạt, gồm 15 bài trong `tests/portal/platform-role-workspaces.spec.ts` và hồi quy account-management, operations-workspace, workspace-roles, workspace-navigation, kiosk-onboarding. Bao gồm payload, quyền, phân trang, lỗi/thử lại, xung đột, xóa trường liên hệ, dữ liệu ngân hàng, xóa bộ lọc và menu mobile. Kiểm tra reflow/accessibility danh sách và hồ sơ ở 320/390/768/1440 px; màn Technician có tiến độ/minh chứng ở 390/1440 px.
- Đã sửa giới hạn địa chỉ FE từ 500 xuống 300 ký tự, chặn ký tự điều khiển/xuống dòng theo validation BE. Có bài kiểm tra không gửi PUT khi địa chỉ không hợp lệ.
- Trên DB local đang dùng: các GET quản lý và màn Admin/Manager đọc được dữ liệu. Admin, Manager và Technician đã đăng nhập thật; Technician được tạo theo xác nhận của người dùng, thông tin đăng nhập chỉ lưu ngoài Git.
- Kiểm tra sâu trên bản sao PostgreSQL riêng `florabot_verify_20261026_6d1b381b`, BE 5091 và FE 8089, tắt jobs/MQTT và không sao chép CAP messages: **59/59 kiểm tra API thật đạt, bao phủ đủ 18 API quản lý mới**, gồm lưu/đọc lại dữ liệu, xóa trường liên hệ, tạo Customer, đổi trạng thái, từ chối phiên Customer đã khóa, lịch sử shop và các trường hợp bị từ chối đúng 400/401/403/409. Đây là API/DB thật với dữ liệu kiểm thử, không mock HTTP.
- **3/3 kiểm tra trình duyệt với API thật đạt** trên stack sao chép: Admin lọc/xem hồ sơ và lưu Manager rồi reload; Manager tạo/sửa/khóa/mở Customer, sửa shop/chủ shop, khóa/mở shop có lịch sử, lưu Technician; Technician đăng nhập và đọc danh sách/lắp đặt. Các bản ghi nghiệp vụ trong DB `florabot` không bị thay đổi bởi những lần thử ghi này.
- Luồng Technician được thử thêm với hồ sơ SCHEDULED chỉ trong DB sao chép: danh sách, chi tiết, bắt đầu công việc và đọc minh chứng trả 200; upload ảnh trả **503 “Kho ảnh chưa sẵn sàng”**, nộp báo cáo khi chưa có ảnh trả **409**. File `.env` BE local hiện thiếu đủ ba biến Cloudinary. Chưa nghiệm thu upload/đính kèm/xem ảnh thật và nộp báo cáo thành công; không tính các bước đó là đã dùng được. IoT thật chưa được kiểm tra.
- Dữ liệu kiểm thử shop trong DB đang dùng có SĐT `0000000000` và trạng thái PENDING; cần nhập SĐT hợp lệ trước khi lưu. Nút tạm ngừng/khôi phục chỉ xuất hiện cho ACTIVE/SUSPENDED, và khôi phục cần gói còn hiệu lực. Bộ thử riêng đã chuẩn bị SĐT/gói/trạng thái hợp lệ trong DB sao chép, không áp các thay đổi này vào shop local đang dùng.
- Đợt này không thay đổi phần chat, payment, Seller tạo hoa và luồng lấy hoa kiosk/web do thành viên khác phụ trách. Không sửa repository BE, Kios hay cấu trúc DB.
- Đây chưa phải nghiệm thu toàn bộ tính năng của ba vai trò. Các API điều khiển cửa/cấu hình/trạng thái thiết bị và các luồng tài chính độc lập cần đối chiếu và phân công riêng theo phạm vi team.

## Cách xem

FE local: `http://localhost:8088`. Đăng nhập nền tảng tại `/admin/login` bằng tài khoản local đúng vai trò, rồi mở các đường dẫn ở trên. Không đưa mật khẩu test vào repository.

Thay đổi được chuẩn bị trên nhánh `feat/platform-role-workspaces`. Đối chiếu với `origin/main` trước khi push và tạo pull request; chỉ xóa nhánh sau khi pull request đã merge.
