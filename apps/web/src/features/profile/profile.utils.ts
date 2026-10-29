import type { components } from '../../../../../packages/contracts/src/generated/api';
import type { AccountProfile, BasicFormValues, UpdateProfilePayload } from './profile.types';

export type ProfileResponse = components['schemas']['UserProfileResponse'];

// Consolidated profile reads include the raw bank number. Never put it in query data.
export function maskProfile(profile: ProfileResponse): AccountProfile {
  const bank = profile.bank;
  return {
    ...profile,
    bank: bank
      ? {
          bankName: bank.bankName,
          accountHolder: bank.accountHolder,
          accountLast4: bank.accountLast4,
          hasAccount: bank.hasAccount,
          status: bank.status,
        }
      : null,
  };
}

export function basicValues(profile: AccountProfile): BasicFormValues {
  return {
    fullName: profile.fullName,
    phone: profile.phone ?? '',
    address: profile.address ?? '',
    gender: profile.gender ?? '',
    dateOfBirth: profile.dateOfBirth ?? '',
  };
}

export function basicPayload(values: BasicFormValues): UpdateProfilePayload {
  return {
    fullName: values.fullName.trim(),
    phone: values.phone.trim() || null,
    address: values.address.trim() || null,
    ...(values.gender ? { gender: values.gender } : { clearGender: true }),
    ...(values.dateOfBirth ? { dateOfBirth: values.dateOfBirth } : { clearDateOfBirth: true }),
  };
}

export const vietnamToday = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

export function validBirthDate(value: string, today = vietnamToday()): boolean {
  if (!value) return true;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value >= '0001-01-01' &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    value <= today
  );
}
