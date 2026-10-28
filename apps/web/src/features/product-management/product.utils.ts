import { ApiError } from '@/shared/lib/api';

export function parseTags(input: string): string[] {
  if (!input || !input.trim()) return [];
  return input
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

export function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Mất kết nối. Thông tin đã nhập vẫn được giữ, hãy thử lại.';
}

export function safeImage(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}
