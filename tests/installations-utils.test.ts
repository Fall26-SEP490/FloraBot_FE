import { describe, expect, it } from 'vitest';
import {
  validateTimeWindow,
  validateEnrollKioskForm,
  validateConfirmNote,
  validateRejectReason,
  validateReworkReason,
  validatePlatformFailureReason,
  validateReportText,
  validateEvidenceFile,
  getOperationsActiveStep,
  getTechnicianStepIndex,
  formatDateVN,
} from '../apps/web/src/features/installations/installations.utils';

describe('installations.utils unit tests', () => {
  describe('validateTimeWindow', () => {
    it('accepts valid time window where end time is after start time', () => {
      expect(validateTimeWindow('09:00 - 12:00').valid).toBe(true);
      expect(validateTimeWindow('13:00 - 15:00').valid).toBe(true);
      expect(validateTimeWindow('08:30 - 17:30').valid).toBe(true);
    });

    it('rejects invalid format', () => {
      const res = validateTimeWindow('9:00 - 12:00');
      expect(res.valid).toBe(false);
      expect(res.error).toBe('Nhập khung giờ HH:mm - HH:mm, giờ kết thúc phải sau giờ bắt đầu.');
    });

    it('rejects time window where end time equals start time', () => {
      const res = validateTimeWindow('10:00 - 10:00');
      expect(res.valid).toBe(false);
      expect(res.error).toBe('Nhập khung giờ HH:mm - HH:mm, giờ kết thúc phải sau giờ bắt đầu.');
    });

    it('rejects time window where end time is earlier than start time', () => {
      const res = validateTimeWindow('12:00 - 09:00');
      expect(res.valid).toBe(false);
      expect(res.error).toBe('Nhập khung giờ HH:mm - HH:mm, giờ kết thúc phải sau giờ bắt đầu.');
    });
  });

  describe('validateEnrollKioskForm', () => {
    const validData = {
      code: 'K-HCM-01',
      name: 'Kiosk District 1',
      hardwareId: 'ESP32-12345',
      slotCount: 4,
    };

    it('accepts valid kiosk enrollment data', () => {
      expect(validateEnrollKioskForm(validData).valid).toBe(true);
      expect(validateEnrollKioskForm({ ...validData, slotCount: 1 }).valid).toBe(true);
      expect(validateEnrollKioskForm({ ...validData, slotCount: 50 }).valid).toBe(true);
    });

    it('rejects missing or empty fields', () => {
      expect(validateEnrollKioskForm({ ...validData, code: '   ' }).valid).toBe(false);
      expect(validateEnrollKioskForm({ ...validData, name: '' }).valid).toBe(false);
      expect(validateEnrollKioskForm({ ...validData, hardwareId: '' }).valid).toBe(false);
    });

    it('rejects code shorter than 2 chars', () => {
      const res = validateEnrollKioskForm({ ...validData, code: 'A' });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Mã tủ và Hardware ID cần ít nhất 2 ký tự');
    });

    it('rejects name longer than 120 chars', () => {
      const res = validateEnrollKioskForm({ ...validData, name: 'A'.repeat(121) });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('tên tủ từ 2 đến 120 ký tự');
    });

    it('rejects slots less than 1 or non-integer', () => {
      expect(validateEnrollKioskForm({ ...validData, slotCount: 0 }).valid).toBe(false);
      expect(validateEnrollKioskForm({ ...validData, slotCount: 1.5 }).valid).toBe(false);
    });

    it('rejects total slots exceeding 50', () => {
      const res = validateEnrollKioskForm({ ...validData, slotCount: 51 });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('từ 1 đến 50');
    });
  });

  describe('reason and note validations', () => {
    it('validateConfirmNote enforces 5 chars minimum', () => {
      expect(validateConfirmNote('OK').valid).toBe(false);
      expect(validateConfirmNote('12345').valid).toBe(true);
    });

    it('validateRejectReason enforces 5 chars minimum', () => {
      expect(validateRejectReason('abc').valid).toBe(false);
      expect(validateRejectReason('Không đủ điều kiện').valid).toBe(true);
    });

    it('validateReworkReason enforces 5 chars minimum', () => {
      expect(validateReworkReason('re').valid).toBe(false);
      expect(validateReworkReason('Chụp lại góc ảnh').valid).toBe(true);
    });

    it('validatePlatformFailureReason enforces 5 chars minimum', () => {
      expect(validatePlatformFailureReason('lỗi').valid).toBe(false);
      expect(validatePlatformFailureReason('Mặt bằng bị thu hồi').valid).toBe(true);
    });

    it('validateReportText enforces 10 chars minimum', () => {
      expect(validateReportText('Xong việc').valid).toBe(false);
      expect(validateReportText('Đã hoàn thành lắp đặt đúng quy trình').valid).toBe(true);
    });
  });

  describe('validateEvidenceFile', () => {
    it('rejects null file', () => {
      const res = validateEvidenceFile(null);
      expect(res.valid).toBe(false);
      expect(res.error).toBe('Vui lòng chọn file ảnh.');
    });

    it('rejects unsupported mime types', () => {
      const file = new File(['fake-content'], 'test.pdf', { type: 'application/pdf' });
      const res = validateEvidenceFile(file);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('PNG, JPEG hoặc WebP');
    });

    it('rejects empty file (0 bytes)', () => {
      const file = new File([], 'test.png', { type: 'image/png' });
      const res = validateEvidenceFile(file);
      expect(res.valid).toBe(false);
    });

    it('accepts valid PNG, JPEG, WebP files', () => {
      const filePng = new File(['content'], 'test.png', { type: 'image/png' });
      expect(validateEvidenceFile(filePng).valid).toBe(true);

      const fileJpeg = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      expect(validateEvidenceFile(fileJpeg).valid).toBe(true);

      const fileWebp = new File(['content'], 'test.webp', { type: 'image/webp' });
      expect(validateEvidenceFile(fileWebp).valid).toBe(true);
    });
  });

  describe('step calculations and formatting', () => {
    it('getOperationsActiveStep correctly maps status', () => {
      expect(getOperationsActiveStep('PAID_REVIEW', false)).toBe(0);
      expect(getOperationsActiveStep('CONFIRMED', true)).toBe(1);
      expect(getOperationsActiveStep('SCHEDULED', true)).toBe(1);
      expect(getOperationsActiveStep('INSTALLING', false)).toBe(2);
      expect(getOperationsActiveStep('AWAITING_HANDOVER', false)).toBe(2);
      expect(getOperationsActiveStep('ACTIVE', false)).toBe(3);
      expect(getOperationsActiveStep('CANCELLED', false)).toBe(-1);
    });

    it('getTechnicianStepIndex correctly maps status', () => {
      expect(getTechnicianStepIndex('SCHEDULED')).toBe(0);
      expect(getTechnicianStepIndex('INSTALLING')).toBe(1);
      expect(getTechnicianStepIndex('AWAITING_HANDOVER')).toBe(2);
      expect(getTechnicianStepIndex('ACTIVE')).toBe(3);
      expect(getTechnicianStepIndex('UNKNOWN')).toBe(0);
    });

    it('formatDateVN formats date correctly or returns fallback', () => {
      expect(formatDateVN(null)).toBe('Chưa có ngày');
      expect(formatDateVN(undefined)).toBe('Chưa có ngày');
      expect(formatDateVN('2026-11-10T00:00:00Z')).toBe('10/11/2026');
    });
  });
});
