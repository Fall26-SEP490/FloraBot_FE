import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const input = process.argv[2] ?? 'packages/contracts/openapi.json';
const output = process.argv[3] ?? 'docs/backend-api-and-frontend.md';
const api = JSON.parse(await readFile(input, 'utf8'));
const verbs = new Set(['get', 'post', 'put', 'patch', 'delete']);
const endpoints = Object.entries(api.paths).flatMap(([route, operations]) =>
  Object.entries(operations)
    .filter(([verb]) => verbs.has(verb))
    .map(([verb, operation]) => ({
      method: verb.toUpperCase(),
      route,
      tags: operation.tags?.join(', ') ?? 'API',
    })),
);
const rows = endpoints
  .map((item) => `| ${item.method} | \`${item.route}\` | ${item.tags} |`)
  .join('\n');
const document = `# Backend API và giao diện FloraBot

Kiểm tra ngày 16/10/2026. Nguồn: OpenAPI xuất từ API local và code BE tại commit 2733ce2. Có **${endpoints.length} tổ hợp method–path**, không tính SignalR. Đây là danh mục khả năng backend, không phải tuyên bố tất cả luồng đã được nghiệm thu với provider/phần cứng thật.

## Code BE đã có

ASP.NET Core .NET 10 modular monolith: Identity, Catalog, KioskOps, Ordering, Payment, Notify và Ai. Các hàm SQL flow.* giữ chuyển trạng thái nghiệp vụ; API kiểm tra phiên, tenant/tài nguyên và payload. YARP là gateway; CAP/RabbitMQ phục vụ outbox, Valkey phục vụ phiên/OTP/cache, SignalR invalidation/chat và MQTT phục vụ thiết bị khi được cấu hình.

## Đối chiếu luồng API với FE

| Luồng | API chính | Màn FE và trạng thái kết nối |
|---|---|---|
| Đăng ký/xác thực | /auth/register, /auth/register/verify, /auth/login, /auth/google | /dang-ky, /dang-nhap, /admin/login; cookie phiên; Google/email thật phụ thuộc cấu hình |
| Hồ sơ | /account/profile, /account/contact-email | /ho-so; dữ liệu tài khoản thật; ngân hàng cá nhân tách ví shop |
| Danh mục | GET /shop/catalog | /dat-hoa; tìm kiếm/phân trang API; dữ liệu mẫu được gắn cờ và chặn tạo đơn/chat |
| Đặt mẫu hoặc bó có sẵn | POST /member/preorders | /dat-hoa; ID yêu cầu giữ nguyên khi kết quả mạng chưa rõ |
| Shop phản hồi | /sellers/{sellerId}/preorders, /quote, /fulfill, /cancel | /seller/orders; báo giá, nạp đúng tủ, đọc lại trạng thái; không coi nạp hoa là mở cửa |
| Khách chốt báo giá/thanh toán | /member/preorders, /accept, /payment-link | /tai-khoan#web-orders; giá/lịch snapshot; chỉ mở URL pay.payos.vn; backend xác minh tiền |
| Chat | /member/chats, /sellers/{sellerId}/chats, /chats/{chatId}/messages | Tab tin nhắn khách và /seller/chats; SignalR /hub/chat, REST là nguồn dữ liệu |
| Tồn kho, sản phẩm và ảnh | /sellers/{sellerId}/products, /slots, /photos, flows/stock_bouquet | /seller/products, /seller/stock; Cloudinary ảnh thật phụ thuộc credentials |
| Giao việc | /staff/tasks, /operations/staff-tasks, /sellers/{sellerId}/staff-tasks | /staff, /technician, /operations, /seller/tasks; scope theo người/tenant/tủ |
| Thuê/lắp đặt kiosk | /kiosk-packages, /member/kiosk-applications, /operations/kiosk-applications | /thue-kiosk, /operations/installations, /technician/installations; chỉ bàn giao hợp lệ mới lên Seller |
| Đội ngũ | /admin/managers, /operations/technicians, /sellers/{sellerId}/staff/accounts | Các route quản lý tài khoản đã nối API; không dùng bảng minh họa để thay dữ liệu thật |
| Tiền và biên nhận | /wallet, /withdrawals, /refunds, /receipts/lookup | /seller/wallet, /admin/withdrawals, /admin/refunds, /receipt; chuyển khoản ngoài app và hai admin theo flow |
| Báo cáo | /admin/reports/v_admin_queue, v_revenue_daily, v_platform_revenue, v_ai_effectiveness | /admin/reports; đọc thật; tối đa 100 dòng/API; phân trang UI 20 dòng, không suy ra tổng hệ thống |
| Kiosk xem trước | GET công khai /shop/catalog và /kiosks khi chọn chế độ API | /kiosk/?preview=1; mẫu mặc định được ghi rõ; chỉ đọc và chuyển màn cục bộ; không cần khóa thiết bị |
| IoT | /kiosks/{id}/flows/device_event, kiosk_heartbeat, request_pickup; MQTT | Chưa có phần cứng thật. Preview không gọi các API này hoặc checkout/payment; không giả lập thành công vật lý |

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

| Method | Path | Nhóm OpenAPI |
|---|---|---|
${rows}
`;
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, document, 'utf8');
console.log(`Wrote ${endpoints.length} endpoints to ${output}`);
