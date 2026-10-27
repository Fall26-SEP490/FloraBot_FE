export const message = (error: unknown) =>
  error instanceof Error ? error.message : 'Chưa xử lý được yêu cầu. Vui lòng thử lại.';

export const dateText = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
    : 'Chưa cập nhật';
