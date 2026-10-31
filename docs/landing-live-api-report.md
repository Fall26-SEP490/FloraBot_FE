# Báo cáo trang chủ dùng API hiện có

Ngày kiểm tra: 31/10/2026, Asia/Saigon. Chỉ thay đổi FloraBot_FE.

## Phần đã hoàn thành

- Bảng giá và Registration dùng chung GET `/api/kiosk-packages`: đúng `annualFee` (đ/năm), `totalSlots`, `termMonths`, tên, mô tả và ID API. Không chọn sẵn ID cũ; gói không còn trong response bị loại khỏi lựa chọn hợp lệ. Form bị khóa khi chưa tải/lỗi/không có gói.
- Chọn gói ở bảng giá cập nhật đúng `packageId` trong form qua React context, kể cả sau khi API tải bất đồng bộ. Đã bỏ bridge event/dataset cũ. Giữ POST `/api/sellers` cho form tư vấn hiện hữu; source BE xác nhận endpoint kiểm tra gói ACTIVE trong subscription_packages. Đây là form tư vấn, không thay thế hồ sơ thuê kiosk và thanh toán.
- GET `/api/kiosk-locations` được render từ server bằng cấu hình `API_PROXY_TARGET` đang dùng cho proxy. Cùng một mảng kiosk được truyền cho danh sách và KioskMap; không gọi geolocation tự động. Không còn địa điểm/tọa độ demo hay marker Hoàng Sa/Trường Sa. Tooltip dùng text và mỗi marker có ID kiosk tương ứng.
- Danh sách địa chỉ/link chỉ đường có trong HTML khi tắt JavaScript. Bản đồ tải theo thao tác người dùng; lỗi tile/chunk không làm mất danh sách. Ưu tiên `directionsUrl` của API, có kiểm tra URL an toàn.
- GiftDemo dùng GET `/api/shop/catalog?page={page}&search=`. Gợi ý theo giá trong các mẫu đã tải; nút tải thêm dùng `hasMore` và trang kế tiếp. Lỗi trang sau giữ các kết quả hợp lệ trước đó và cho thử lại. Không trình bày trang đầu như toàn bộ catalog khi còn trang khác.
- Tên, giá, ảnh, shop, kiosk và địa chỉ trên thẻ hoa lấy từ response. Ảnh null dùng ô thông báo chưa có ảnh, không thay bằng ảnh sản phẩm giả. Không tạo tags/dịp tặng, nhãn Walk-in hay cam kết tồn kho.
- Bộ ảnh tĩnh được ghi rõ là ảnh cảm hứng/minh họa. Bỏ structured data Product/Offer dùng giá cũ; giữ Organization và metadata còn phù hợp.
- Có loading/empty/error theo từng nguồn, nút thử lại và thông báo screen reader. Đã kiểm tra focus form, bàn phím, kích thước nút, reflow và phóng to chữ.

## API và kiểm tra BE deploy qua FE local

Tất cả lời gọi dưới đây là GET tới localhost:8088 qua proxy cấu hình hiện hữu; không hardcode hostname production trong source mới.

| Endpoint                           | HTTP | Kết quả quan sát                 |
| ---------------------------------- | ---- | -------------------------------- |
| `/api/kiosk-packages`              | 200  | 3 bản ghi                        |
| `/api/kiosk-locations`             | 200  | 2 bản ghi                        |
| `/api/shop/catalog?page=1&search=` | 200  | 7 bản ghi, page=1, hasMore=false |

- Trang chủ HTTP 200; HTML có toàn bộ địa chỉ từ response địa điểm và không có Product/Offer giá cũ.
- Đã mở UI với BE deploy: gói Trial/Pro/Max hiện theo API; chọn Pro điền GUID `20000000-0000-0000-0000-00000000000d`; gợi ý hiển thị sản phẩm và shop/kiosk của BE.
- Không gửi form đăng ký hoặc gọi API ghi lên BE deploy. Test POST đăng ký chỉ chạy bằng fixture.

## Kết quả kiểm thử cuối

| Lệnh                                                                  | Kết quả                                               |
| --------------------------------------------------------------------- | ----------------------------------------------------- |
| `pnpm lint`                                                           | Đạt, 0 lỗi/cảnh báo                                   |
| `pnpm typecheck`                                                      | Đạt                                                   |
| `pnpm test`                                                           | 165/165 unit test, gồm 10 test mapping/validation mới |
| `pnpm build`                                                          | Đạt; trang chủ render động để lấy địa điểm SSR        |
| `pnpm exec playwright test --config playwright.landing-api.config.ts` | 31/31 đạt trên production                             |

Playwright dùng mock API chỉ bind loopback, không dùng DB hoặc BE thật. Bộ test bao gồm dữ liệu thành công, loading, empty/error riêng từng API, ID gói khi đăng ký, marker/danh sách cùng ID, lỗi bản đồ, không JavaScript, phân trang/retry và không fallback dữ liệu giả; kiểm tra accessibility ở 390/820/1440px, reflow 320px và phóng to chữ.

## Giới hạn dữ liệu/API

- Catalog chưa cung cấp occasion/tags phù hợp cho gợi ý theo người nhận/dịp tặng: hiện chỉ lọc ngân sách. Muốn bổ sung các tiêu chí đó cần BE có dữ liệu tương ứng.
- Giá catalog là giá mẫu; endpoint không chứng minh có bó sẵn để lấy ngay. FE không suy ra tồn kho từ zone hoặc bouquets.
- Danh sách địa điểm phụ thuộc dữ liệu địa chỉ/tọa độ BE cung cấp. Trạng thái kết nối không được dùng để cam kết kiosk có hoa nhận ngay.
- Địa điểm SSR cần cấu hình `API_PROXY_TARGET`; khi chưa cấu hình/lỗi/timeout sẽ hiển thị trạng thái lỗi, không dựng địa điểm giả. Phần bản đồ vẫn phụ thuộc dịch vụ tile bên ngoài và có danh sách dự phòng.
- Form tư vấn cũ POST `/api/sellers` khác quy trình Customer thuê kiosk qua `/api/member/kiosk-applications`; task không gộp hai luồng hay tạo thanh toán mới.

## Bảo toàn workspace

Đã so SHA-256 của 24 file có thay đổi từ trước task: tất cả giữ nguyên. Không sửa phần Hoa tại tủ/thu hồi hoa, BE, kiosk hoặc contract sinh tự động. Không reset hay ghi đè các thay đổi có sẵn.

## File thuộc task này

- `apps/web/app/(marketing)/page.tsx`
- `apps/web/src/features/marketing/GiftDemo.tsx`
- `apps/web/src/features/marketing/KioskLocations.tsx`
- `apps/web/src/features/marketing/KioskMap.tsx`
- `apps/web/src/features/marketing/LandingPackages.tsx`
- `apps/web/src/features/marketing/MarketingEffects.tsx`
- `apps/web/src/features/marketing/Registration.tsx`
- `apps/web/src/features/marketing/landing-api.ts`
- `apps/web/src/features/marketing/landing-data.ts`
- `apps/web/src/features/marketing/landing-locations.server.ts`
- `apps/web/src/features/marketing/landing.css`
- `apps/web/src/features/marketing/styles/landing-live-data.css`
- `playwright.landing-api.config.ts`
- `tests/browser/landing-keyboard.spec.ts`
- `tests/browser/landing-live-api.spec.ts`
- `tests/browser/landing-test-data.ts`
- `tests/browser/landing.spec.ts`
- `tests/fixtures/landing-api-data.json`
- `tests/fixtures/landing-api-server.mjs`
- `tests/landing-api-mapping.test.ts`
- `docs/landing-live-api-report.md`
