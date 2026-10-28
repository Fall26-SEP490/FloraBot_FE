import type {
  AccountProfile,
  BankRevealResponse,
  ContactEmailChallenge,
  UpdateProfilePayload,
  Session,
} from '@/shared/lib/api';

export type {
  AccountProfile,
  BankRevealResponse,
  ContactEmailChallenge,
  UpdateProfilePayload,
  Session,
};

export interface BasicFormValues {
  fullName: string;
  phone: string;
  address: string;
}

export interface BankFormValues {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
}

export type BankMode = 'idle' | 'edit' | 'review' | 'clear-confirm';
export type ContactMode = 'idle' | 'requesting' | 'otp';
