# Seller — hoàn thiện chat, hoa tại tủ và vị trí kiosk

Ngày 01/11/2026. Nhánh `feat/seller-chat-stock-location-ux`, bắt đầu từ main `f9ca564` sau khi PR #56 đã merge. Chỉ thay FloraBot_FE. Chưa commit/push.

## Đã chỉnh

- Chat khách: ưu tiên hai cột danh sách/hội thoại; thông tin khách mở khi cần. Màn nhỏ dành riêng vùng xem thông tin, có nút đóng/Escape và trả focus. Ô nhập có viền nhẹ, focus bàn phím rõ; chữ, nút và khoảng cách theo nhận diện Seller hiện có.
- Giữ hội thoại và bản nháp đang soạn khi chuyển trang danh sách; không chọn nhầm khách ở trang mới. Chỉ đọc tin khi hội thoại nhìn thấy; bảng thông tin thay thế hội thoại ở màn hẹp không tự đánh dấu tin mới là đã đọc.
- Danh sách chat tìm không phân biệt dấu; ghi rõ tìm/lọc trong trang API hiện tại; xóa bộ lọc dễ thấy và vẫn quay lại được khi trang sau rỗng. Không nói đã đọc hết tin toàn hệ thống từ một trang dữ liệu.
- Bỏ nhãn online cố định vì DTO chat không có trạng thái hiện diện. Mẫu trả lời không khẳng định hoa có sẵn, thời gian chuẩn bị hoặc đã nạp tủ khi chưa có xác nhận. Bấm mẫu chỉ điền bản nháp.
- Ghi chú nói rõ chỉ lưu trên trình duyệt, không đồng bộ thiết bị/tài khoản và không gửi khách. Có nhãn nhập, trạng thái lưu, giữ nội dung nếu trình duyệt chặn lưu; không thông báo thành công giả. Giữ dữ liệu ghi chú hợp lệ đã có.
- Chat nhân viên: khi chưa có nhân viên hoạt động, có đường dẫn tới quản lý nhân viên shop. Giữ transport, upload, trạng thái tài khoản, realtime và phân quyền hiện có.
- Hoa tại tủ: bỏ thống kê lặp lại bộ lọc; đưa chọn kiosk lên sớm. Có đường dẫn tới mẫu hoa, đơn đặt trước và vùng nạp trực tiếp. Ô trống hợp lệ có nút chọn ô sang form và focus vào mẫu hoa; chưa bấm xác nhận thì không gọi nạp hoa. Bộ lọc không có kết quả có nút xem lại tất cả ô.
- Vị trí kiosk: ưu tiên tên/địa chỉ/trạng thái; mở form và bản đồ khi muốn chỉnh, hồ sơ thiếu vị trí mở sẵn. Đóng/mở editor giữ bản nháp; nhãn tìm kiếm/trạng thái nhìn thấy, có xóa bộ lọc và “Hoàn tác chưa lưu”. Nêu rõ lưu ghim không di chuyển hay kích hoạt thiết bị.

## API và phạm vi nghiệp vụ

Dùng `/api` và proxy hiện có; FE local 8088, BE deploy qua cấu hình môi trường. Không hardcode URL production hoặc thêm dependency/contract.

- Giữ GET `/api/sellers/{sellerId}/chats`, `/api/chats/{id}/messages`, các API gửi tin, upload ảnh, đánh dấu đọc và SignalR hiện có.
- Giữ API `/api/seller-staff/chats` và các endpoint chat nội bộ hiện có. Thành phần chat dùng chung Customer/Staff được chạy hồi quy vì có chỉnh copy và semantics bộ lọc.
- Giữ GET kiosk/slots/products; POST `/api/me/flows/stock_bouquet` với `{productId, slotId}`. Nút chọn ô chỉ thay dữ liệu form; không mở cửa hay tự gửi mutation.
- Giữ nguyên phân loại ô, điều kiện bán, nạp đơn đã thanh toán, thu hồi hoa và báo sự cố của team.
- Giữ PUT `/api/sellers/{sellerId}/kiosks/{kioskId}/location` với `{address, latitude, longitude}`, kiểm tra quyền toàn tủ và tọa độ hiện có. Không thêm quy trình chuyển tủ vật lý khi BE chưa có API cho bước đó.

## Kiểm chứng

- `pnpm lint`: đạt, 0 warning, chạy lại sau sửa Escape.
- `pnpm typecheck`: đạt trước hồi quy; production build cuối tiếp tục kiểm tra TypeScript, đạt.
- `pnpm test`: 185/185, 17 file.
- `pnpm build`: đạt, xác nhận lại sau bản sửa cuối.
- Playwright production: 97 ca, lượt đầu 95 đạt và 2 ca phát hiện Escape sau lưu ghi chú không đóng bảng thông tin. Đã sửa nguồn, giữ nguyên test; chạy lại 2 ca đó và 2 ca chọn ô ở 390/1440, đạt 4/4. Bổ sung thêm 1 ca ngăn đánh dấu đọc khi bảng thông tin che hội thoại ở màn 1280px; ca này và 2 ca chat desktop/mobile chạy lại đạt 3/3. Tổng cộng 98 ca khác nhau đã đạt qua hồi quy và các lượt chạy lại có mục tiêu.
- Bộ test gồm chat Customer/Seller, SignalR giả lập, upload/validation, chat nhân viên, tồn tủ, nạp/thu hồi, nhận hoa/OTP, vị trí/bản đồ, phạm vi quyền và 12 màn Seller; có Axe WCAG, reflow và focus. Test mới `tests/portal/seller-detail-flows.spec.ts` có 8 ca.
- Lệnh sử dụng: `pnpm exec playwright test --config artifacts/post-merge-review/seller-detail-review.config.ts`; chạy lại thêm `--grep 'Seller chat keeps drafts|Seller selects a valid empty slot'`.
- Config chạy tạm nằm trong artifacts không đưa vào Git. Team có thể dùng `playwright.portal.config.ts` sau build để chạy các spec tương ứng, đặt TEST_PORT sang cổng trống.
- Impeccable detector: một lượt trên 9 file TSX/CSS, exit 0, `[]`.
- Xem trực tiếp bằng Seller BE cấp: danh sách/hội thoại, mở/đóng thông tin, chọn ô trống sang form; kiểm tra desktop và 390×844, trả viewport về mặc định. Không gửi tin/ghi chú/nạp hoa/cập nhật vị trí thật. Ghi dữ liệu trong browser tests đều được chặn và giả lập.
- Không chạy GitHub CI.

## Giới hạn cần team biết

- BE chưa cung cấp presence trong DTO đang dùng: FE không suy diễn online từ kết nối SignalR hoặc trạng thái ACTIVE của tài khoản.
- Ghi chú hiện là localStorage. Muốn chia sẻ giữa thiết bị hoặc các nhân viên cần BE bổ sung lưu/đọc ghi chú và phân quyền tương ứng.
- Tìm kiếm hội thoại chỉ áp dụng trang đang tải; chưa có tìm kiếm toàn bộ hội thoại từ server.
- Kiểm thử HTTP giả lập và xem dữ liệu thật không thay thế nghiệm thu gửi tin, upload, thanh toán và thiết bị thật.

Ảnh xác nhận: `seller-chat-complete.png`, `seller-chat-complete-mobile.png` trong thư mục visualization ngoài repo. FE được mở lại cổng 8088 với BE deploy sau kiểm tra.
