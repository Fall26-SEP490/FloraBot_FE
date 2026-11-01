# Seller: thao tác theo công việc

Ngày 01/11/2026 · nhánh `feat/seller-chat-stock-location-ux` · chỉ FloraBot_FE, chưa commit/push.

## Phần làm mới

- Tổng quan mở bằng **Việc cần làm**: chờ báo giá, chờ khách xác nhận, chờ thanh toán, đang chuẩn bị, sẵn sàng tại tủ. Chọn một nhóm đến đúng bộ lọc đơn.
- Tin nhắn khách hàng có số **cuộc trò chuyện chưa đọc**, lấy qua các trang API; chỉ đọc danh sách, không đánh dấu đọc từ dashboard.
- Đơn đặt trước tìm và lọc trên dữ liệu gom qua các trang API, thay cho chỉ lọc trang đang mở. Hiển thị 20 kết quả mỗi trang trên FE, đổi bộ lọc quay về trang kết quả đầu. Link đến đúng yêu cầu vẫn mở/focus chi tiết, kể cả ở trang API sau.
- Mỗi dòng đơn có câu hướng dẫn ngắn và nhãn mở chi tiết theo trạng thái: Báo giá, Chuẩn bị & nạp hoa, Theo dõi thanh toán, Theo dõi nhận hoa.
- Trên điện thoại dùng ô chọn trạng thái native và nút mở bộ lọc ngày, tránh danh sách tab dài. Hướng dẫn cho shop mới chuyển xuống dưới công việc chính; vẫn mở được khi cần. Giữ màu và shell FloraBot.
- Giữ form đang nhập khi tải thêm dữ liệu; không tự gửi hoặc xác nhận thao tác khi mở đơn.

## API sử dụng

- `GET /api/sellers/{sellerId}/preorders?page={page}`: nguồn chung cho dashboard và danh sách Seller, theo `hasMore`, loại ID trùng, giữ số trang nguồn, báo lỗi nếu trang tiếp theo hỏng hoặc không tiến được.
- `GET /api/sellers/{sellerId}/chats?page={page}`: đếm hội thoại có unreadCount > 0. Không phải số tin nhắn.
- Giữ API mẫu hoa, ví, nhân viên và các POST báo giá/nạp hoa/OTP hiện có. Không sửa BE, contract sinh tự động, Kios, payment transport hay lệnh thiết bị.

## Giới hạn cần biết

- BE hiện được dùng qua API phân trang; chưa có endpoint thống kê/tìm kiếm tổng hợp trong luồng này. FE tự tải tối đa 50 trang ban đầu để chặn việc tải không giới hạn. Người dùng có thể mở rộng phạm vi thêm 50 trang mỗi lần. Nếu còn trang, giao diện ghi rõ kết quả chưa đầy đủ; tại danh sách đơn có nút tải thêm 50 trang. Dashboard chỉ tính phần đã tải.
- Tải thêm đọc lại các trang để đối chiếu; dữ liệu cập nhật định kỳ không phải snapshot giao dịch của toàn bộ shop. Với shop lớn, nên bổ sung thống kê và bộ lọc phía BE.
- Hộp tin nhắn cũng giới hạn 50 trang; khi chưa tải hết ghi “Ít nhất”, không báo số tổng tuyệt đối.
- Các test ghi dữ liệu dùng API giả lập. Xem bằng BE deploy không chứng minh thanh toán ngân hàng hoặc phần cứng thật hoạt động.

## File chính

- `apps/web/src/features/dashboard/SellerOverview.tsx` và `styles/seller-overview.module.css`.
- `apps/web/src/features/orders/WebRequests.tsx`, `seller-queue.ts`, `orders.utils.ts`, `orders.types.ts`, `seller-orders.module.css`.
- `apps/web/src/features/portal/role-workspaces/SellerWorkspace.tsx` và `components/SellerGuide.tsx`.
- `tests/seller-queue.test.ts`, `tests/portal/seller-workbench.spec.ts`, cập nhật nhãn tìm kiếm trong `tests/portal/seller-usability.spec.ts`.

## Kiểm tra

- `pnpm lint`: đạt. Sửa tiếp có ESLint theo đúng file thay đổi, không warning.
- `pnpm typecheck`: đạt sau khi sửa icon export và kiểu unreadCount từ contract.
- `pnpm test`: 191/191 bài, 18 file.
- `pnpm build`: đạt; bản cuối được build lại trước test bổ sung.
- Playwright production hồi quy: 66/66. Bao gồm Seller 12 màn ở 390/1440, tìm/lọc xuyên trang, liên kết mở đúng đơn, báo giá → chấp nhận/thanh toán giả lập → nạp hoa, OTP, nhận hoa và các thay đổi chat/tủ trước đó.
- Impeccable detector: 6 file UI trong phạm vi lượt này, không có finding. Không kiểm tra CI GitHub.
- Test bổ sung bản trước lượt chỉnh mobile: 8/8 đạt, gồm giữ báo giá khi tải tiếp 51 trang. Bản mobile cuối có 9 ca. Lượt hồi quy cuối đạt 65/68; 3 ca mobile dùng locator getByLabel exact không tìm được label bọc select/options, dù snapshot thể hiện đúng combobox và giá trị đã chọn. Đổi locator sang getByRole(combobox, tên Trạng thái đơn), giữ nguyên các kiểm tra giá trị/hành vi; chạy lại toàn bộ 9 ca hàng đợi. Lượt chạy lại đạt 9/9. Tổng 68 ca khác nhau đã đạt qua hồi quy và các lượt chạy lại có mục tiêu; không phải một lượt 68/68.
- Đã xem bằng tài khoản Seller BE cấp ở cả desktop 1440px và điện thoại 390px: số liệu từ BE deploy, chọn Đang chuẩn bị đến đúng bộ lọc và đơn; không gửi báo giá/tin nhắn, không thanh toán hay nạp hoa thật. Ảnh lưu ngoài Git ở thư mục visualizations của phiên này: seller-workbench-desktop.png và seller-workbench-orders-mobile.png. Trong lúc sửa stylesheet, HMR dev từng mất style/báo removeChild; tải lại trang khôi phục, production build và lượt hồi quy cuối kiểm tra bản sau chỉnh responsive.

## Tinh chỉnh màu vùng công việc

- Đổi nền vùng Việc cần làm sang xanh nhạt; giữ các nhóm 0 nhẹ, nhấn xanh đậm với nhóm có yêu cầu cần shop xử lý và xanh dịu với các nhóm có đơn đang theo dõi. Nhấn màu chỉ dựa trên dữ liệu tải thành công, không dựa trên số giả hay trạng thái loading/error.
- Chỉ thêm thuộc tính trình bày data-has-items và CSS, giữ nguyên API, điều hướng và nghiệp vụ.
- ESLint file sửa và pnpm typecheck đạt. Bộ test liên quan: 6/7 đạt lượt đầu trên dev; ca chuyển trang mobile đợi route quá thời gian 5s, chạy lại nguyên test sau khi route đã ấm đạt 1/1. Kiểm tra Axe desktop/mobile, empty/error/loading đều đạt. Detector 2 file không có finding. Không chạy lại production build cho lượt màu đơn thuần này; build gần nhất thuộc bản luồng trước đó.
- Đã xem bằng BE deploy ở desktop và 390px; ảnh ngoài Git: seller-workbench-color.png. Chưa commit/push.
