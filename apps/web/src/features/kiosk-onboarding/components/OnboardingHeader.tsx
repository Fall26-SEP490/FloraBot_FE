import Link from 'next/link';

export function OnboardingHeader() {
  return (
    <header className="kiosk-onboarding-header">
      <nav className="kiosk-breadcrumb" aria-label="Đường dẫn">
        <Link href="/tai-khoan">Tài khoản của tôi</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Thuê Kiosk</span>
      </nav>
      <h1>Đăng ký thuê Kiosk hoa thông minh</h1>
      <p className="kiosk-onboarding-lead">
        FloraBot cung cấp mô hình kiosk hoa giả với 2 phân vùng ô riêng biệt: ô vãng lai (khách mua
        trực tiếp) và ô đặt trước (khách nhận hoa hẹn trước). Phí thuê tính theo năm bắt đầu từ ngày
        nghiệm thu bàn giao thực tế.
      </p>
    </header>
  );
}
