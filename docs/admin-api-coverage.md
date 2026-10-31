# Đối chiếu API Admin và Web FE

Kiểm tra ngày 31/10/2026, nguồn là OpenAPI BE deploy tại https://api.florabot.site/openapi/v1.json và code FE đang làm. Có **64 tổ hợp method–path /api/admin/**.

## Phần đã bổ sung

- /admin/approvals: Trung tâm duyệt với hàng đợi shop cũ, phản ánh, hoàn tiền đơn hoa, hoàn tiền thuê kiosk, rút tiền và sự cố; phần hồ sơ thuê mới ghi rõ Manager xử lý. Lỗi tải từng hàng đợi có nút thử lại; không biến lỗi thành số 0.
- /admin/installations: Admin đọc danh sách, lọc và xem chi tiết hồ sơ thuê bằng GET /operations/kiosk-applications và GET /operations/kiosk-applications/{id}. BE cho phép Admin đọc; các thao tác xác nhận, phân công, bàn giao vẫn thuộc Manager.
- /admin/slots: xem mã ô, trạng thái, phân loại và việc gán bó hoa từ GET /admin/slots, tải khi người dùng mở; đồng bộ schema AdminSlotResponse.zone từ BE rồi sinh lại type.
- /admin/shops: phân biệt shop đã có với hồ sơ Customer đăng ký thuê mới; mặc định xem tất cả trạng thái, giữ chức năng duyệt shop PENDING theo luồng cũ.

## Cách hiểu kết quả

- Có đường đi/lời gọi FE: 50 tổ hợp method–path.
- Không gọi trực tiếp: 13 tổ hợp method–path.
- Cần BE bổ sung ID: 1 tổ hợp method–path.

Có lời gọi FE không đồng nghĩa mọi thao tác đã được nghiệm thu trên DB thật. Không phải mỗi endpoint đều cần thêm một nút mới: có API dùng qua component chung, API tương thích cũ và API điều khiển thiết bị. Không thay đổi quyền BE để Admin làm thay Manager/Technician.

## Điểm cần team BE bổ sung

GET /api/admin/kiosk-applications/{id}/refund/proof/{attachmentId} đã có, nhưng AdminKioskRefundSummary không chứa ID ảnh chứng từ; POST .../refund/confirm cũng chỉ trả { success: true }. Cần BE trả refundProofAttachmentId/proofs trong API đọc hoặc một API danh sách chứng từ theo applicationId. Khi có ID, FE mới mở được chứng từ cũ bằng quyền Admin. Không tự suy ra ID ảnh từ applicationId.

## Bằng chứng và giới hạn

- Đăng nhập Admin do BE cấp, kiểm tra các GET quản lý, hàng đợi, báo cáo và chi tiết hồ sơ thật qua FE proxy; kết quả đã kiểm tra đều HTTP 200. Hai hồ sơ hoàn tiền đã đọc trả canApprove=true, canAccessBank=false: Admin hiện có thể duyệt nhưng chưa được chi bằng chính tài khoản đó.
- Xác nhận trang Admin hiển thị dữ liệu thật; không thực hiện duyệt shop, hoàn tiền, rút tiền, tạo/khóa tài khoản, gán tủ hoặc lệnh IoT trên DB deploy trong lần kiểm tra này.
- Các payload duyệt/chi/đối soát, retry, phân quyền và responsive được kiểm tra bằng Playwright fixtures chặn API thật. Các queue rỗng trên DB deploy không chứng minh luồng ghi đã chạy thành công.
- Bộ test chung còn hai test Seller overview kỳ vọng tiêu đề trước lần team đổi UI. Đây là ngoài phần Admin, chưa sửa code Seller trong đợt này.
- Bản sửa FE Technician/đăng nhập từ lượt trước được giữ nguyên trên nhánh hiện tại; không sửa repository BE, không chạy DB local/migration.

## Kết quả kiểm tra sau sửa

- Production build, TypeScript, ESLint và 154/154 unit tests đạt.
- 51 bài browser liên quan Admin/onboarding đã đạt qua các lượt kiểm tra có mục tiêu: hàng đợi, quyền chỉ đọc, slot, shop cũ, phản ánh, hoàn tiền, rút tiền, đối soát, tài khoản và Manager. Lượt production cuối kiểm tra 6 bài gồm màn mới và hành vi đóng/mở hồ sơ nhạy cảm.
- Test hồ sơ nhạy cảm đếm 4 lượt đọc trên dev do Strict Mode; chạy đúng production đạt kỳ vọng 2 lượt. Không thay đổi logic truy cập hồ sơ để làm test qua.
- Các thao tác ghi của browser tests đều bị chặn và thay bằng fixtures. Dữ liệu BE thật chỉ dùng đăng nhập/đọc/đăng xuất trong lần rà Admin này; 28 lượt đọc đã ghi nhận đều HTTP 200.

## Danh mục đủ 64 API Admin

| Method và API                                                        | Phân loại              | Màn hình hoặc ghi chú                                                                                                |
| -------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `POST /api/admin/managers`                                           | Có đường đi/lời gọi FE | /admin/managers                                                                                                      |
| `GET /api/admin/managers`                                            | Có đường đi/lời gọi FE | /admin/managers                                                                                                      |
| `PATCH /api/admin/managers/{id}/status`                              | Có đường đi/lời gọi FE | /admin/managers                                                                                                      |
| `GET /api/admin/managers/{id}`                                       | Có đường đi/lời gọi FE | /admin/managers                                                                                                      |
| `PUT /api/admin/managers/{id}`                                       | Có đường đi/lời gọi FE | /admin/managers                                                                                                      |
| `GET /api/admin/accounts`                                            | Có đường đi/lời gọi FE | /admin/accounts                                                                                                      |
| `GET /api/admin/accounts/{userId}/profile`                           | Có đường đi/lời gọi FE | /admin/accounts                                                                                                      |
| `GET /api/admin/preorders`                                           | Có đường đi/lời gọi FE | /admin/orders                                                                                                        |
| `POST /api/admin/preorders/{requestId}/cancel`                       | Có đường đi/lời gọi FE | /admin/orders                                                                                                        |
| `GET /api/admin/sellers`                                             | Có đường đi/lời gọi FE | /admin/shops                                                                                                         |
| `GET /api/admin/kiosks`                                              | Có đường đi/lời gọi FE | /admin/slots                                                                                                         |
| `GET /api/admin/slots`                                               | Có đường đi/lời gọi FE | /admin/slots                                                                                                         |
| `GET /api/admin/reports/v_admin_queue`                               | Có đường đi/lời gọi FE | /admin/reports                                                                                                       |
| `GET /api/admin/reports/v_refund_queue`                              | Có đường đi/lời gọi FE | /admin/reports                                                                                                       |
| `GET /api/admin/reports/v_revenue_daily`                             | Có đường đi/lời gọi FE | /admin/reports                                                                                                       |
| `GET /api/admin/reports/v_platform_revenue`                          | Có đường đi/lời gọi FE | /admin/reports                                                                                                       |
| `GET /api/admin/reports/v_ai_effectiveness`                          | Có đường đi/lời gọi FE | /admin/reports                                                                                                       |
| `GET /api/admin/incidents`                                           | Có đường đi/lời gọi FE | /admin/incidents                                                                                                     |
| `GET /api/admin/incidents/{incidentId}`                              | Có đường đi/lời gọi FE | /admin/incidents                                                                                                     |
| `GET /api/admin/staff-delivery-scopes`                               | Không gọi trực tiếp    | Phạm vi giao việc cũ; phân công kỹ thuật hiện ở Manager.                                                             |
| `GET /api/admin/staff`                                               | Không gọi trực tiếp    | Danh mục nhân viên hỗ trợ luồng giao việc cũ; Admin hiện giám sát công việc.                                         |
| `GET /api/admin/staff-tasks`                                         | Có đường đi/lời gọi FE | /admin/tasks                                                                                                         |
| `POST /api/admin/staff-tasks`                                        | Không gọi trực tiếp    | Chưa mở thao tác ở màn giám sát Admin; dùng Manager/Seller theo loại công việc.                                      |
| `POST /api/admin/staff-tasks/{taskId}/transition`                    | Không gọi trực tiếp    | Màn Admin hiện chỉ giám sát; không tự thêm quyền thao tác của Manager/Technician.                                    |
| `POST /api/admin/staff-tasks/{taskId}/reassign`                      | Không gọi trực tiếp    | Phân công lại hiện do Manager/Seller phụ trách.                                                                      |
| `GET /api/admin/staff-tasks/{taskId}`                                | Có đường đi/lời gọi FE | /admin/tasks                                                                                                         |
| `GET /api/admin/staff-tasks/{taskId}/evidence`                       | Có đường đi/lời gọi FE | /admin/tasks                                                                                                         |
| `GET /api/admin/staff-tasks/{taskId}/evidence/{attachmentId}`        | Có đường đi/lời gọi FE | /admin/tasks                                                                                                         |
| `GET /api/admin/complaints`                                          | Có đường đi/lời gọi FE | /admin/complaints                                                                                                    |
| `GET /api/admin/complaints/{complaintId}`                            | Có đường đi/lời gọi FE | /admin/complaints                                                                                                    |
| `GET /api/admin/withdrawals`                                         | Có đường đi/lời gọi FE | /admin/withdrawals                                                                                                   |
| `GET /api/admin/withdrawals/{withdrawalId}`                          | Có đường đi/lời gọi FE | /admin/withdrawals                                                                                                   |
| `POST /api/admin/withdrawals/{withdrawalId}/bank-details`            | Có đường đi/lời gọi FE | /admin/withdrawals                                                                                                   |
| `GET /api/admin/refunds`                                             | Có đường đi/lời gọi FE | /admin/refunds                                                                                                       |
| `GET /api/admin/refunds/{refundId}`                                  | Có đường đi/lời gọi FE | /admin/refunds                                                                                                       |
| `POST /api/admin/refunds/{refundId}/bank-details`                    | Có đường đi/lời gọi FE | /admin/refunds                                                                                                       |
| `POST /api/admin/evidence/{purpose}/{resourceId}`                    | Có đường đi/lời gọi FE | /admin/refunds; /admin/withdrawals                                                                                   |
| `GET /api/admin/evidence/{purpose}/{resourceId}`                     | Có đường đi/lời gọi FE | /admin/refunds; /admin/withdrawals                                                                                   |
| `GET /api/admin/evidence/{attachmentId}`                             | Có đường đi/lời gọi FE | /admin/refunds; /admin/withdrawals                                                                                   |
| `GET /api/admin/kiosk-applications/refunds`                          | Có đường đi/lời gọi FE | /admin/kiosk-refunds                                                                                                 |
| `POST /api/admin/kiosk-applications/{id}/refund/bank-details`        | Có đường đi/lời gọi FE | /admin/kiosk-refunds                                                                                                 |
| `POST /api/admin/kiosk-applications/{id}/refund/evidence/upload`     | Có đường đi/lời gọi FE | /admin/kiosk-refunds                                                                                                 |
| `GET /api/admin/kiosk-applications/{id}/refund/proof/{attachmentId}` | Cần BE bổ sung ID      | API tồn tại nhưng queue không trả attachmentId; confirm chỉ trả success. Chưa đủ dữ liệu để tạo link xem lại.        |
| `POST /api/admin/kiosk-applications/{id}/refund/approve`             | Có đường đi/lời gọi FE | /admin/kiosk-refunds                                                                                                 |
| `POST /api/admin/kiosk-applications/{id}/refund/confirm`             | Có đường đi/lời gọi FE | /admin/kiosk-refunds                                                                                                 |
| `POST /api/admin/flows/approve_seller`                               | Có đường đi/lời gọi FE | /admin/shops                                                                                                         |
| `POST /api/admin/flows/set_seller_status`                            | Không gọi trực tiếp    | UI quản lý trạng thái shop hiện dùng /operations/sellers/{sellerId}/status.                                          |
| `POST /api/admin/flows/assign_kiosk`                                 | Có đường đi/lời gọi FE | /admin/slots                                                                                                         |
| `POST /api/admin/flows/admin_dispose_slot`                           | Không gọi trực tiếp    | Chưa có nút Web cho thao tác thiết bị này; không đưa thành nút duyệt tài chính/hồ sơ. IoT thật chưa được nghiệm thu. |
| `POST /api/admin/flows/resolve_device_fault`                         | Có đường đi/lời gọi FE | /admin/incidents                                                                                                     |
| `POST /api/admin/flows/set_kiosk_status`                             | Không gọi trực tiếp    | Chưa có nút Web cho thao tác thiết bị này; không đưa thành nút duyệt tài chính/hồ sơ. IoT thật chưa được nghiệm thu. |
| `POST /api/admin/flows/admin_close_door`                             | Không gọi trực tiếp    | Chưa có nút Web cho thao tác thiết bị này; không đưa thành nút duyệt tài chính/hồ sơ. IoT thật chưa được nghiệm thu. |
| `POST /api/admin/flows/set_cfg`                                      | Không gọi trực tiếp    | Chưa có nút Web cho thao tác thiết bị này; không đưa thành nút duyệt tài chính/hồ sơ. IoT thật chưa được nghiệm thu. |
| `POST /api/admin/flows/resolve_dispute`                              | Có đường đi/lời gọi FE | /admin/complaints                                                                                                    |
| `POST /api/admin/flows/approve_withdrawal`                           | Có đường đi/lời gọi FE | /admin/withdrawals                                                                                                   |
| `POST /api/admin/flows/pay_withdrawal`                               | Có đường đi/lời gọi FE | /admin/withdrawals                                                                                                   |
| `POST /api/admin/flows/reject_withdrawal`                            | Có đường đi/lời gọi FE | /admin/withdrawals                                                                                                   |
| `POST /api/admin/flows/admin_refund`                                 | Không gọi trực tiếp    | Luồng Web dùng xử lý phản ánh → duyệt hoàn → xác nhận chi, không mở thêm đường hoàn tiền song song.                  |
| `POST /api/admin/flows/create_refund`                                | Không gọi trực tiếp    | Luồng Web tạo khoản hoàn từ xử lý phản ánh; chưa có form tạo khoản hoàn độc lập.                                     |
| `POST /api/admin/flows/approve_refund`                               | Có đường đi/lời gọi FE | /admin/refunds                                                                                                       |
| `POST /api/admin/flows/confirm_refund`                               | Có đường đi/lời gọi FE | /admin/refunds                                                                                                       |
| `POST /api/admin/flows/reconcile_gateway`                            | Có đường đi/lời gọi FE | /admin/reconciliation                                                                                                |
| `POST /api/admin/flows/reconcile_daily`                              | Có đường đi/lời gọi FE | /admin/reconciliation                                                                                                |
| `POST /api/admin/flows/attach`                                       | Không gọi trực tiếp    | UI dùng API tải chứng từ có scope /admin/evidence/{purpose}/{resourceId}.                                            |
