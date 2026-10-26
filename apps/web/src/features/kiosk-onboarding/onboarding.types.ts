import type { CreateKioskApplicationRequest } from '../../kioskApplicationTypes';

export interface KioskApplicationFormDraft {
  packageId: string;
  shopName: string;
  phone: string;
  contactEmail: string;
  installationAddress: string;
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
