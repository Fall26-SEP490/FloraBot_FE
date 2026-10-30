import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_EVIDENCE_SIZE_BYTES,
  TIME_WINDOW_REGEX,
} from './installations.constants';

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

export function validateTimeWindow(timeWindow: string): { valid: boolean; error?: string } {
  const trimmed = timeWindow.trim();
  if (!TIME_WINDOW_REGEX.test(trimmed) || trimmed.slice(0, 5) >= trimmed.slice(8, 13)) {
    return {
      valid: false,
      error: 'Nhập khung giờ HH:mm - HH:mm, giờ kết thúc phải sau giờ bắt đầu.',
    };
  }
  return { valid: true };
}

export interface EnrollKioskFormData {
  code: string;
  name: string;
  hardwareId: string;
  slotCount: number;
}

export function validateEnrollKioskForm(data: EnrollKioskFormData): {
  valid: boolean;
  error?: string;
} {
  const code = data.code.trim();
  const name = data.name.trim();
  const hardwareId = data.hardwareId.trim();

  if (!code || !name || !hardwareId) {
    return { valid: false, error: 'Vui lòng điền đầy đủ mã tủ, tên tủ và Hardware ID.' };
  }
  if (code.length < 2 || name.length < 2 || name.length > 120 || hardwareId.length < 2) {
    return {
      valid: false,
      error: 'Mã tủ và Hardware ID cần ít nhất 2 ký tự; tên tủ từ 2 đến 120 ký tự.',
    };
  }
  if (!Number.isInteger(data.slotCount) || data.slotCount < 1 || data.slotCount > 50) {
    return {
      valid: false,
      error: 'Tổng số ô phải là số nguyên từ 1 đến 50.',
    };
  }
  return { valid: true };
}

export function validateConfirmNote(note: string): { valid: boolean; error?: string } {
  if (note.trim().length < 5) {
    return { valid: false, error: 'Ghi chú xác nhận liên hệ cần ít nhất 5 ký tự.' };
  }
  return { valid: true };
}

export function validateRejectReason(reason: string): { valid: boolean; error?: string } {
  if (reason.trim().length < 5) {
    return { valid: false, error: 'Lý do từ chối cần ít nhất 5 ký tự.' };
  }
  return { valid: true };
}

export function validateReworkReason(reason: string): { valid: boolean; error?: string } {
  if (reason.trim().length < 5) {
    return { valid: false, error: 'Lý do yêu cầu sửa lại cần ít nhất 5 ký tự.' };
  }
  return { valid: true };
}

export function validatePlatformFailureReason(reason: string): { valid: boolean; error?: string } {
  if (reason.trim().length < 5) {
    return { valid: false, error: 'Lý do sự cố bất khả kháng cần ít nhất 5 ký tự.' };
  }
  return { valid: true };
}

export function validateReportText(text: string): { valid: boolean; error?: string } {
  if (text.trim().length < 10) {
    return { valid: false, error: 'Báo cáo cần ít nhất 10 ký tự.' };
  }
  return { valid: true };
}

export function validateEvidenceFile(file: File | null): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'Vui lòng chọn file ảnh.' };
  }
  const isAllowedType = (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type);
  if (!isAllowedType || file.size === 0 || file.size > MAX_EVIDENCE_SIZE_BYTES) {
    return {
      valid: false,
      error: 'Vui lòng chọn file ảnh PNG, JPEG hoặc WebP với dung lượng dưới 5 MB.',
    };
  }
  return { valid: true };
}

export function getOperationsActiveStep(status?: string, needsSchedule?: boolean): number {
  if (status === 'PAID_REVIEW') return 0;
  if (needsSchedule) return 1;
  if (status === 'INSTALLING' || status === 'AWAITING_HANDOVER') return 2;
  if (status === 'ACTIVE') return 3;
  return -1;
}

export function getTechnicianStepIndex(status: string): number {
  return Math.max(0, ['SCHEDULED', 'INSTALLING', 'AWAITING_HANDOVER', 'ACTIVE'].indexOf(status));
}

export function formatDateVN(dateStr?: string | null): string {
  if (!dateStr) return 'Chưa có ngày';
  try {
    return new Date(`${dateStr.slice(0, 10)}T00:00:00`).toLocaleDateString('vi-VN');
  } catch {
    return dateStr;
  }
}
