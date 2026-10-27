export function formatComplaintMoney(value: number | string): string {
  return `${Number(value).toLocaleString('vi-VN')} đ`;
}

export function formatComplaintDate(value: string): string {
  return new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

export function safeUrl(value: string): string | null {
  try {
    if (/^\/api\/admin\/evidence\/[0-9a-f-]{36}$/.test(value)) return value;
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
