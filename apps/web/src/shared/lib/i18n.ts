import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
void i18n.use(initReactI18next).init({
  lng: 'vi',
  fallbackLng: 'vi',
  interpolation: { escapeValue: false },
  resources: {
    vi: {
      translation: {
        welcome: 'Chào {{name}},',
        loginTitle: 'Chào shop, mừng bạn trở lại.',
        loginIntro: 'Đăng nhập bằng tài khoản FloraBot đã được cấp cho shop hoặc đội ngũ vận hành.',
        email: 'Email',
        password: 'Mật khẩu',
        login: 'Đăng nhập',
        loggingIn: 'Đang đăng nhập…',
        logout: 'Đăng xuất',
        loading: 'Đang tải thông tin…',
        retry: 'Thử lại',
        status: {
          ACTIVE: 'Đang hoạt động',
          APPROVED: 'Đã duyệt',
          PENDING: 'Chờ duyệt',
          PAST_DUE: 'Gói đã hết hạn',
          SUSPENDED: 'Tạm ngưng',
          CLOSED: 'Đã đóng',
        },
        banner: {
          PENDING: 'Hồ sơ shop đang chờ duyệt. Bạn chưa cần thanh toán gói.',
          APPROVED: 'Shop đã được duyệt. Thanh toán gói thuê để bắt đầu mở bán.',
          PAST_DUE:
            'Gói hết hạn ngày {{date}}. Kiosk đã ngừng bán hoa của shop; gia hạn và thanh toán để mở bán lại.',
          SUSPENDED: 'Shop đang tạm ngưng. Vui lòng liên hệ đội ngũ vận hành để được hỗ trợ.',
          CLOSED: 'Shop đã đóng. Vui lòng liên hệ đội ngũ vận hành nếu cần hỗ trợ.',
          EXPIRING:
            'Gói thuê hết hạn ngày {{date}}. Bạn nên gia hạn để việc bán hoa không bị gián đoạn.',
          UNKNOWN: 'Chưa xác định được trạng thái gói. Hãy tải lại thông tin trước khi thao tác.',
        },
      },
    },
  },
});
export default i18n;
