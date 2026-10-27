import type { Statement } from './finance.types';

export function formatMoney(value: number | string): string {
  return `${Number(value).toLocaleString('vi-VN')} đ`;
}

export function formatCurrency(value: number | string): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
    Number(value),
  );
}

export function formatFinanceDate(value: string): string {
  return new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

export function formatInteger(value: number | string): string {
  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    return BigInt(value).toLocaleString('vi-VN');
  }
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return value.toLocaleString('vi-VN');
  }
  return 'Vượt giới hạn hiển thị chính xác';
}

export function formatReconcileMoney(value: number | string | null): string {
  return value === null ? 'Không có' : `${formatInteger(value)} đ`;
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

export function parseStatement(raw: string): Statement {
  if (raw.length > 1_500_000) throw new Error('Sao kê quá lớn. Chỉ nhập tối đa 5.000 dòng.');
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('Nội dung chưa đúng JSON. Dùng mẫu bên dưới và kiểm tra dấu ngoặc, dấu phẩy.');
  }
  if (!Array.isArray(value) || value.length > 5000)
    throw new Error('Sao kê cần là mảng JSON, tối đa 5.000 dòng.');
  const totals = new Map<string, number>();
  for (const item of value as unknown[]) {
    if (
      typeof item !== 'object' ||
      item === null ||
      !('txn' in item) ||
      !('amount' in item) ||
      typeof item.txn !== 'string' ||
      item.txn.length < 1 ||
      item.txn.length > 200 ||
      item.txn !== item.txn.trim() ||
      Array.from(item.txn).some(
        (c) => c.charCodeAt(0) < 32 || (c.charCodeAt(0) >= 127 && c.charCodeAt(0) <= 159),
      ) ||
      typeof item.amount !== 'number' ||
      !Number.isSafeInteger(item.amount) ||
      item.amount <= 0
    )
      throw new Error('Mỗi dòng sao kê cần có mã giao dịch hợp lệ và số tiền nguyên lớn hơn 0.');
    totals.set(item.txn, (totals.get(item.txn) || 0) + item.amount);
  }
  return Array.from(totals.entries()).map(([txn, amount]) => ({ txn, amount }));
}
