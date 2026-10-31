import { ApiError } from '@/shared/lib/api';

export function technicianErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại bằng tài khoản Kỹ thuật viên.';
    }
    if (error.status === 403) {
      return 'Bạn chưa có quyền thực hiện công việc này. Hãy dùng tài khoản TECHNICIAN được Manager phân công cho hồ sơ.';
    }
    if (error.status === 404) {
      return 'Không tìm thấy công việc được phân công cho bạn. Hãy tải lại hoặc nhờ Manager kiểm tra phân công.';
    }
  }
  return error instanceof Error ? error.message : fallback;
}
