import { parseAndValidateCoordinate } from '../installations/installations.utils';
const PHONE_REGEX = /^(0[35789][0-9]{8}|\+84[35789][0-9]{8})$/;
const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
import type { KioskApplicationFormDraft, KioskValidationResult } from './onboarding.types';

export function validateKioskApplicationDraft(
  draft: KioskApplicationFormDraft,
): KioskValidationResult {
  const errors: Record<string, string> = {};

  if (!draft.packageId) {
    errors.package = 'Vui lòng chọn một gói thuê kiosk.';
  }

  const trimmedShopName = draft.shopName.trim();
  if (!trimmedShopName) {
    errors.shopName = 'Vui lòng nhập tên shop hoa.';
  } else if (trimmedShopName.length < 2) {
    errors.shopName = 'Tên shop phải có ít nhất 2 ký tự.';
  } else if (trimmedShopName.length > 120) {
    errors.shopName = 'Tên shop không được vượt quá 120 ký tự.';
  }

  const trimmedPhone = draft.phone.trim();
  if (!trimmedPhone) {
    errors.phone = 'Vui lòng nhập số điện thoại kinh doanh.';
  } else if (!PHONE_REGEX.test(trimmedPhone)) {
    errors.phone = 'Số điện thoại không đúng định dạng Việt Nam (ví dụ: 0901234567).';
  }

  const trimmedEmail = draft.contactEmail.trim();
  if (!trimmedEmail) {
    errors.contactEmail = 'Vui lòng nhập email liên hệ công việc.';
  } else if (!EMAIL_REGEX.test(trimmedEmail)) {
    errors.contactEmail = 'Email không đúng định dạng.';
  } else if (trimmedEmail.length > 254) {
    errors.contactEmail = 'Email không được vượt quá 254 ký tự.';
  }

  const trimmedAddress = draft.installationAddress.trim();
  if (!trimmedAddress) {
    errors.installationAddress = 'Vui lòng nhập địa chỉ dự kiến đặt kiosk.';
  } else if (trimmedAddress.length < 5) {
    errors.installationAddress =
      'Địa chỉ lắp đặt quá ngắn, vui lòng ghi rõ số nhà, đường, phường/xã.';
  }

  // Coordinates check: parse current text directly; blank is NOT zero!
  const latResult = parseAndValidateCoordinate(draft.latInput, 'lat');
  const lonResult = parseAndValidateCoordinate(draft.lonInput, 'lon');

  if (
    !latResult.valid ||
    !lonResult.valid ||
    latResult.value === null ||
    lonResult.value === null
  ) {
    errors.coordinates =
      latResult.error ||
      lonResult.error ||
      'Vui lòng ghim vị trí trên bản đồ hoặc nhập tọa độ vĩ độ/kinh độ hợp lệ (ô trống không đồng nghĩa với 0).';
  }

  const trimmedBankName = draft.bankName.trim();
  if (!trimmedBankName) {
    errors.bankName = 'Vui lòng nhập tên ngân hàng.';
  } else if (trimmedBankName.length < 2) {
    errors.bankName = 'Tên ngân hàng cần ít nhất 2 ký tự.';
  }

  const trimmedBankHolder = draft.bankHolder.trim();
  if (!trimmedBankHolder) {
    errors.bankHolder = 'Vui lòng nhập tên chủ tài khoản thụ hưởng.';
  } else if (trimmedBankHolder.length < 2) {
    errors.bankHolder = 'Tên chủ tài khoản cần ít nhất 2 ký tự.';
  }

  const trimmedAccountNumber = draft.bankAccountNumber.trim();
  if (!trimmedAccountNumber) {
    errors.bankAccountNumber = 'Vui lòng nhập số tài khoản ngân hàng.';
  } else if (trimmedAccountNumber.length < 4) {
    errors.bankAccountNumber = 'Số tài khoản cần ít nhất 4 ký tự.';
  } else if (trimmedAccountNumber.length > 34) {
    errors.bankAccountNumber = 'Số tài khoản không được vượt quá 34 ký tự.';
  } else if (!/^[A-Za-z0-9]+$/.test(trimmedAccountNumber)) {
    errors.bankAccountNumber = 'Số tài khoản chỉ bao gồm chữ số hoặc chữ cái không dấu.';
  }

  const isValid = Object.keys(errors).length === 0;

  return {
    isValid,
    errors,
    sanitizedPayload: isValid
      ? {
          packageId: draft.packageId,
          shopName: trimmedShopName,
          phone: trimmedPhone,
          contactEmail: trimmedEmail,
          installationAddress: trimmedAddress,
          latitude: latResult.value!,
          longitude: lonResult.value!,
          bankName: trimmedBankName,
          bankHolder: trimmedBankHolder,
          bankAccountNumber: trimmedAccountNumber,
        }
      : null,
  };
}
