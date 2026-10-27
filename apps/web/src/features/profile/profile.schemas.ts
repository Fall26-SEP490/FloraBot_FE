export const phonePattern = /^(0[35789][0-9]{8}|\+84[35789][0-9]{8})$/;
export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const asciiAlphanumeric = /^[A-Za-z0-9]{4,34}$/;

export const hasControlChars = (value: string): boolean =>
  Array.from(value).some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127);
