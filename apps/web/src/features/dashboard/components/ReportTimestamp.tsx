export default function ReportTimestamp({
  value,
  dateOnly = false,
}: {
  value: string;
  dateOnly?: boolean;
}) {
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00+07:00` : value);
  const day = parsed.toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const hour = dateOnly
    ? ''
    : parsed.toLocaleTimeString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
      });
  return (
    <time dateTime={value} style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
      {day}
      {hour ? ` ${hour}` : ''}
    </time>
  );
}
