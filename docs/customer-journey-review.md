# Cải thiện luồng khách mua hoa — 01/11/2026

Theo yêu cầu cuối, trang chủ trở lại bố cục đầy đủ ở HEAD trước đợt chỉnh UX: hero, hướng dẫn, cách hoạt động, gói thuê, vị trí tủ, gallery/gợi ý ngân sách, quản lý tiền, FAQ và tư vấn. Chỉ cập nhật nội dung cho đúng luồng báo giá, hoa giả, mua tại kiosk, phân loại ô, nhận OTP và quy trình thuê chính thức. CSS trang chủ và các bài kiểm tra landing đã trở về bản cũ. Phần lọc trùng phía trên danh mục đã bỏ; giữ bộ lọc trong sidebar/mobile sheet.

Danh mục lọc hình thức mua bằng `zone`: `WALK_IN` là mua tại kiosk; `PREORDER` hoặc catalog cũ không có zone là đặt qua web. Không dùng số lượng bouquet để suy luận kênh bán. Giá và nút yêu cầu báo giá diễn đạt đúng bước tiếp theo; Walk-in có liên kết đến vị trí tủ tương ứng.

FE tải các trang catalog trước khi lọc/sắp xếp và phân trang kết quả tại máy khách (12 mẫu/trang). Không công bố kết quả từng phần như toàn bộ danh mục nếu trang sau lỗi. Có giới hạn 100 trang API; nếu quy mô vượt mức này cần API hỗ trợ bộ lọc phía server. Đây là điểm cần theo dõi về tốc độ tải khi dữ liệu tăng.

Đăng nhập/đăng ký giữ `returnUrl` đến đúng mẫu hoa và mở lại form yêu cầu. Chỉ cho phép route và query nội bộ đã định nghĩa, có kiểm tra UUID; không mở rộng thành chuyển hướng tùy ý. Luồng nhắn với shop cũng giữ được ngữ cảnh sau đăng nhập. Chưa có dữ liệu người dùng nhập trước đăng nhập vì form chỉ xuất hiện sau đăng nhập.

Mobile dùng thẻ ảnh nhỏ cạnh tên/giá/thao tác; phần mô tả vẫn có trong trang chi tiết. Đã quan sát trực tiếp trang chủ và danh mục demo ở 390px, trang chủ ở 1440px và thao tác mở/đóng form, trả focus. API thật không kết nối được trong phiên đánh giá ban đầu; chưa kiểm thử thanh toán hay tạo đơn thật.

Kiểm tra lượt UX: ESLint, TypeScript, build production; 35/35 unit test cho catalog, đọc nhiều trang, quay lại sau đăng nhập và chống chuyển hướng ngoài. Các locator E2E danh mục liên quan được cập nhật theo tên nút và thẻ mobile mới. Lượt khôi phục trang chủ: ESLint và TypeScript đạt. Chưa chạy toàn bộ bộ E2E.
