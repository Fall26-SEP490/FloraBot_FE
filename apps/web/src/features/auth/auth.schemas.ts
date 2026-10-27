/**
 * Authentication validation rules and schemas.
 * Moved from MemberAuth screen component to prevent cross-feature imports.
 */

export const passwordRule = (value: string): true | string =>
  value.length < 12
    ? 'Dùng ít nhất 12 ký tự cho mật khẩu.'
    : new TextEncoder().encode(value).length <= 72 ||
      'Mật khẩu quá dài. Hãy rút ngắn, nhất là khi dùng nhiều ký tự có dấu.';
