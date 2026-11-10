import { z } from 'zod';

export const esp32Provisioning = z.object({
  state: z.enum(['PENDING', 'PROVISIONING', 'READY', 'FAILED']),
  errorCode: z.string().nullish(),
  attempts: z.number().int().nonnegative(),
  readyAt: z.string().nullish(),
});

const metadata = z.object({
  kioskId: z.string(),
  kioskCode: z.string(),
  status: z.string(),
  hardwareId: z.string(),
  mqttClientId: z.string(),
  firmwareMqttClientId: z.string(),
  mqttClientIdsMatch: z.boolean(),
  mqttHost: z.string().nullish(),
  mqttTlsPort: z.number().nullish(),
  caCertificatePem: z.string().nullish(),
  canDownload: z.boolean(),
  downloadUnavailableCode: z.string().nullish(),
  provisioning: esp32Provisioning.nullish(),
});

export type Esp32Role = 'admin' | 'manager' | 'technician';

export function esp32Path(role: Esp32Role, resourceId: string) {
  const id = encodeURIComponent(resourceId);
  if (role === 'technician') return `/api/staff/kiosk-installations/${id}/esp32-config`;
  return `/api/${role === 'admin' ? 'admin' : 'operations'}/kiosks/${id}/esp32-config`;
}

const messages: Record<string, string> = {
  ESP32_CONFIG_REAUTHENTICATION_FAILED: 'Mật khẩu chưa đúng. Nhập lại mật khẩu hiện tại của bạn.',
  ESP32_CONFIG_NOT_READY: 'Cấu hình đang được cấp. Hãy đợi đến khi sẵn sàng.',
  ESP32_CONFIG_PROVISIONING_FAILED: 'Cấp cấu hình thất bại. Người phụ trách có thể thử cấp lại.',
  ESP32_CONFIG_DEPLOYMENT_NOT_CONFIGURED: 'VPS chưa cấu hình broker MQTT hoặc chứng chỉ CA.',
  ESP32_CONFIG_NOT_PROVISIONED:
    'Tủ chưa có bộ khóa thiết bị. Liên hệ vận hành để kiểm tra cấp cấu hình.',
  ESP32_CONFIG_HMAC_MISMATCH:
    'Khóa ký của thiết bị chưa khớp với máy chủ. Liên hệ vận hành để đối chiếu.',
  ESP32_AUTO_PROVISIONING_DISABLED: 'VPS chưa bật cấp cấu hình tự động.',
};

export class Esp32RequestError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super(
      (code && messages[code]) ||
        (
          {
            401: 'Phiên đăng nhập đã hết hạn. Đăng nhập lại để tiếp tục.',
            403: 'Tài khoản hiện tại không có quyền thực hiện thao tác này.',
            404: 'Không tìm thấy cấu hình trong phạm vi được giao. Kiểm tra lại phân công hoặc trạng thái phiếu.',
            409: 'Cấu hình chưa sẵn sàng. Tải lại thông số để kiểm tra.',
            429: 'Bạn đã thử quá nhiều lần. Chờ một lúc rồi thử lại.',
          } as Record<number, string>
        )[status] ||
        'Không xử lý được cấu hình ESP32. Hãy thử lại.',
    );
  }
}

async function esp32Request(path: string, init: RequestInit, signal: AbortSignal) {
  const result = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
  });
  if (!result.ok) {
    const problem: unknown = await result.json().catch(() => null);
    const parsed = z
      .object({ code: z.string().optional(), title: z.string().optional() })
      .safeParse(problem);
    throw new Esp32RequestError(
      result.status,
      parsed.success ? (parsed.data.code ?? parsed.data.title) : undefined,
    );
  }
  return result;
}

export async function readEsp32(path: string, signal: AbortSignal) {
  const result = await esp32Request(path, {}, signal);
  return metadata.parse(await result.json());
}

export async function provisionEsp32(path: string, signal: AbortSignal) {
  const result = await esp32Request(`${path}/provision`, { method: 'POST' }, signal);
  return esp32Provisioning.parse(await result.json());
}

export async function downloadEsp32(path: string, password: string, signal: AbortSignal) {
  const result = await esp32Request(
    `${path}/download`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    },
    signal,
  );
  const contentType = result.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  const disposition = result.headers.get('content-disposition') ?? '';
  if (contentType !== 'text/x-c++hdr' || !/^attachment(?:;|$)/i.test(disposition)) {
    throw new Error('Invalid ESP32 attachment');
  }
  return result.blob();
}

export function esp32Unavailable(code: string | null | undefined) {
  return code ? messages[code] : undefined;
}
