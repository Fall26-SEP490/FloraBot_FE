import { describe, expect, it } from 'vitest';
import { registrationSchema, packages } from '../packages/contracts/src/index';
describe('Seller registration validation', () => {
  const valid = {
    shopName: 'Hoa Mộc',
    phone: '0901234567',
    area: 'Thủ Đức',
    packageId: packages[0].id,
  };
  it('accepts Vietnamese contact details without requiring extra personal data', () =>
    expect(registrationSchema.safeParse(valid).success).toBe(true));
  it('rejects phone, package and honeypot tampering', () => {
    expect(registrationSchema.safeParse({ ...valid, phone: 'abc' }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...valid, packageId: 'fake' }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...valid, website: 'spam.example' }).success).toBe(false);
  });
  it('trims before length validation and preserves Vietnamese error messages', () => {
    expect(
      registrationSchema.parse({ ...valid, shopName: '  Hoa Mộc  ', area: ' Thủ Đức ' }),
    ).toEqual(valid);
    const result = registrationSchema.safeParse({ ...valid, shopName: ' a ', area: ' ' });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues.map((issue) => [issue.path[0], issue.message])).toEqual([
        ['shopName', 'Nhập tên shop từ 2 ký tự.'],
        ['area', 'Nhập khu vực của shop.'],
      ]);
    expect(
      registrationSchema.safeParse({
        ...valid,
        shopName: 'x'.repeat(120),
        area: 'x'.repeat(200),
        phone: '+84901234567',
        website: '',
      }).success,
    ).toBe(true);
    const oversized = registrationSchema.safeParse({
      ...valid,
      shopName: 'x'.repeat(121),
      area: 'x'.repeat(201),
    });
    expect(oversized.success).toBe(false);
    if (!oversized.success)
      expect(oversized.error.issues.map((issue) => issue.message)).toEqual([
        'Tên shop tối đa 120 ký tự.',
        'Khu vực tối đa 200 ký tự.',
      ]);
  });
});
