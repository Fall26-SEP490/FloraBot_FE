# Kiểm chứng FE/API và kiosk UI — 16/10/2026

## Phạm vi đã thực hiện

- Rà OpenAPI BE đang chạy tại commit `2733ce2`: 213 tổ hợp method–path; danh mục và ánh xạ màn hình trong [backend-api-and-frontend.md](backend-api-and-frontend.md). Không thay source BE hoặc quyền hiện có.
- Cải thiện luồng khách → shop → khách xác nhận/thanh toán → shop ghi nhận hoa tại tủ → admin xem báo cáo: tiến độ dựa trên trạng thái API, hướng dẫn bước tiếp theo, lọc/số lượng có ghi phạm vi trang hiện tại.
- Kết quả ghi không rõ được khóa bằng marker theo đơn trong sessionStorage, kể cả sau reload. Chỉ lần đọc thành công do người dùng yêu cầu mới mở lại thao tác; đây là guard UI, không thay thế idempotency/transition của BE.
- Mọi sản phẩm catalog mẫu đều chỉ xem; không tạo đơn hoặc chat bằng UUID minh họa. Mất phản hồi lúc tạo yêu cầu giữ cùng request ID/payload để gửi lại an toàn theo hợp đồng BE.
- `/admin/reports` đọc 4 API báo cáo thật. Giới hạn backend 100 dòng được thông báo, phân trang UI 20 dòng; không suy ra tổng hệ thống từ dữ liệu bị giới hạn.
- Repo `FloraBot_Kios` có UI preview mới: giỏ/message, màn thanh toán, nhập mã và mô hình ô tủ. Sample là mặc định khi chưa có device; `?preview=1` bỏ qua cả device session đã lưu. Chỉ GET công khai khi người dùng chọn nguồn API.
- FE proxy `/kiosk/*` sang kiosk cổng 5174. Root `/kiosk` được ánh xạ riêng vào index.html để tránh Next.js bỏ dấu slash cuối rồi làm Vite trả 404.

## Kết quả kiểm tra

| Kiểm tra                                | Kết quả                                                                                                     |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| FE TypeScript                           | Pass                                                                                                        |
| FE ESLint toàn repo                     | Pass                                                                                                        |
| FE unit                                 | 52/52 pass                                                                                                  |
| FE build production                     | Pass; build lại sau sửa proxy cũng pass                                                                     |
| FE browser theo luồng + member preorder | 11/11 pass                                                                                                  |
| Kiosk TypeScript, ESLint toàn repo      | Pass                                                                                                        |
| Kiosk build                             | Pass ở base `/` cho regression và `/kiosk/` để tích hợp                                                     |
| Kiosk browser regression + preview      | 35/35 pass                                                                                                  |
| Axe/reflow                              | Các case mới ở 390/1440 FE, 390/1200 kiosk pass; đã xem PNG desktop/mobile                                  |
| Runtime thật                            | `/`, `/dat-hoa`, `/dang-nhap`, `/admin/reports`, `/kiosk/?preview=1`, BE health và public catalog: HTTP 200 |
| Quyền API thật                          | Member preorders, admin queue report, account profile đều HTTP 401 khi chưa đăng nhập                       |
| Preview runtime thật                    | 0 request thiết bị, 0 business write; API không mock                                                        |

Browser tests chạy bằng Chrome cài sẵn qua config local ignored trong artifacts. Lần chạy đầu không khởi chạy được vì chưa có Chromium v1243; download CDN timeout. Không sửa test gate hoặc hạ assertion để xử lý việc này. Cảnh báo Rollup về annotation Zod và bundle >500 kB còn xuất hiện khi build kiosk; build hoàn tất, không đổi threshold.

## Bằng chứng và giới hạn

Browser hành trình kinh doanh dùng fixture HTTP có state và kiểm tra payload. Chuyển `PAID` trong fixture biểu diễn thanh toán đã xác minh; không phải giao dịch payOS thật. Backend runtime smoke đọc API thật, không tạo user/đơn, không đổi mật khẩu và không reset database. Catalog runtime trả 0 dòng đủ điều kiện vào thời điểm kiểm tra, được hiển thị đúng thay vì seed dữ liệu vào database.

Ảnh kiểm tra ở `FE/artifacts/connected-orders-{390,1440}.png`, `FE/artifacts/live-kiosk-preview.png`, `Kios/artifacts/kiosk-preview-{390,1200}.png`. JSON smoke ở `FE/artifacts/connected-runtime-smoke.json`. Artifacts là file local ignored. Screenshot dashboard dùng tài khoản/dữ liệu fixture, không phải số liệu hoạt động.

Không có IoT thật: chưa kiểm chứng relay/cảm biến, mở cửa hay nhận hoa vật lý. Preview không có QR thanh toán thật, không gửi checkout/payment-link/device_event/request_pickup và không báo thành công phần cứng. Các tích hợp payOS/Cloudinary/email/Google thật vẫn phụ thuộc cấu hình và nghiệm thu riêng. Automated accessibility không thay thế đánh giá screen reader/WCAG đầy đủ.

Thay đổi nằm trên nhánh `codex/api-connected-kiosk-preview` của FE và `codex/kiosk-ui-preview` của Kios. Bản sửa dependency Tailwind local trước đó được giữ nguyên.

## Rà soát giao diện danh mục hoa

- Nền trắng của `.preorder-story` có từ commit `21a97a66` ngày 08/10/2026 (`landing.css`, dòng 1492); giữ nguyên nền này và họa tiết hoa của trang.
- Nhãn tìm kiếm dùng nhầm class chưa có CSS (`visually-hidden`), nay dùng `sr-only`. Ô nhập và nút cao 48px, thẳng hàng trên desktop/tablet, xếp dọc trên điện thoại.
- Bộ lọc cuộn theo tài liệu, bỏ sticky và thanh cuộn riêng; nhãn dài được xuống dòng. Mobile có nút xem kết quả, đóng bằng Escape và trả focus về nút mở.
- Thẻ hoa, nút và danh mục co giãn ở 320/390/820/1440px; nút thao tác tối thiểu 44px. Thêm nền sáng cho vùng kết quả để dễ đọc trên họa tiết hoa, bỏ biểu tượng giả nút đổi chế độ xem.
- Bộ đếm dịp tặng dùng cùng điều kiện với kết quả (metadata/tag/mô tả); khoảng giá trên 600.000đ không chứa lại mốc 600.000đ. Chi tiết hoa khóa cuộn nền khi mở và khôi phục khi đóng.
- Kiểm tra lại: build, lint, TypeScript, 52 unit test và 19 browser test đều pass. Có 8 case bố cục/bộ lọc/chi tiết mới, gồm Axe và đo hình học, cộng 11 case luồng đặt hoa/member đã có.
- Ảnh local: `artifacts/catalog-live-{1440,390}.png`; browser fixture: `artifacts/catalog-after-{320,390,820,1440}.png`. Runtime thật trả HTTP 200 cho trang hoa và GET catalog, không tạo đơn.
