import { KIOSK_STATUS_LABELS } from './installations.constants';
export function managerApplicationAction(status: string) {
  return (
    (
      {
        PAID_REVIEW: 'Xác nhận liên hệ',
        CONFIRMED: 'Xếp lịch',
        SCHEDULED: 'Xem lịch',
        INSTALLING: 'Theo dõi lắp đặt',
        AWAITING_HANDOVER: 'Kiểm tra bàn giao',
      } as Record<string, string>
    )[status] ?? 'Chi tiết'
  );
}
export function validApplicationStatus(status: string | null) {
  return status && Object.hasOwn(KIOSK_STATUS_LABELS, status) ? status : 'ALL';
}
