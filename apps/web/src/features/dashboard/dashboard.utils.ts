export const formatDashboardDate = (value: string) =>
  new Date(value).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'short',
    timeStyle: 'short',
  });

export const formatDashboardMoney = (value: number | string | null) =>
  value === null
    ? 'Chưa có dữ liệu'
    : Number(value).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
