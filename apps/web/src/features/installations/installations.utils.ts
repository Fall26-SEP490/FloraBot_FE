export function validatePayosCheckoutUrl(rawUrl: string): {
  valid: boolean;
  url?: string;
  error?: string;
} {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, error: 'Địa chỉ thanh toán không hợp lệ.' };
  }
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, error: 'Địa chỉ thanh toán không được để trống.' };
  }
  try {
    const parsed = new URL(trimmed);

    // Reject userinfo unconditionally (e.g. https://user:pass@pay.payos.vn)
    if (parsed.username || parsed.password) {
      return {
        valid: false,
        error: 'Địa chỉ thanh toán chứa thông tin xác thực người dùng không an toàn.',
      };
    }

    // Production security constraint: EXACT https: and EXACT pay.payos.vn host
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'Chỉ chấp nhận liên kết thanh toán HTTPS bảo mật.' };
    }
    if (parsed.hostname !== 'pay.payos.vn') {
      return {
        valid: false,
        error: 'Tên miền không thuộc cổng thanh toán payOS được ủy quyền (yêu cầu pay.payos.vn).',
      };
    }
    if (parsed.port && parsed.port !== '443') {
      return { valid: false, error: 'Cổng kết nối không tiêu chuẩn bị từ chối.' };
    }

    return { valid: true, url: parsed.toString() };
  } catch {
    return { valid: false, error: 'Định dạng liên kết thanh toán không hợp lệ.' };
  }
}

export function parseAndValidateCoordinate(
  input: string,
  kind: 'lat' | 'lon',
): { valid: boolean; value: number | null; error?: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      valid: false,
      value: null,
      error: 'Tọa độ không được để trống (ô trống không đồng nghĩa với 0).',
    };
  }
  const num = Number(trimmed);
  if (!Number.isFinite(num)) {
    return { valid: false, value: null, error: 'Tọa độ phải là một số hợp lệ.' };
  }
  if (kind === 'lat') {
    if (num < -90 || num > 90) {
      return { valid: false, value: null, error: 'Vĩ độ phải nằm trong khoảng từ -90 đến 90.' };
    }
  } else {
    if (num < -180 || num > 180) {
      return { valid: false, value: null, error: 'Kinh độ phải nằm trong khoảng từ -180 đến 180.' };
    }
  }
  return { valid: true, value: num };
}
