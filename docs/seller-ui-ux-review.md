# Hoàn thiện UX/UI Seller FloraBot

Ngày: 01/11/2026. Nhánh bàn giao: `feat/seller-workspace-usability`.

Ưu tiên do người dùng chọn: đơn hàng hằng ngày trước, kèm hướng dẫn gọn cho shop mới.
Giữ nhận diện xanh/trắng hiện có; mode Operate. Chỉ sửa FloraBot_FE.

## Những điểm gây khó dùng trước sửa

- 11 mục Seller nằm trong hai nhóm lớn; việc giao hoa, nhân viên, tiền và gói thuê khó tìm.
- Tổng quan dẫn về trang đơn nhưng chưa mở đúng hồ sơ; người dùng phải tìm lại đơn.
- Trang đơn và danh mục có bộ thống kê dạng thẻ và bộ lọc trạng thái trùng nhau.
- Tên “mẫu hoa”, “bó hoa” và hành động tạo/nạp dễ bị hiểu là cùng một bước.
- Hướng dẫn thao tác nằm rải rác; thiếu giải thích ngay tại màn hình đang dùng.
- Lỗi catalog có thể đồng thời hiển thị lời nhắc shop chưa có mẫu hoa.

## Đã chỉnh

- Menu chia thành Đơn hàng & khách, Hoa & tủ, Nhân viên, Tiền & gói thuê; giữ đủ route và huy hiệu tin chưa đọc.
- Tìm chức năng không phân biệt dấu, hỗ trợ các từ quen dùng như “báo giá”, “nạp hoa”, “rút tiền”. Giữ Escape và trả focus trên menu mobile.
- Tổng quan đưa đơn và bước cần làm vào một vùng chính; số liệu tiến độ gọn, ví và nhân sự là thông tin phụ. Không thêm biểu đồ hoặc số liệu giả.
- Bấm đơn từ tổng quan mở đúng trang API, bung đúng hồ sơ và đưa focus vào chi tiết đơn.
- Đơn đặt trước có một bộ lọc trạng thái kèm số lượng trong trang, tìm đơn/ngày nhận và nút xóa bộ lọc.
- Danh mục có một bộ lọc trạng thái; thống nhất nút “Thêm mẫu hoa”, form nháp và hướng dẫn rõ việc tạo mẫu chưa nạp bó vào tủ.
- Mỗi mục có hướng dẫn mở gọn theo ngữ cảnh, nêu bước tiếp theo và liên kết tới màn hình liên quan. Hướng dẫn không tự gửi lệnh thiết bị, tạo đơn hoặc xác nhận thanh toán.
- Đồng bộ font, nhãn, focus, form, hộp thoại, bảng nhân sự, bộ lọc, bố cục ví/phụ kiện và responsive trong phạm vi Seller.
- Giữ nội dung catalog khi lỗi; chỉ hiển thị trạng thái rỗng sau khi tải thành công.
- Tăng tương phản phần ghi nguồn bản đồ, giữ nguyên nguồn Goong/MapLibre.
- Sửa thứ bậc heading sidebar chat nhân viên; không đổi logic chat hoặc API.

## API và quyền

Dùng lại các API hiện có, qua `/api` và proxy cấu hình sẵn tới BE deploy. Đã đối chiếu Swagger deploy (OpenAPI 3.1.1). Không hardcode production URL vào code UI, không sửa contract sinh tự động.

- Đơn: `GET /api/sellers/{sellerId}/preorders?page=...`; các lệnh báo giá/chuẩn bị/nạp giữ nguyên.
- Mẫu hoa: `GET/POST /api/me/products`; sửa giá, metadata, trạng thái và ảnh giữ nguyên endpoint/payload.
- Tủ và tồn: `GET /api/sellers/{sellerId}/kiosks`, `GET /api/me/kiosks/{kioskId}/slots`; không đổi điều kiện phân loại ô, nạp và thu hồi hoa.
- Nhân viên/giao việc/chat: giữ API theo shop và các kiểm tra phân quyền hiện có.
- Ví và gói: giữ API wallet, bank, withdrawals và subscriptions; không đổi số tiền, hạn mức, kỳ thuê hoặc bước xác nhận.

Tổng quan vẫn phân trang đơn theo `hasMore`, tối đa 50 trang và ghi rõ nếu còn dữ liệu. Link đến đơn mang đúng số trang đã tải. Bộ lọc ở màn đơn chỉ áp dụng trong trang hiện tại; không diễn đạt như kết quả toàn bộ shop.

Tất cả kiểm thử ghi dữ liệu sử dụng API giả lập riêng trong Playwright. Khảo sát live bằng tài khoản Seller BE đã cấp, chỉ xem màn hình và mở/đóng form; không tạo mẫu thật, báo giá, nạp/thu hồi hoa, gửi chat, yêu cầu rút hoặc thanh toán thật.

## Kiểm chứng

- `pnpm lint`: đạt, 0 warning.
- `pnpm typecheck`: đạt.
- `pnpm test`: 185/185, 17 file.
- `pnpm build`: production build đạt.
- Playwright: bộ 98 ca đạt 96 ca ở lượt hồi quy; 2 ca ảnh được sửa kỳ vọng theo nút upload bị khóa khi kết quả lưu chưa xác định, chạy lại đạt 2/2. Tổng cộng 98 ca đã đạt qua lượt hồi quy và lượt chạy lại có mục tiêu.
- Lệnh hồi quy: `pnpm exec playwright test --config artifacts/post-merge-review/seller-usability.config.ts`. Lệnh chạy lại: thêm `--grep "Product images validate"` (2 passed).
- Xác nhận trực tiếp FE 8088 với BE deploy: đăng nhập Seller hiện có, tổng quan tải đơn/ví/mẫu hoa; kiểm tra desktop và 390 × 844, không tràn ngang. Đã trả viewport về mặc định sau kiểm tra.
- Impeccable detector: một lượt trên 9 file TSX, exit 0, `[]`.
- Không chạy GitHub CI theo yêu cầu trước đó.

Bộ production cục bộ: `artifacts/post-merge-review/seller-usability.config.ts` (artifact không đưa vào Git). Test mới nằm trong `tests/portal/seller-usability.spec.ts`, dùng fixture `tests/fixtures/seller-usability.ts`. Team có thể chạy lại bằng `playwright.portal.config.ts` sau build, đặt TEST_PORT sang cổng trống khi cần.

Các test hiện có được cập nhật tên/selector theo UI đang dùng: thống kê đã gom vào bộ lọc; danh sách mẫu/ảnh và các nút upload/camera của team đã đổi từ trước. Giữ các kiểm tra payload, bytes ảnh, chống gửi lặp, phục hồi lỗi và chặn shop hết hạn.

## Giới hạn

- Không thay quy trình backend hoặc quy trình thuê kiosk bằng giao diện mới. Gói thuê tiếp tục hiển thị dữ liệu và kỳ thuê từ API subscriptions hiện có.
- Không tự gộp nhánh feature khác của team, không sửa BE, kiosk hoặc IoT.
- Axe và kiểm tra bàn phím/reflow không thay thế thử NVDA hay mọi thiết bị thực tế.
- Không chứng minh mọi nghiệp vụ tài chính hoặc thiết bị thật hoạt động chỉ bằng các bài test giao diện.

## Bổ sung: các màn và luồng Seller còn lại

Ưu tiên các điểm gây kẹt thao tác, tiếp tục trên cùng nhánh `feat/seller-workspace-usability`.

- Giao việc: bỏ ba thẻ thống kê lặp, ghi rõ số công việc thuộc trang/bộ lọc API hiện tại. Form chọn nhân viên và tủ thành hai cột trên desktop, xếp dọc trên mobile; hướng dẫn phân biệt phân công với ghi nhận nạp hoa. Nếu chưa có nhân viên hoặc tủ đủ điều kiện, hiển thị đúng nguyên nhân và liên kết đến màn xử lý thay vì một form không thể gửi. Nhãn lọc trạng thái luôn nhìn thấy ở Seller.
- Truyền sellerId xuống chi tiết công việc, ảnh bằng chứng và đổi người phụ trách để các khóa dữ liệu giữ đúng phạm vi shop. Giữ nguyên endpoint phân công `/api/me/staff-tasks`, payload và Idempotency-Key; giữ phục hồi cùng yêu cầu khi phản hồi bị mất.
- Ví: nhóm ngân hàng và yêu cầu rút cạnh nhau ở màn rộng, xếp dọc trên điện thoại; thêm nút mở đúng phần tài khoản nhận tiền và đưa focus vào đó. Số dư null hiện “—” kèm giải thích và không cho gửi yêu cầu rút; không biến thiếu dữ liệu thành số dư 0. Giữ nguyên bước xem lại, kiểm tra hạn mức và khóa gửi lặp khi kết quả chưa xác định.
- Gói thuê: tách tên gói, phí tháng và quy mô ô thành thông tin dễ đọc; nhóm chọn thời hạn với tổng phí; làm rõ kỳ đang chờ thanh toán và trạng thái từng kỳ. Giữ tính phí bằng monthlyFee từ API subscriptions, không dùng giá gói tĩnh hay tự xác nhận đã thanh toán.
- Phụ kiện: tìm không phân biệt dấu, lọc theo tủ và xóa bộ lọc; số kết quả phản ánh các dòng phụ kiện theo tủ API trả về. Có hướng dẫn trước khi tải, trạng thái không khớp và phục hồi lỗi. Giữ xác nhận bổ sung và payload `{p_accessory, p_qty}`, không đổi nạp/thu hồi hoa, chat hay payment của team.

File bổ sung/chỉnh tiếp: `TaskManagement.tsx`, `AdminTaskAssignment.tsx`, `Wallet.tsx`, `BankDetails.tsx`, `Subscriptions.tsx`, `SellerAccessories.tsx`, import tại `SellerWorkspace.tsx`, stylesheet `seller-flows.css`. Test mới `tests/portal/seller-flows.spec.ts` (10 ca), fixture cập nhật tên nhân viên phù hợp DTO danh bạ.

API dùng lại: GET staff-tasks/staff/staff-delivery-scopes theo seller, POST `/api/me/staff-tasks`; GET wallet/bank/subscriptions/accessories theo seller; các flow rút tiền, cập nhật ngân hàng, đăng ký kỳ thuê, tạo payment-link và bổ sung phụ kiện hiện có. Không thêm endpoint hoặc sửa BE/contract.

Kiểm chứng đợt bổ sung:

- `pnpm lint`: đạt 0 warning. Các file sửa sau lượt lint được chạy ESLint có mục tiêu, đạt.
- `pnpm typecheck`: đạt; production build cũng kiểm tra TypeScript.
- `pnpm test`: 185/185, 17 file, đạt.
- `pnpm build`: đạt; xác nhận lại sau lượt chỉnh khoảng cách cuối.
- Playwright production config `artifacts/post-merge-review/seller-flow-review.config.ts`: 75 ca. Lượt đầu 71 đạt, 4 phát hiện lỗi class form bị nối thiếu khoảng trắng sau format; đã sửa nguồn, giữ nguyên kiểm tra. Chạy lại 4 ca cùng 2 hồi quy phân công Manager/Seller đạt 6/6. Sau sửa khoảng cách/nhãn cuối, chạy lại 2 kích thước form và 1 ca phục hồi phân công Seller đạt 3/3.
- Có kiểm thử payload, Idempotency-Key, chống gửi lặp, dữ liệu null/rỗng/lỗi, đường dẫn ngân hàng, bộ lọc phụ kiện, bàn phím, Axe WCAG và tràn ngang 390/1440.
- Impeccable detector: một lượt trên 7 file của đợt này, exit 0, `[]`.
- Test ghi dữ liệu đều dùng API giả lập. Xem trực tiếp FE8088 với BE deploy bằng tài khoản hiện có; không gửi phân công thật, ngân hàng, rút tiền, kỳ thuê hoặc bổ sung phụ kiện thật. Không chạy CI GitHub.

Giới hạn: phụ kiện lọc trong dữ liệu endpoint hiện trả; không suy diễn thành tìm kiếm server hoặc số lượng toàn hệ thống. Tiến độ giao việc theo bộ lọc và trang BE, không dựng tổng shop từ một trang. Kiểm thử giao diện giả lập không thay thế nghiệm thu tiền/thiết bị thực.

Xác nhận trực quan: form giao việc dùng nhân viên và tủ BE thật, kiểm tra desktop và 390 × 844; đã trả viewport về mặc định. Ảnh cuối: `seller-delivery-flow.png`, `seller-delivery-flow-mobile.png`, `seller-wallet-flow.png` trong thư mục visualization ngoài repo. Bàn giao qua nhánh riêng; tích hợp main qua pull request sau khi team review.
