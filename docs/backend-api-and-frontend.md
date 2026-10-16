# Backend API và giao diện FloraBot

Kiểm tra ngày 16/10/2026. Nguồn: OpenAPI xuất từ API local và code BE tại commit 2733ce2. Có **213 tổ hợp method–path**, không tính SignalR. Đây là danh mục khả năng backend, không phải tuyên bố tất cả luồng đã được nghiệm thu với provider/phần cứng thật.

## Code BE đã có

ASP.NET Core .NET 10 modular monolith: Identity, Catalog, KioskOps, Ordering, Payment, Notify và Ai. Các hàm SQL flow.* giữ chuyển trạng thái nghiệp vụ; API kiểm tra phiên, tenant/tài nguyên và payload. YARP là gateway; CAP/RabbitMQ phục vụ outbox, Valkey phục vụ phiên/OTP/cache, SignalR invalidation/chat và MQTT phục vụ thiết bị khi được cấu hình.

## Đối chiếu luồng API với FE

| Luồng                         | API chính                                                                             | Màn FE và trạng thái kết nối                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Đăng ký/xác thực              | /auth/register, /auth/register/verify, /auth/login, /auth/google                      | /dang-ky, /dang-nhap, /admin/login; cookie phiên; Google/email thật phụ thuộc cấu hình                       |
| Hồ sơ                         | /account/profile, /account/contact-email                                              | /ho-so; dữ liệu tài khoản thật; ngân hàng cá nhân tách ví shop                                               |
| Danh mục                      | GET /shop/catalog                                                                     | /dat-hoa; tìm kiếm/phân trang API; dữ liệu mẫu được gắn cờ và chặn tạo đơn/chat                              |
| Đặt mẫu hoặc bó có sẵn        | POST /member/preorders                                                                | /dat-hoa; ID yêu cầu giữ nguyên khi kết quả mạng chưa rõ                                                     |
| Shop phản hồi                 | /sellers/{sellerId}/preorders, /quote, /fulfill, /cancel                              | /seller/orders; báo giá, nạp đúng tủ, đọc lại trạng thái; không coi nạp hoa là mở cửa                        |
| Khách chốt báo giá/thanh toán | /member/preorders, /accept, /payment-link                                             | /tai-khoan#web-orders; giá/lịch snapshot; chỉ mở URL pay.payos.vn; backend xác minh tiền                     |
| Chat                          | /member/chats, /sellers/{sellerId}/chats, /chats/{chatId}/messages                    | Tab tin nhắn khách và /seller/chats; SignalR /hub/chat, REST là nguồn dữ liệu                                |
| Tồn kho, sản phẩm và ảnh      | /sellers/{sellerId}/products, /slots, /photos, flows/stock_bouquet                    | /seller/products, /seller/stock; Cloudinary ảnh thật phụ thuộc credentials                                   |
| Giao việc                     | /staff/tasks, /operations/staff-tasks, /sellers/{sellerId}/staff-tasks                | /staff, /technician, /operations, /seller/tasks; scope theo người/tenant/tủ                                  |
| Thuê/lắp đặt kiosk            | /kiosk-packages, /member/kiosk-applications, /operations/kiosk-applications           | /thue-kiosk, /operations/installations, /technician/installations; chỉ bàn giao hợp lệ mới lên Seller        |
| Đội ngũ                       | /admin/managers, /operations/technicians, /sellers/{sellerId}/staff/accounts          | Các route quản lý tài khoản đã nối API; không dùng bảng minh họa để thay dữ liệu thật                        |
| Tiền và biên nhận             | /wallet, /withdrawals, /refunds, /receipts/lookup                                     | /seller/wallet, /admin/withdrawals, /admin/refunds, /receipt; chuyển khoản ngoài app và hai admin theo flow  |
| Báo cáo                       | /admin/reports/v_admin_queue, v_revenue_daily, v_platform_revenue, v_ai_effectiveness | /admin/reports; đọc thật; tối đa 100 dòng/API; phân trang UI 20 dòng, không suy ra tổng hệ thống             |
| Kiosk xem trước               | GET công khai /shop/catalog và /kiosks khi chọn chế độ API                            | /kiosk/?preview=1; mẫu mặc định được ghi rõ; chỉ đọc và chuyển màn cục bộ; không cần khóa thiết bị           |
| IoT                           | /kiosks/{id}/flows/device_event, kiosk_heartbeat, request_pickup; MQTT                | Chưa có phần cứng thật. Preview không gọi các API này hoặc checkout/payment; không giả lập thành công vật lý |

## Cấu hình chạy local

- API: http://127.0.0.1:5080; FE: http://localhost:8088.
- Kiosk chạy với VITE_BASE_PATH=/kiosk/ tại cổng 5174. FE proxy /kiosk/* qua KIOSK_PROXY_TARGET (mặc định http://127.0.0.1:5174).
- Kiosk VITE_WEB_URL=http://localhost:8088; API_PROXY_TARGET=http://127.0.0.1:5080.
- Không đổi hoặc nới quyền BE để hiển thị dữ liệu trống. Không cấu hình API key thiết bị vào FE website.
- Xem lại inventory: node tools/export-api-inventory.mjs artifacts/live-openapi.json.

## Bằng chứng và giới hạn

Unit test kiểm tra state/progress; browser fixtures kiểm tra khách → shop → khách → shop → admin, lỗi mạng/khóa gửi lại, catalog mẫu và reflow/axe. Những fixture này không xác nhận giao dịch payOS thật. Kiosk tests xác nhận không có POST/khóa thiết bị trong preview, kể cả khi trước đó đã có phiên thiết bị. HTTP smoke qua FE/API local kiểm tra endpoint thật và phản hồi dữ liệu/401 đúng quyền; không tạo dữ liệu kinh doanh hoặc reset database.

API có thể tồn tại mà chưa có nút UI trực tiếp: webhook nhà cung cấp, sự kiện thiết bị, thao tác đặc quyền và SQL flows nội bộ phải giữ đúng kênh/quyền, không đưa mọi endpoint thành nút công khai.

## Danh mục đầy đủ từ OpenAPI

| Method | Path                                                                   | Nhóm OpenAPI         |
| ------ | ---------------------------------------------------------------------- | -------------------- |
| GET    | `/health`                                                              | FloraBot.Api         |
| GET    | `/api/auth/config`                                                     | Auth                 |
| POST   | `/api/auth/google`                                                     | Auth                 |
| POST   | `/api/auth/login`                                                      | Auth                 |
| POST   | `/api/auth/admin/login`                                                | Auth                 |
| POST   | `/api/auth/refresh`                                                    | Auth                 |
| POST   | `/api/auth/logout`                                                     | Auth                 |
| GET    | `/api/auth/me`                                                         | Auth                 |
| POST   | `/api/admin/managers`                                                  | Identity             |
| GET    | `/api/admin/managers`                                                  | Identity             |
| PATCH  | `/api/admin/managers/{id}/status`                                      | Identity             |
| POST   | `/api/operations/technicians`                                          | Identity             |
| GET    | `/api/operations/technicians`                                          | Identity             |
| PATCH  | `/api/operations/technicians/{id}/status`                              | Identity             |
| POST   | `/api/sellers/{sellerId}/staff`                                        | Identity             |
| GET    | `/api/sellers/{sellerId}/staff`                                        | FloraBot.Api         |
| GET    | `/api/sellers/{sellerId}/staff/accounts`                               | Identity             |
| PATCH  | `/api/sellers/{sellerId}/staff/{staffId}/status`                       | Identity             |
| GET    | `/api/account/profile`                                                 | Account              |
| PUT    | `/api/account/profile`                                                 | Account              |
| POST   | `/api/account/profile/bank/reveal`                                     | Account              |
| POST   | `/api/account/contact-email`                                           | Account              |
| POST   | `/api/account/contact-email/verify`                                    | Account              |
| POST   | `/api/account/contact-email/reset`                                     | Account              |
| POST   | `/api/auth/register`                                                   | Auth                 |
| POST   | `/api/auth/register/verify`                                            | Auth                 |
| POST   | `/api/member/google/link`                                              | Auth                 |
| GET    | `/api/member/profile`                                                  | FloraBot.Api         |
| POST   | `/api/member/profile`                                                  | FloraBot.Api         |
| POST   | `/api/member/password`                                                 | FloraBot.Api         |
| POST   | `/api/auth/forgot-password`                                            | FloraBot.Api         |
| POST   | `/api/auth/reset-password`                                             | FloraBot.Api         |
| GET    | `/api/member/preorders`                                                | FloraBot.Api         |
| POST   | `/api/member/preorders`                                                | FloraBot.Api         |
| GET    | `/api/sellers/{sellerId}/preorders`                                    | FloraBot.Api         |
| GET    | `/api/admin/preorders`                                                 | FloraBot.Api         |
| POST   | `/api/member/preorders/{requestId}/accept`                             | FloraBot.Api         |
| POST   | `/api/member/preorders/{requestId}/cancel`                             | FloraBot.Api         |
| POST   | `/api/sellers/{sellerId}/preorders/{requestId}/cancel`                 | FloraBot.Api         |
| POST   | `/api/admin/preorders/{requestId}/cancel`                              | FloraBot.Api         |
| POST   | `/api/sellers/{sellerId}/preorders/{requestId}/quote`                  | FloraBot.Api         |
| POST   | `/api/sellers/{sellerId}/preorders/{requestId}/fulfill`                | FloraBot.Api         |
| POST   | `/api/member/chats/open`                                               | Customer Seller Chat |
| GET    | `/api/member/chats`                                                    | Customer Seller Chat |
| GET    | `/api/sellers/{sellerId}/chats`                                        | Customer Seller Chat |
| GET    | `/api/chats/{chatId}/messages`                                         | Customer Seller Chat |
| POST   | `/api/chats/{chatId}/messages`                                         | Customer Seller Chat |
| POST   | `/api/chats/{chatId}/read`                                             | Customer Seller Chat |
| POST   | `/api/chats/{chatId}/images`                                           | Customer Seller Chat |
| GET    | `/api/chats/{chatId}/messages/{messageId}/image`                       | Customer Seller Chat |
| POST   | `/api/member/preorders/{requestId}/payment-link`                       | FloraBot.Api         |
| GET    | `/api/shop/catalog`                                                    | FloraBot.Api         |
| POST   | `/api/kiosks/{kioskId}/otp/request`                                    | Auth                 |
| POST   | `/api/kiosks/{kioskId}/otp/verify`                                     | Auth                 |
| GET    | `/api/packages`                                                        | FloraBot.Api         |
| GET    | `/api/sellers/{sellerId}`                                              | FloraBot.Api         |
| GET    | `/api/sellers/{sellerId}/subscriptions`                                | FloraBot.Api         |
| GET    | `/api/admin/sellers`                                                   | FloraBot.Api         |
| GET    | `/api/sellers/{sellerId}/products`                                     | FloraBot.Api         |
| POST   | `/api/sellers/{sellerId}/products`                                     | Catalog              |
| GET    | `/api/kiosks`                                                          | FloraBot.Api         |
| GET    | `/api/sellers/{sellerId}/slots`                                        | FloraBot.Api         |
| GET    | `/api/admin/slots`                                                     | FloraBot.Api         |
| GET    | `/api/admin/reports/v_admin_queue`                                     | FloraBot.Api         |
| GET    | `/api/admin/reports/v_refund_queue`                                    | FloraBot.Api         |
| GET    | `/api/admin/reports/v_revenue_daily`                                   | FloraBot.Api         |
| GET    | `/api/admin/reports/v_platform_revenue`                                | FloraBot.Api         |
| GET    | `/api/admin/reports/v_ai_effectiveness`                                | FloraBot.Api         |
| GET    | `/api/kiosks/{kioskId}/catalog`                                        | FloraBot.Api         |
| GET    | `/api/kiosks/{kioskId}/catalog/items`                                  | FloraBot.Api         |
| GET    | `/api/sellers/{sellerId}/wallet`                                       | FloraBot.Api         |
| GET    | `/api/sellers/{sellerId}/bank`                                         | FloraBot.Api         |
| GET    | `/api/admin/incidents`                                                 | FloraBot.Api         |
| GET    | `/api/operations/incidents`                                            | FloraBot.Api         |
| GET    | `/api/admin/incidents/{incidentId}`                                    | FloraBot.Api         |
| GET    | `/api/admin/staff-delivery-scopes`                                     | FloraBot.Api         |
| GET    | `/api/sellers/{sellerId}/staff-delivery-scopes`                        | FloraBot.Api         |
| GET    | `/api/admin/staff`                                                     | FloraBot.Api         |
| GET    | `/api/operations/staff`                                                | FloraBot.Api         |
| GET    | `/api/admin/staff-tasks`                                               | FloraBot.Api         |
| POST   | `/api/admin/staff-tasks`                                               | FloraBot.Api         |
| GET    | `/api/operations/staff-tasks`                                          | FloraBot.Api         |
| POST   | `/api/operations/staff-tasks`                                          | FloraBot.Api         |
| GET    | `/api/sellers/{sellerId}/staff-tasks`                                  | FloraBot.Api         |
| POST   | `/api/sellers/{sellerId}/staff-tasks`                                  | FloraBot.Api         |
| GET    | `/api/staff/tasks`                                                     | FloraBot.Api         |
| POST   | `/api/staff/tasks/{taskId}/transition`                                 | StaffTasks           |
| POST   | `/api/admin/staff-tasks/{taskId}/transition`                           | StaffTasks           |
| POST   | `/api/operations/staff-tasks/{taskId}/transition`                      | StaffTasks           |
| POST   | `/api/sellers/{sellerId}/staff-tasks/{taskId}/transition`              | StaffTasks           |
| POST   | `/api/admin/staff-tasks/{taskId}/reassign`                             | FloraBot.Api         |
| POST   | `/api/operations/staff-tasks/{taskId}/reassign`                        | FloraBot.Api         |
| POST   | `/api/sellers/{sellerId}/staff-tasks/{taskId}/reassign`                | FloraBot.Api         |
| GET    | `/api/staff/tasks/{taskId}/stock`                                      | StaffStock           |
| POST   | `/api/staff/tasks/{taskId}/stock`                                      | FloraBot.Api         |
| GET    | `/api/staff/tasks/{taskId}`                                            | StaffTaskDetails     |
| GET    | `/api/admin/staff-tasks/{taskId}`                                      | StaffTaskDetails     |
| GET    | `/api/operations/staff-tasks/{taskId}`                                 | StaffTaskDetails     |
| GET    | `/api/sellers/{sellerId}/staff-tasks/{taskId}`                         | StaffTaskDetails     |
| POST   | `/api/staff/tasks/{taskId}/evidence/upload`                            | FloraBot.Api         |
| POST   | `/api/staff/tasks/{taskId}/evidence`                                   | FloraBot.Api         |
| GET    | `/api/staff/tasks/{taskId}/evidence`                                   | StaffEvidence        |
| GET    | `/api/staff/tasks/{taskId}/evidence/{attachmentId}`                    | StaffEvidence        |
| GET    | `/api/admin/staff-tasks/{taskId}/evidence`                             | StaffEvidence        |
| GET    | `/api/admin/staff-tasks/{taskId}/evidence/{attachmentId}`              | StaffEvidence        |
| GET    | `/api/operations/staff-tasks/{taskId}/evidence`                        | StaffEvidence        |
| GET    | `/api/operations/staff-tasks/{taskId}/evidence/{attachmentId}`         | StaffEvidence        |
| GET    | `/api/sellers/{sellerId}/staff-tasks/{taskId}/evidence`                | StaffEvidence        |
| GET    | `/api/sellers/{sellerId}/staff-tasks/{taskId}/evidence/{attachmentId}` | StaffEvidence        |
| POST   | `/api/staff/tasks/{taskId}/resolve-incident`                           | FloraBot.Api         |
| GET    | `/api/admin/complaints`                                                | FloraBot.Api         |
| GET    | `/api/admin/complaints/{complaintId}`                                  | FloraBot.Api         |
| GET    | `/api/admin/withdrawals`                                               | FloraBot.Api         |
| GET    | `/api/admin/withdrawals/{withdrawalId}`                                | FloraBot.Api         |
| POST   | `/api/admin/withdrawals/{withdrawalId}/bank-details`                   | FloraBot.Api         |
| GET    | `/api/admin/refunds`                                                   | FloraBot.Api         |
| GET    | `/api/admin/refunds/{refundId}`                                        | FloraBot.Api         |
| POST   | `/api/admin/refunds/{refundId}/bank-details`                           | FloraBot.Api         |
| POST   | `/api/receipts/lookup`                                                 | FloraBot.Api         |
| GET    | `/api/kiosks/{kioskId}/customer/history`                               | FloraBot.Api         |
| GET    | `/api/member/history`                                                  | CustomerHistory      |
| GET    | `/api/kiosks/{kioskId}/customer/points`                                | FloraBot.Api         |
| GET    | `/api/kiosks/{kioskId}/catalog/accessories`                            | KioskOps             |
| GET    | `/api/sellers/{sellerId}/accessories`                                  | KioskOps             |
| GET    | `/api/kiosk-locations`                                                 | KioskOps             |
| GET    | `/api/sellers/{sellerId}/kiosks`                                       | KioskOps             |
| PUT    | `/api/sellers/{sellerId}/kiosks/{kioskId}/location`                    | KioskOps             |
| GET    | `/api/sellers/{sellerId}/products/{productId}/photos`                  | Catalog              |
| POST   | `/api/sellers/{sellerId}/products/{productId}/photos`                  | Catalog              |
| PUT    | `/api/sellers/{sellerId}/products/{productId}`                         | Catalog              |
| POST   | `/api/admin/evidence/{purpose}/{resourceId}`                           | FloraBot.Api         |
| GET    | `/api/admin/evidence/{purpose}/{resourceId}`                           | FloraBot.Api         |
| POST   | `/api/sellers/{sellerId}/slots/{slotId}/evidence/{purpose}`            | FloraBot.Api         |
| POST   | `/api/receipts/{orderId}/evidence`                                     | FloraBot.Api         |
| GET    | `/api/admin/evidence/{attachmentId}`                                   | FloraBot.Api         |
| POST   | `/api/member/shop`                                                     | Identity             |
| POST   | `/api/sellers`                                                         | Identity             |
| GET    | `/api/kiosk-packages`                                                  | Identity             |
| POST   | `/api/member/kiosk-applications`                                       | KioskOnboarding      |
| GET    | `/api/member/kiosk-applications/current`                               | KioskOnboarding      |
| POST   | `/api/member/kiosk-applications/{id}/payment-link`                     | KioskOnboarding      |
| POST   | `/api/member/kiosk-applications/{id}/cancel`                           | KioskOnboarding      |
| POST   | `/api/member/kiosk-applications/{id}/reconcile`                        | KioskOnboarding      |
| GET    | `/api/operations/kiosk-applications`                                   | KioskOnboarding      |
| GET    | `/api/operations/kiosk-applications/{id}`                              | KioskOnboarding      |
| POST   | `/api/operations/kiosk-applications/{id}/confirm`                      | KioskOnboarding      |
| POST   | `/api/operations/kiosk-applications/{id}/schedule`                     | KioskOnboarding      |
| POST   | `/api/operations/kiosk-applications/{id}/rework`                       | KioskOnboarding      |
| POST   | `/api/operations/kiosk-applications/{id}/handover`                     | KioskOnboarding      |
| POST   | `/api/operations/kiosk-applications/{id}/reject`                       | KioskOnboarding      |
| POST   | `/api/operations/kiosk-applications/{id}/platform-failure`             | KioskOnboarding      |
| GET    | `/api/operations/eligible-kiosks`                                      | KioskOnboarding      |
| POST   | `/api/operations/kiosks/enroll`                                        | KioskOnboarding      |
| POST   | `/api/operations/kiosks/{id}/provision-key`                            | KioskOnboarding      |
| GET    | `/api/staff/kiosk-installations`                                       | KioskOnboarding      |
| GET    | `/api/staff/kiosk-installations/{id}`                                  | KioskOnboarding      |
| POST   | `/api/staff/kiosk-installations/{id}/start`                            | KioskOnboarding      |
| POST   | `/api/staff/kiosk-installations/{id}/evidence/upload`                  | FloraBot.Api         |
| POST   | `/api/staff/kiosk-installations/{id}/evidence`                         | KioskOnboarding      |
| GET    | `/api/staff/kiosk-installations/{id}/evidence`                         | KioskOnboarding      |
| GET    | `/api/staff/kiosk-installations/{id}/evidence/{attachmentId}`          | KioskOnboarding      |
| GET    | `/api/operations/kiosk-applications/{id}/evidence/{attachmentId}`      | KioskOnboarding      |
| POST   | `/api/staff/kiosk-installations/{id}/submit`                           | KioskOnboarding      |
| GET    | `/api/admin/kiosk-applications/refunds`                                | KioskOnboarding      |
| POST   | `/api/admin/kiosk-applications/{id}/refund/bank-details`               | KioskOnboarding      |
| POST   | `/api/admin/kiosk-applications/{id}/refund/evidence/upload`            | FloraBot.Api         |
| GET    | `/api/admin/kiosk-applications/{id}/refund/proof/{attachmentId}`       | KioskOnboarding      |
| POST   | `/api/admin/kiosk-applications/{id}/refund/approve`                    | KioskOnboarding      |
| POST   | `/api/admin/kiosk-applications/{id}/refund/confirm`                    | KioskOnboarding      |
| POST   | `/api/payments/webhook`                                                | Payment              |
| POST   | `/api/sellers/{sellerId}/subscriptions/{subscriptionId}/payment-link`  | Payment              |
| GET    | `/api/kiosks/{kioskId}/checkouts/{checkoutId}`                         | Payment              |
| POST   | `/api/kiosks/{kioskId}/checkouts/{checkoutId}/payment-link`            | Payment              |
| GET    | `/api/kiosks/{kioskId}/surveys/{surveyId}`                             | Ai                   |
| POST   | `/api/sellers/{sellerId}/flows/set_seller_bank`                        | Identity             |
| POST   | `/api/sellers/{sellerId}/flows/set_seller_tone`                        | Identity             |
| POST   | `/api/sellers/{sellerId}/flows/subscribe`                              | Identity             |
| POST   | `/api/admin/flows/approve_seller`                                      | Identity             |
| POST   | `/api/admin/flows/set_seller_status`                                   | Identity             |
| POST   | `/api/kiosks/{kioskId}/flows/forget_customer`                          | Identity             |
| POST   | `/api/sellers/{sellerId}/flows/set_product_status`                     | Catalog              |
| POST   | `/api/sellers/{sellerId}/flows/update_product_price`                   | Catalog              |
| POST   | `/api/sellers/{sellerId}/flows/add_product_photo`                      | Catalog              |
| POST   | `/api/sellers/{sellerId}/flows/restock_accessory`                      | Catalog              |
| POST   | `/api/sellers/{sellerId}/flows/release_slot`                           | KioskOps             |
| POST   | `/api/sellers/{sellerId}/flows/stock_bouquet`                          | KioskOps             |
| POST   | `/api/sellers/{sellerId}/flows/return_to_seller`                       | KioskOps             |
| POST   | `/api/sellers/{sellerId}/flows/report_device_fault`                    | KioskOps             |
| POST   | `/api/admin/flows/assign_slot`                                         | KioskOps             |
| POST   | `/api/admin/flows/admin_dispose_slot`                                  | KioskOps             |
| POST   | `/api/admin/flows/resolve_device_fault`                                | KioskOps             |
| POST   | `/api/admin/flows/set_kiosk_status`                                    | KioskOps             |
| POST   | `/api/admin/flows/admin_close_door`                                    | KioskOps             |
| POST   | `/api/admin/flows/set_cfg`                                             | KioskOps             |
| POST   | `/api/kiosks/{kioskId}/flows/kiosk_heartbeat`                          | KioskOps             |
| POST   | `/api/kiosks/{kioskId}/flows/device_event`                             | KioskOps             |
| POST   | `/api/kiosks/{kioskId}/flows/kiosk_checkout`                           | Ordering             |
| POST   | `/api/kiosks/{kioskId}/flows/request_pickup`                           | Ordering             |
| POST   | `/api/receipts/flows/open_dispute`                                     | Ordering             |
| POST   | `/api/receipts/flows/submit_refund_info`                               | Ordering             |
| POST   | `/api/admin/flows/resolve_dispute`                                     | Ordering             |
| POST   | `/api/sellers/{sellerId}/flows/request_withdrawal`                     | Payment              |
| POST   | `/api/admin/flows/approve_withdrawal`                                  | Payment              |
| POST   | `/api/admin/flows/pay_withdrawal`                                      | Payment              |
| POST   | `/api/admin/flows/reject_withdrawal`                                   | Payment              |
| POST   | `/api/admin/flows/admin_refund`                                        | Payment              |
| POST   | `/api/admin/flows/create_refund`                                       | Payment              |
| POST   | `/api/admin/flows/approve_refund`                                      | Payment              |
| POST   | `/api/admin/flows/confirm_refund`                                      | Payment              |
| POST   | `/api/admin/flows/reconcile_gateway`                                   | Payment              |
| POST   | `/api/admin/flows/reconcile_daily`                                     | Payment              |
| POST   | `/api/admin/flows/attach`                                              | Notify               |
| POST   | `/api/kiosks/{kioskId}/flows/ai_suggest`                               | Ai                   |
