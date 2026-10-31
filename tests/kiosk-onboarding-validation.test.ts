import { describe, expect, it } from 'vitest';
import { validateKioskApplicationDraft } from '../apps/web/src/features/kiosk-onboarding/onboarding.utils';
import type { KioskApplicationFormDraft } from '../apps/web/src/features/kiosk-onboarding/onboarding.types';

const validDraft: KioskApplicationFormDraft = {
  packageId: 'pkg-standard',
  shopName: 'Tiệm Hoa Hướng Dương',
  phone: '0901234567',
  contactEmail: 'contact@huongduong.vn',
  installationAddress: '123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM',
  latInput: '10.776889',
  lonInput: '106.700806',
  bankName: 'Vietcombank',
  bankHolder: 'NGUYEN VAN A',
  bankAccountNumber: '0123456789',
};

describe('validateKioskApplicationDraft Unit Tests', () => {
  it('passes a fully valid draft and returns sanitized trimmed payload', () => {
    const draft: KioskApplicationFormDraft = {
      ...validDraft,
      shopName: '  Tiệm Hoa Hướng Dương  ',
      phone: ' 0901234567 ',
      contactEmail: ' contact@huongduong.vn ',
      installationAddress: ' 123 Đường Nguyễn Huệ, Quận 1, TP.HCM ',
      bankName: ' Vietcombank ',
      bankHolder: ' NGUYEN VAN A ',
      bankAccountNumber: ' 0123456789 ',
    };

    const result = validateKioskApplicationDraft(draft);
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
    expect(result.sanitizedPayload).toEqual({
      packageId: 'pkg-standard',
      shopName: 'Tiệm Hoa Hướng Dương',
      phone: '0901234567',
      contactEmail: 'contact@huongduong.vn',
      installationAddress: '123 Đường Nguyễn Huệ, Quận 1, TP.HCM',
      latitude: 10.776889,
      longitude: 106.700806,
      bankName: 'Vietcombank',
      bankHolder: 'NGUYEN VAN A',
      bankAccountNumber: '0123456789',
    });
  });

  it('rejects missing packageId', () => {
    const result = validateKioskApplicationDraft({ ...validDraft, packageId: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors.package).toBe('Vui lòng chọn một gói thuê kiosk.');
  });

  describe('Shop Name Validation', () => {
    it('rejects empty and whitespace-only shop name', () => {
      const result = validateKioskApplicationDraft({ ...validDraft, shopName: '   ' });
      expect(result.isValid).toBe(false);
      expect(result.errors.shopName).toBe('Vui lòng nhập tên shop hoa.');
    });

    it('rejects shop name under 2 characters', () => {
      const result = validateKioskApplicationDraft({ ...validDraft, shopName: 'A' });
      expect(result.isValid).toBe(false);
      expect(result.errors.shopName).toBe('Tên shop phải có ít nhất 2 ký tự.');
    });

    it('accepts shop name exactly 2 characters and 120 characters', () => {
      expect(validateKioskApplicationDraft({ ...validDraft, shopName: 'AB' }).isValid).toBe(true);
      expect(
        validateKioskApplicationDraft({ ...validDraft, shopName: 'a'.repeat(120) }).isValid,
      ).toBe(true);
    });

    it('rejects shop name exceeding 120 characters', () => {
      const result = validateKioskApplicationDraft({ ...validDraft, shopName: 'a'.repeat(121) });
      expect(result.isValid).toBe(false);
      expect(result.errors.shopName).toBe('Tên shop không được vượt quá 120 ký tự.');
    });
  });

  describe('Phone Validation', () => {
    it('rejects empty phone', () => {
      const result = validateKioskApplicationDraft({ ...validDraft, phone: '' });
      expect(result.isValid).toBe(false);
      expect(result.errors.phone).toBe('Vui lòng nhập số điện thoại kinh doanh.');
    });

    it('accepts valid 10-digit Vietnam phone formats (03x, 05x, 07x, 08x, 09x and +84)', () => {
      expect(validateKioskApplicationDraft({ ...validDraft, phone: '0901234567' }).isValid).toBe(
        true,
      );
      expect(validateKioskApplicationDraft({ ...validDraft, phone: '0398765432' }).isValid).toBe(
        true,
      );
      expect(validateKioskApplicationDraft({ ...validDraft, phone: '0701234567' }).isValid).toBe(
        true,
      );
      expect(validateKioskApplicationDraft({ ...validDraft, phone: '0812345678' }).isValid).toBe(
        true,
      );
      expect(validateKioskApplicationDraft({ ...validDraft, phone: '0522345678' }).isValid).toBe(
        true,
      );
      expect(validateKioskApplicationDraft({ ...validDraft, phone: '+84901234567' }).isValid).toBe(
        true,
      );
    });

    it('rejects invalid phone numbers', () => {
      expect(validateKioskApplicationDraft({ ...validDraft, phone: '0123456789' }).isValid).toBe(
        false,
      );
      expect(validateKioskApplicationDraft({ ...validDraft, phone: '090123456' }).isValid).toBe(
        false,
      );
      expect(validateKioskApplicationDraft({ ...validDraft, phone: '09012345678' }).isValid).toBe(
        false,
      );
      expect(validateKioskApplicationDraft({ ...validDraft, phone: 'abcdefghij' }).isValid).toBe(
        false,
      );
    });
  });

  describe('Email Validation', () => {
    it('rejects empty email', () => {
      const result = validateKioskApplicationDraft({ ...validDraft, contactEmail: '' });
      expect(result.isValid).toBe(false);
      expect(result.errors.contactEmail).toBe('Vui lòng nhập email liên hệ công việc.');
    });

    it('rejects invalid email formats', () => {
      expect(
        validateKioskApplicationDraft({ ...validDraft, contactEmail: 'notanemail' }).isValid,
      ).toBe(false);
      expect(validateKioskApplicationDraft({ ...validDraft, contactEmail: 'test@' }).isValid).toBe(
        false,
      );
      expect(
        validateKioskApplicationDraft({ ...validDraft, contactEmail: 'test@domain' }).isValid,
      ).toBe(false);
    });

    it('rejects email exceeding 254 characters', () => {
      const longLocal = 'a'.repeat(245);
      const email = `${longLocal}@domain.com`;
      const result = validateKioskApplicationDraft({ ...validDraft, contactEmail: email });
      expect(result.isValid).toBe(false);
      expect(result.errors.contactEmail).toBe('Email không được vượt quá 254 ký tự.');
    });
  });

  describe('Installation Address Validation', () => {
    it('rejects empty and short addresses', () => {
      expect(
        validateKioskApplicationDraft({ ...validDraft, installationAddress: '' }).errors
          .installationAddress,
      ).toBe('Vui lòng nhập địa chỉ dự kiến đặt kiosk.');
      expect(
        validateKioskApplicationDraft({ ...validDraft, installationAddress: '123' }).errors
          .installationAddress,
      ).toBe('Địa chỉ lắp đặt quá ngắn, vui lòng ghi rõ số nhà, đường, phường/xã.');
    });

    it('accepts addresses with 5 or more characters and rejects unselected Goong address', () => {
      expect(
        validateKioskApplicationDraft({
          ...validDraft,
          addressSelected: false,
        }).errors.installationAddress,
      ).toBe('Vui lòng chọn một địa chỉ từ danh sách gợi ý của Goong.');
      expect(
        validateKioskApplicationDraft({ ...validDraft, installationAddress: '12345' }).isValid,
      ).toBe(true);
      expect(
        validateKioskApplicationDraft({ ...validDraft, installationAddress: '12345' }).isValid,
      ).toBe(true);
    });
  });

  describe('Coordinates Validation & Stale Coordinate Prevention', () => {
    it('accepts 0,0 as mathematically valid coordinates', () => {
      const result = validateKioskApplicationDraft({
        ...validDraft,
        latInput: '0',
        lonInput: '0',
      });
      expect(result.isValid).toBe(true);
      expect(result.sanitizedPayload?.latitude).toBe(0);
      expect(result.sanitizedPayload?.longitude).toBe(0);
    });

    it('rejects blank / whitespace coordinates (Blank != 0)', () => {
      const result = validateKioskApplicationDraft({
        ...validDraft,
        latInput: '',
        lonInput: '106.7',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.coordinates).toContain('ô trống không đồng nghĩa với 0');
    });

    it('accepts boundary coordinates 90/-90 and 180/-180', () => {
      expect(
        validateKioskApplicationDraft({ ...validDraft, latInput: '90', lonInput: '180' }).isValid,
      ).toBe(true);
      expect(
        validateKioskApplicationDraft({ ...validDraft, latInput: '-90', lonInput: '-180' }).isValid,
      ).toBe(true);
    });

    it('rejects out-of-range coordinates (> 90 lat, > 180 lon)', () => {
      const highLat = validateKioskApplicationDraft({ ...validDraft, latInput: '90.0001' });
      expect(highLat.isValid).toBe(false);
      expect(highLat.errors.coordinates).toContain('-90 đến 90');

      const highLon = validateKioskApplicationDraft({ ...validDraft, lonInput: '180.0001' });
      expect(highLon.isValid).toBe(false);
      expect(highLon.errors.coordinates).toContain('-180 đến 180');
    });

    it('rejects invalid string coordinate input preventing stale coordinates submission', () => {
      const invalid = validateKioskApplicationDraft({
        ...validDraft,
        latInput: 'abc',
        lonInput: '106.7',
      });
      expect(invalid.isValid).toBe(false);
      expect(invalid.errors.coordinates).toContain('phải là một số hợp lệ');
      expect(invalid.sanitizedPayload).toBeNull();
    });
  });

  describe('Bank Account Details Validation', () => {
    it('rejects empty bank name, holder, or account number', () => {
      expect(validateKioskApplicationDraft({ ...validDraft, bankName: '' }).errors.bankName).toBe(
        'Vui lòng nhập tên ngân hàng.',
      );
      expect(
        validateKioskApplicationDraft({ ...validDraft, bankHolder: '' }).errors.bankHolder,
      ).toBe('Vui lòng nhập tên chủ tài khoản thụ hưởng.');
      expect(
        validateKioskApplicationDraft({ ...validDraft, bankAccountNumber: '' }).errors
          .bankAccountNumber,
      ).toBe('Vui lòng nhập số tài khoản ngân hàng.');
    });

    it('rejects bank account fields below minimum length boundaries', () => {
      expect(validateKioskApplicationDraft({ ...validDraft, bankName: 'V' }).errors.bankName).toBe(
        'Tên ngân hàng cần ít nhất 2 ký tự.',
      );
      expect(
        validateKioskApplicationDraft({ ...validDraft, bankHolder: 'A' }).errors.bankHolder,
      ).toBe('Tên chủ tài khoản cần ít nhất 2 ký tự.');
      expect(
        validateKioskApplicationDraft({ ...validDraft, bankAccountNumber: '123' }).errors
          .bankAccountNumber,
      ).toBe('Số tài khoản cần ít nhất 4 ký tự.');
    });

    it('accepts valid bank account details at boundary minimums', () => {
      const result = validateKioskApplicationDraft({
        ...validDraft,
        bankName: 'MB',
        bankHolder: 'LE',
        bankAccountNumber: '1234',
      });
      expect(result.isValid).toBe(true);
    });

    it('rejects bank account number exceeding 34 characters', () => {
      const result = validateKioskApplicationDraft({
        ...validDraft,
        bankAccountNumber: '1'.repeat(35),
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.bankAccountNumber).toBe('Số tài khoản không được vượt quá 34 ký tự.');
    });

    it('rejects bank account number containing special characters or spaces', () => {
      const result = validateKioskApplicationDraft({
        ...validDraft,
        bankAccountNumber: '0123-4567-89',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.bankAccountNumber).toBe(
        'Số tài khoản chỉ bao gồm chữ số hoặc chữ cái không dấu.',
      );
    });
  });
});
