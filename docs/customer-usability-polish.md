# Hoàn thiện UX Customer — 01/11/2026

Giữ khung tài khoản, màu xanh/trắng và các luồng của PR #57/#58 (main f485bbc). Không sửa BE, kiosk, contract sinh tự động hoặc cấu hình kết nối.

## Những phần đã sửa

- Đồng bộ hướng dẫn nhận preorder sang OTP gửi tới email đăng nhập, gồm form báo giá và hai đoạn trên trang chủ. Đã đối chiếu GET OpenAPI BE deploy: POST /api/me/preorders/{requestId}/pickup-otp có summary gửi tới email đăng nhập của khách. Chỉ đọc đặc tả, không gửi OTP thật.
- Sau khi tạo yêu cầu, liên kết mở /tai-khoan?requestId={id}#web-orders, để mở đúng yêu cầu vừa gửi.
- Tổng quan Customer có danh sách Đơn đang theo dõi bằng GET /api/member/preorders?page=1, tối đa ba yêu cầu chưa kết thúc; ưu tiên yêu cầu cần hành động và hoa sẵn sàng. Cache gắn với tài khoản. Có loading, lỗi/thử lại và nội dung rõ khi mới đọc trang đầu; không hiển thị tổng giả.
- Menu tài khoản mobile có nút Mục tài khoản để mở/thu gọn, đóng bằng Escape và trả focus. Menu desktop giữ nguyên.
- Hồ sơ trong khung tài khoản có thanh mục ngang bám khi cuộn, email đăng nhập gọn và khoảng cách biểu mẫu vừa phải. Khi bấm menu, mục được chọn giữ đúng; khi tự cuộn, mục chuyển theo phần đang đọc. Giữ nguyên trường, payload, OTP email liên hệ, kiểm soát bản nháp hồ sơ và che số ngân hàng.
- Form báo giá hỏi trước khi bỏ ngày/lời nhắn bằng X, Escape hoặc nền cửa sổ. Chọn Tiếp tục nhập giữ nguyên nội dung và focus. Trong lúc gửi không đóng/gửi lặp. Khi kết quả chưa chắc chắn, gửi lại vẫn dùng đúng id/payload ban đầu.

## API và giới hạn

POST /api/member/preorders giữ nguyên payload id, kind, productId, kioskId, pickupAt, instructions. Không thêm API ghi mới. Tổng quan chỉ tóm tắt dữ liệu trang đầu và dẫn tới danh sách đầy đủ. Xác nhận bỏ nội dung là bảo vệ khi đóng modal, không phải lưu bản nháp lâu dài hoặc qua lần tải lại trang.

## Xác minh

- ESLint trên các file TSX/TS và test liên quan: đạt.
- pnpm typecheck và build production: đạt.
- 47 unit test của catalog, quay lại sau đăng nhập và dữ liệu hồ sơ: đạt.
- 56 ca Playwright liên quan đã đạt sau các lần sửa và kiểm tra lại: lượt đầy đủ có 52 ca đạt; bốn ca bị ảnh hưởng bởi CSS/locator được sửa và xác nhận lại 4/4. Bao gồm chọn đúng tủ, request payload, retry cùng mã, trạng thái đang gửi, chống mất bản nháp, hồ sơ 6 role, ngân hàng, OTP liên hệ, responsive và quay lại catalog.
- Impeccable detector: 7 file UI được quét, 0 findings. Ảnh và accessibility của các màn được kiểm tra dùng API giả lập; không thay thế kiểm thử dữ liệu tài khoản thật hoặc thiết bị.

Không tạo đơn, thanh toán, tài khoản hay điều khiển IoT trên BE deploy trong lượt kiểm thử. Không kiểm tra GitHub CI. Chưa commit/push các thay đổi này.

## Bổ sung: hồ sơ các role vận hành

Ảnh Manager vẫn còn khoảng trống dưới menu dọc. Đã chuyển hồ sơ standalone của Admin/Operations Manager/Technician sang menu ngang dùng chung, bỏ số thứ tự và đoạn ghi chú dưới menu. Form dùng hết chiều ngang thay cho cột trống, thu gọn ô địa chỉ và khoảng cách helper/nút lưu. Không đổi trường, quyền hay API.

Xác nhận: build và lint đạt; 9/9 ca Playwright desktop/mobile cho ba role vận hành, quyền truy cập cả sáu role và hồi quy hồ sơ Customer đạt. Mục tiêu đề có khoảng cuộn đủ dưới thanh menu; axe trong các ca được chọn không ghi nhận violation. Dữ liệu trong ảnh/test là giả lập.
