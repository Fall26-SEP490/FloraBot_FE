import type { CreateKioskApplicationRequest } from '../installations/installations.types';

export type KioskLocationSource = 'none' | 'suggestion' | 'map' | 'gps';

export interface KioskApplicationFormDraft {
  packageId: string;
  shopName: string;
  phone: string;
  contactEmail: string;
  installationAddress: string;
  addressSelected?: boolean;
  latInput: string;
  lonInput: string;
  bankName: string;
  bankHolder: string;
  bankAccountNumber: string;
}

export interface KioskValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  sanitizedPayload: CreateKioskApplicationRequest | null;
}
