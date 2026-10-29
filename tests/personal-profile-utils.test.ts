import { describe, expect, it } from 'vitest';
import {
  basicPayload,
  basicValues,
  maskProfile,
  validBirthDate,
  type ProfileResponse,
} from '../apps/web/src/features/profile/profile.utils';

const profile: ProfileResponse = {
  id: '10000000-0000-0000-0000-000000000001',
  fullName: 'Người dùng test',
  loginEmail: 'test@example.test',
  phone: null,
  address: null,
  contactEmail: 'test@example.test',
  contactEmailIsDefault: true,
  contactEmailVerified: false,
  gender: 'FEMALE',
  dateOfBirth: '2004-02-29',
  bank: {
    bankName: 'Ngân hàng test',
    accountHolder: 'TEST',
    hasAccount: true,
    accountLast4: '7890',
    accountNumber: '001234567890',
    status: 'READY',
  },
};

describe('Personal profile contract boundaries', () => {
  it('removes raw account numbers before any profile result can enter query cache', () => {
    const masked = maskProfile(profile);
    expect(masked.bank).not.toHaveProperty('accountNumber');
    expect(JSON.stringify(masked)).not.toContain('001234567890');
    expect(masked.bank?.status).toBe('READY');
    expect(profile.bank?.accountNumber).toBe('001234567890');
  });
  it('preserves demographics and handles profiles with no personal bank', () => {
    expect(basicValues(maskProfile({ ...profile, bank: null }))).toMatchObject({
      gender: 'FEMALE',
      dateOfBirth: '2004-02-29',
      phone: '',
      address: '',
    });
  });
  it('uses explicit clear flags for erased demographics instead of sending null', () => {
    expect(
      basicPayload({
        fullName: '  Người dùng  ',
        phone: ' ',
        address: ' ',
        gender: '',
        dateOfBirth: '',
      }),
    ).toEqual({
      fullName: 'Người dùng',
      phone: null,
      address: null,
      clearGender: true,
      clearDateOfBirth: true,
    });
  });
  it('keeps selected demographics without contradictory clear flags', () => {
    expect(basicPayload(basicValues(maskProfile(profile)))).toMatchObject({
      gender: 'FEMALE',
      dateOfBirth: '2004-02-29',
    });
    expect(basicPayload(basicValues(maskProfile(profile)))).not.toHaveProperty('clearDateOfBirth');
  });
  it.each(['0000-01-01', '2025-02-29', '2026-13-01', '2026-10-30', 'invalid'])(
    'rejects impossible or future date %s',
    (value) => {
      expect(validBirthDate(value, '2026-10-29')).toBe(false);
    },
  );
  it.each(['', '2004-02-29', '2026-10-29'])(
    'accepts optional, leap-day or today date %s',
    (value) => {
      expect(validBirthDate(value, '2026-10-29')).toBe(true);
    },
  );
});
