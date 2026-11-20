export function vietnamDateTime(value: string | Date = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 16);
}
export function vietnamDate(value: string | Date = new Date()): string {
  return vietnamDateTime(value).slice(0, 10);
}
export function vietnamDateTimeToUtc(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Chọn ngày và giờ hợp lệ.');
  const date = new Date(`${value}:00+07:00`);
  if (vietnamDateTime(date) !== value) throw new Error('Chọn ngày và giờ hợp lệ.');
  return date.toISOString();
}
export function displayVietnamDate(value: string, withTime = false, monthOnly = false): string {
  if (!value) return '';
  const [date, time] = value.split('T');
  const [year, month, day] = date.split('-');
  return monthOnly
    ? `${month}/${year}`
    : `${day}/${month}/${year}${withTime && time ? ` ${time}` : ''}`;
}
