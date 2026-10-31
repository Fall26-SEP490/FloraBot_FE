Method: dual-agent (A: /root/admin_design_review · B: /root/admin_evidence_review)

# Đánh giá UX Admin FloraBot — trước chỉnh sửa

Mode: Operate. Target: apps/web/src/features/portal/role-workspaces/AdminWorkspace.tsx.
Live: /admin, /admin/approvals; A xem thêm /admin/refunds và /admin/tasks.

## Nhận định

Nhận diện xanh rừng/trắng và typography tiếng Việt thống nhất. Cấu trúc hero, biểu tượng khiên và ba bước chung chưa giúp vận hành tủ hoa: việc cần quyết định phải là nội dung chính. Không thay bộ nhận diện; cải thiện thứ tự thông tin và cách thao tác.

## Nielsen: 25/40

| Tiêu chí            | Điểm /4 | Nhận xét                                                     |
| ------------------- | ------: | ------------------------------------------------------------ |
| Trạng thái hệ thống |       3 | Loading/retry độc lập; freshness queue cần rõ hơn.           |
| Ngôn ngữ người dùng |       2 | Vai trò tiếng Anh, luồng cũ, nhãn báo cáo gây hiểu sai.      |
| Kiểm soát và tự do  |       3 | Có lọc, hủy và quay lại; không thử mutations thật.           |
| Nhất quán           |       2 | Báo cáo chờ duyệt dẫn đến trang Admin chỉ giám sát.          |
| Ngăn lỗi            |       3 | Hoàn tiền tách hai Admin, kiểm tra chứng từ.                 |
| Nhận biết           |       3 | Active nav và icon có nhãn; thiếu dấu mở chi tiết hoàn tiền. |
| Hiệu suất           |       2 | 16 mục nav, 7 queue và phải cuộn nhiều để triage.            |
| Tối giản            |       2 | Hero và nhân sự đẩy công việc xuống sâu.                     |
| Khắc phục lỗi       |       3 | Lỗi khác empty, thử lại độc lập.                             |
| Trợ giúp            |       2 | Chưa thống nhất người xử lý tiếp theo.                       |

## Tải nhận thức và cảm xúc

Ba điểm chưa đạt: nhóm quá nhiều lựa chọn ngang hàng, thứ bậc thông tin, số quyết định cùng lúc. Brand tạo tin cậy lúc vào; điểm trũng là cuộn qua hero/nhân sự và quét các queue ngoài trách nhiệm. Hướng dẫn hai người khi hoàn tiền giúp phục hồi tin tưởng.
Điểm mạnh: brand và nhãn điều hướng nhất quán; không giả tổng từ dữ liệu phân trang; giữ nguyên bảo vệ thao tác tài chính.

## Ưu tiên

1. [P1] Overview chưa ưu tiên công việc: DashboardOverview render welcome rồi nhân sự, sự cố ở dưới. Bằng chứng desktop B: hero y~285 cao385, nhân sự y~697 cao405, feed y~1129. Thu gọn welcome và đặt queue xử lý trước. Lệnh: polish.
2. [P1] Trung tâm duyệt trộn xử lý với giám sát: hồ sơ Manager 0 đứng đầu, hoàn tiền 9 ở dưới trong snapshot quan sát. Tách Admin xử lý và Theo dõi vận hành; không cộng các số phân trang thành tổng. Lệnh: clarify + polish.
3. [P2] Copy lệch quyền: báo cáo chờ duyệt trong overview, nhưng /admin/tasks chỉ đọc; Customer/Manager/Technician và luồng cũ. Dùng vai trò tiếng Việt, tên nhiệm vụ đúng quyền. Lệnh: clarify.
4. [P2] Điều hướng 16 mục, hai nhóm 6 lựa chọn, tài chính khó thấy. Nhóm theo công việc và cho tìm chức năng, giữ toàn bộ route và active state. Lệnh: polish + clarify.
5. [P2] Hàng hoàn tiền thiếu affordance mở, body sát summary. Giữ native details/summary, thêm dấu mở/thu gọn và spacing, không thay logic tài chính. Lệnh: polish + clarify.

## Persona

Alex: mất thời gian cuộn và dò queue có việc; không thêm bulk approve tài chính.
Jordan: khó biết việc nào thuộc Admin, khó nhận ra hàng hoàn tiền mở được.
Sam: giữ skip link, focus-visible, nhãn và semantics; kiểm tra keyboard, reflow, contrast trong pass sửa. Chưa thử NVDA.
Minor: lời chào kết thúc bằng dấu phẩy; heading lặp; ghi chú phạm vi đúng nhưng dài và lặp.
Câu hỏi thiết kế: sau 5 giây có biết việc nào cần quyết định không; có phân biệt giám sát với thực thi không?
Hướng, phạm vi và lệnh thực hiện đã do người dùng xác định: bắt đầu Admin, ưu tiên dễ dùng, polish + clarify. Không yêu cầu quyết định bổ sung.

## Bằng chứng và giới hạn

A/B độc lập; parent chỉ đọc B sau khi A hoàn tất.
Detector một invocation trên AdminWorkspace, DashboardOverview, AdminApprovalCenter, WorkspaceNavigation: exit0, [], không có rule findings hay false positive. Không có coverage metadata.
Browser Cua screenshot + read-only DOM. Không có mutable injection/overlay; không khởi động live-server; dùng FE dev sẵn.
Snapshot dữ liệu quan sát không phải tổng toàn hệ thống. Không gọi duyệt/chi tiền/xóa/cấp quyền. Không tuyên bố mọi API hay accessibility đều đạt.

# Kết quả clarify + polish

Ngày: 31/10/2026. Nhánh: feat/admin-workspace-clarity. Lưu cùng code trên nhánh feature để review trước khi merge.
Chỉ sửa FloraBot_FE.

## Đã làm

- Tổng quan: bỏ hero/ba bước chung, đưa yêu cầu cần xử lý và sự cố lên đầu; thu gọn nhân sự xuống cuối.
- Tách AdminOverview khỏi wrapper DashboardOverview, giữ nguyên SellerOverview.
- Trung tâm duyệt: nhóm yêu cầu Admin xử lý và theo dõi vận hành; thêm lọc “Tất cả / Có yêu cầu”.
- Danh mục: nhóm theo công việc, tìm không phân biệt dấu tiếng Việt; giữ đủ 16 route và active state.
- Nhãn và hướng dẫn: tên vai trò tiếng Việt, báo cáo “cần theo dõi”; phân biệt hồ sơ thuê do Quản lý vận hành xác nhận/phân công/bàn giao.
- Hoàn tiền: summary có “Xem / Ẩn chi tiết”, chevron, ngày yêu cầu và padding; bỏ tiền tố AUTO_REFUND khỏi thông điệp chính bằng cách diễn đạt tương đương.
- Sửa h1 lặp trong hoàn phí thuê. Không thay điều kiện duyệt, chi, chứng từ hoặc tách hai người.
- Style scoped theo data-platform-role=admin; giữ màu xanh/trắng, cải thiện focus, responsive và disabled cursor.
- Caught and fixed formatter merging conditional className; dùng hai chuỗi class đầy đủ để tránh tái phát.

## API dùng lại

GET /api/admin/refunds?status=PENDING&page=1
GET /api/admin/kiosk-applications/refunds
GET /api/admin/withdrawals?status=PENDING&page=1
GET /api/admin/complaints?status=OPEN&page=1
GET /api/admin/sellers?status=PENDING
GET /api/admin/incidents?status=OPEN&page=1
GET /api/admin/staff-tasks?page=1&status=SUBMITTED
GET /api/admin/preorders?page=1
GET /api/admin/managers
GET /api/operations/kiosk-applications?status=PAID_REVIEW&page=1&limit=10

Không thêm API. Hook queue dùng lại cùng query key theo actor giữa tổng quan/trung tâm duyệt.
Số lượng là danh sách đã tải, không tổng toàn hệ thống; hasMore được biểu diễn bằng +.
Loading/error không bị hiển thị thành 0; từng endpoint có retry.
Đối chiếu quyền từ source: Admin vẫn được ghi nhận kết quả xử lý sự cố. Không gắn nhãn “chỉ giám sát” cho sự cố; nhãn đó dành cho báo cáo công việc và đơn được theo dõi.

## Kiểm chứng

- pnpm lint: đạt, 0 warning.
- pnpm typecheck: đạt.
- pnpm test: 185/185, 17 file.
- pnpm build: production build đạt.
- Playwright production: 28/28 (19 Admin/queue/navigation/oversight + 2 empty/text scaling + 7 loading/refund keyboard/financial regression).
- Các kích thước có kiểm tra: 390, 834, 934, 1440; thêm phóng chữ gấp đôi tại 390 (không đồng nhất với browser zoom hệ điều hành).
- Axe trong các ca responsive và hoàn tiền: không phát hiện vi phạm thuộc bộ rule chạy.
- Detector Impeccable sau chỉnh: exit0, [] trên 7 file UI; không suy ra chứng nhận WCAG từ kết quả này.
- Git diff --check: đạt.
- Live: đăng nhập tài khoản BE hiện có, xem tổng quan/trung tâm duyệt/hoàn tiền qua FE local dùng BE deploy. Không duyệt/chi tiền/xóa/sửa dữ liệu thật.
- Không kiểm tra GitHub CI theo yêu cầu của người dùng.

## File chính để review

apps/web/src/features/portal/role-workspaces/AdminWorkspace.tsx
apps/web/src/features/portal/components/AdminNavigation.tsx
apps/web/src/features/portal/components/WorkspaceNavigation.tsx
apps/web/src/features/portal/config/workspaceSections.ts
apps/web/src/features/portal/styles/admin-workspace.css
apps/web/src/features/dashboard/AdminOverview.tsx
apps/web/src/features/dashboard/DashboardOverview.tsx
apps/web/src/features/dashboard/admin-queues.ts
apps/web/src/features/dashboard/use-admin-queues.ts
apps/web/src/features/dashboard/components/AdminQueueItem.tsx
apps/web/src/features/dashboard/components/AdminApprovalCenter.tsx
apps/web/src/features/finance/components/refunds/AdminRefunds.tsx
apps/web/src/features/finance/components/refunds/AdminKioskRefunds.tsx
tests/admin-queue-data.test.ts
tests/portal/admin-workspace-clarity.spec.ts
Các test dashboard/navigation/approval/refund hiện có được cập nhật theo nhãn và giao diện mới.

## Giới hạn

- Chưa chạy NVDA/thử thực tế mọi thiết bị.
- Không thay thế kiểm thử nghiệp vụ end-to-end trên dữ liệu tài chính thật.
- Feed tổng quan vẫn dẫn tới danh sách; thời điểm được thêm để phân biệt các sự cố tương tự. Chưa thêm deep-link đến một sự cố cụ thể.
- 25/40 là điểm trước sửa; không tự chấm điểm sau sửa nếu chưa có critique mới độc lập.

# Hoàn thiện các trang Admin còn lại — 31/10/2026

Tiếp tục trên nhánh `feat/admin-workspace-clarity`; đưa vào cùng đợt bàn giao để review trước khi merge. Giữ toàn bộ phần tổng quan, điều hướng và trung tâm duyệt của lượt trước.

## Phạm vi giao diện

| Nhóm                   | Các trang đã đồng bộ                                          |
| ---------------------- | ------------------------------------------------------------- |
| Mạng lưới và tài khoản | Tài khoản hệ thống, Quản lý vận hành, Shop hoa, Phân bổ kiosk |
| Giám sát               | Hồ sơ thuê kiosk, Giám sát công việc, Đơn đặt trước, Sự cố tủ |
| Xử lý yêu cầu          | Phản ánh, Hoàn tiền, Hoàn tiền thuê kiosk, Rút tiền           |
| Tra cứu                | Đối soát, Báo cáo vận hành                                    |

- Gom ô lọc và thao tác cập nhật thành nhóm; thống nhất nhãn, khoảng cách, kích thước trường nhập, trạng thái disabled và nút đặt lại bộ lọc.
- Chi tiết shop, kiosk, sự cố, phản ánh và rút tiền có dấu mở/đóng rõ ràng. Giữ native details/summary và thao tác bàn phím.
- Bảng danh sách giữ cột trên màn hình rộng, chuyển thành hàng dạng thẻ có nhãn trường ở màn hình hẹp; nút Chi tiết không bị đẩy khỏi vùng nhìn.
- Đồng bộ form và hộp thoại: kích thước theo loại, cuộn bên trong, đầu hộp thoại/nút thao tác cố định; Escape và trả focus về nút mở vẫn hoạt động.
- Thu gọn hướng dẫn lặp ở hồ sơ thuê; ghi rõ Admin giám sát, Quản lý vận hành xác nhận, phân công và bàn giao. Admin vẫn được xử lý sự cố theo quyền hiện có.
- Chỉnh nhãn báo cáo và hoàn phí thuê; không biến lỗi/loading thành số 0. Tăng tương phản trạng thái hoàn phí thuê.
- Đối soát thêm cách nhập từng giao dịch bằng mã và số tiền, giữ cách dán JSON. Có thêm/xóa dòng nháp, kiểm tra dữ liệu, gộp mã trùng, xem lại tổng trước khi gửi. Không lưu sao kê vào localStorage/sessionStorage; xóa nháp và bỏ kết quả đến muộn khi rời tab.

## API và phạm vi nghiệp vụ

Không thêm hoặc đổi endpoint, method, quyền hay định dạng request hiện có. FE local vẫn dùng `/api` và proxy tới BE deploy; không chạy BE/DB local.

Đối soát tiếp tục dùng:

- `POST /api/admin/flows/reconcile_daily` với `{ p_date }`.
- `POST /api/admin/flows/reconcile_gateway` với `{ p_date, p_statement: [{ txn, amount }] }`.

Mã nội bộ và mã trạng thái được giữ nguyên; chỉ đổi nhãn hiển thị. Các khóa tạm của dòng nhập không đi vào request. Giữ validation số nguyên an toàn, giới hạn 5.000 dòng, bước xem lại/xác nhận, chống gửi lặp và bảo vệ dữ liệu ngân hàng/tách hai Admin khi chi trả.

Các thao tác ghi nghiệp vụ được kiểm thử bằng API giả lập trong Playwright. Không duyệt, tạo tài khoản, xếp lịch, chi tiền, xóa dữ liệu hoặc chạy đối soát thật để kiểm tra hình thức giao diện.

## Kết quả kiểm tra lượt hoàn thiện

| Lệnh / kiểm tra                          | Kết quả cuối                          |
| ---------------------------------------- | ------------------------------------- |
| `pnpm lint`                              | Đạt, 0 warning                        |
| `pnpm typecheck`                         | Đạt                                   |
| `pnpm test`                              | 185/185, 17 file                      |
| `pnpm build`                             | Production build đạt sau sửa cuối     |
| Playwright production, bộ Admin chọn lọc | 76/76, 2 workers, Chrome              |
| Impeccable detector                      | 1 lượt trên 14 file TSX: exit 0, `[]` |
| `git diff --check`                       | Đạt                                   |

76 ca gồm 28 ca kiểm tra 14 trang ở 390px/1440px, thao tác lọc và bàn phím, hồi phục lỗi API, form mobile, nhập sao kê, các bảo vệ tài chính và các ca Admin của lượt trước. Có thêm kích thước 834px, 1000px và phóng chữ trong các ca chuyên biệt. Axe không phát hiện vi phạm thuộc bộ rule WCAG A/AA đã chạy; không thay thế kiểm tra NVDA hoặc chứng nhận WCAG.

Lượt đầu tìm ra CSS modal ghi đè biến thể nhỏ/vừa và badge hoàn phí thuê thiếu tương phản; đã sửa và chạy lại toàn bộ 76 ca. Locator menu mobile và alert của bài test mới đã được sửa để kiểm tra đúng trạng thái thực tế, không nới điều kiện nghiệp vụ.

Để team chạy lại các test portal mới sau build: dùng `playwright.portal.config.ts`, đặt `TEST_PORT` sang cổng trống nếu cần. Lượt kiểm chứng tại máy này dùng cấu hình cục bộ trong `artifacts/post-merge-review/admin-complete.config.ts` (không đưa artifact vào Git), giới hạn 10 file test và các ca Admin liên quan.

Live: FE cổng 8088 trả HTTP 200; tài khoản Admin BE hiện có tải lại phiên thành công. Xem đối soát, hồ sơ thuê và form trên mobile/desktop; không gửi thao tác nghiệp vụ thật. Đã trả viewport trình duyệt về kích thước mặc định.

## File bổ sung/chỉnh chính trong lượt này

- `apps/web/src/features/portal/components/AdminUi.tsx`
- `apps/web/src/features/portal/styles/admin-surfaces.css`
- `apps/web/src/features/portal/role-workspaces/AdminWorkspace.tsx`
- `apps/web/src/features/finance/components/reconciliation/StatementEditor.tsx`
- `apps/web/src/features/finance/components/reconciliation/AdminReconciliation.tsx`
- `apps/web/src/features/finance/components/refunds/AdminKioskRefunds.tsx`
- `apps/web/src/features/finance/components/refunds/AdminRefunds.tsx`
- `apps/web/src/features/finance/components/withdrawals/AdminWithdrawals.tsx`
- `apps/web/src/features/complaints/AdminComplaints.tsx`
- `apps/web/src/features/incidents/AdminIncidents.tsx`
- `apps/web/src/features/dashboard/components/AdminReports.tsx`
- `apps/web/src/features/account-management/components/AdminSellers.tsx`
- `apps/web/src/features/kiosk-management/AdminSlots.tsx`
- `apps/web/src/features/installations/OperationsInstallations.tsx`
- `apps/web/src/features/installations/components/InstallationList.tsx`
- `tests/fixtures/admin-surfaces.ts`
- `tests/portal/admin-all-surfaces.spec.ts`
- `tests/portal/admin-reconciliation.spec.ts`

CSS chỉ áp dụng trong workspace Admin. Các component dùng chung chỉ thay nhãn/hình thức theo vai trò; không đổi hành vi Manager/Seller/Technician. Repo BE, kiosk và IoT không có thay đổi. Stash sửa footer cũ vẫn được giữ.
