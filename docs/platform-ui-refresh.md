# Làm mới UI Admin, Manager và Technician

Nhánh: `feat/platform-ui-refresh`, bắt đầu từ main và đồng bộ đến `2ccce20`.

## Thay đổi

- Sidebar xanh đậm, nhận diện khu vực theo vai trò, menu hiện tại nổi bật và vùng cuộn riêng trên desktop.
- Header gọn hơn; nút đăng xuất vẫn có tên truy cập khi chỉ hiển thị icon trên điện thoại.
- Banner tổng quan dùng chung `platform/WorkspaceWelcome.tsx`, với nội dung, tác vụ chính và ba bước hướng dẫn riêng cho từng vai trò.
- Thẻ thống kê, bảng danh sách, bộ lọc và modal có phân cấp, khoảng cách và màu nền nhất quán.
- Technician có khối công việc riêng, giải thích trạng thái trống và ý nghĩa số liệu theo trang. Bố cục thẻ thống kê không còn phụ thuộc việc đã mở Admin/Manager trước đó.
- Đổi nhãn nhóm công việc SUBMITTED/COMPLETED thành “Đã gửi / Hoàn tất” cho các vai trò nền tảng; không đổi công thức đếm hoặc API.
- Link hướng dẫn Technician dẫn về `/technician#technician-guide`, dùng được từ màn lắp đặt.
- Nhãn thống kê Admin ghi “Sự cố trong trang đầu” và “Báo cáo trong trang đầu”, thể hiện đúng phạm vi dữ liệu API trả về.
- CSS mới nằm trong `platform/platform-refresh.css`, giới hạn dưới `.workspace-portal-root.platform-workspace`.

Không thêm API, thư viện hay dữ liệu mẫu. Không sửa BE/Kios, phân quyền hoặc luồng tài chính.

## Kiểm tra

- Production build và TypeScript đạt.
- ESLint đạt; 104/104 unit tests đạt.
- 54/54 browser regression tests đạt trên bản production: account-management, operations-workspace, platform-role-workspaces, workspace-navigation, workspace-roles, kiosk-onboarding và css-isolation-and-leakage.
- Sau khi đổi nhãn, build/lint và 3/3 kiểm tra Admin Overview ở 320/390/1440 px đạt.
- Các bài trình duyệt trên dùng HTTP fixtures; không coi đây là kiểm thử ghi dữ liệu mới với BE thật.
- Đăng nhập thực tế trên `localhost:8088` bằng ba tài khoản local; đọc trang Admin, hồ sơ tài khoản, Manager và Technician bằng API thật.
- Kiểm tra viewport 320/390/1440 px, menu mobile và modal; các bài có sẵn kiểm tra thêm 768 px và accessibility.
- Tải trực tiếp `/technician` sau reload: khối thống kê vẫn dùng grid và không tràn ngang.

## Xem trên máy local

FE production đang chạy ở cổng 8088, BE 5080, database `florabot` hiện có. Đăng nhập tại `/admin/login`, dùng tài khoản đúng vai trò.

Ảnh trước/sau và log kiểm tra nằm trong `artifacts/platform-ui-refresh/` (được Git bỏ qua). Tài khoản, mật khẩu và dữ liệu test local không thuộc thay đổi mã nguồn này.
