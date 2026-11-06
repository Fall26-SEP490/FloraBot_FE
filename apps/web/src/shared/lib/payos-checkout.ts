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

export const PAYOS_SCRIPT_URL = 'https://cdn.payos.vn/payos-checkout/v1/stable/payos-initialize.js';

type PayosConfig = {
  RETURN_URL: string;
  ELEMENT_ID: string;
  CHECKOUT_URL: string;
  embedded: boolean;
  onSuccess: () => void;
  onCancel: () => void;
  onExit: () => void;
};

type PayosSdk = {
  usePayOS: (config: PayosConfig) => { open: () => void; exit: () => void };
};

declare global {
  interface Window {
    PayOSCheckout?: PayosSdk;
  }
}

let sdkPromise: Promise<PayosSdk> | undefined;

export function loadPayosCheckout(): Promise<PayosSdk> {
  if (window.PayOSCheckout) return Promise.resolve(window.PayOSCheckout);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<PayosSdk>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = PAYOS_SCRIPT_URL;
    script.async = true;
    const fail = () => {
      window.clearTimeout(timer);
      script.remove();
      sdkPromise = undefined;
      reject(new Error('Chưa tải được màn hình PayOS. Kiểm tra kết nối rồi thử lại.'));
    };
    const timer = window.setTimeout(fail, 20_000);
    script.onerror = fail;
    script.onload = () => {
      window.clearTimeout(timer);
      if (window.PayOSCheckout) resolve(window.PayOSCheckout);
      else fail();
    };
    document.head.appendChild(script);
  });
  return sdkPromise;
}
