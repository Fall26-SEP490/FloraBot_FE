import type { KioskApplicationResponse } from '../installations/installations.types';
import { rentalMoney } from './kiosk-pricing';

export function rentalAllocation(
  app: Pick<
    KioskApplicationResponse,
    'walkInSlots' | 'preorderSlots' | 'totalSlots' | 'pricingMode' | 'packageName'
  >,
) {
  return app.pricingMode === 'SLOT_PRICING'
    ? `${app.walkInSlots ?? 'Chưa rõ'} ô Walk-in · ${app.preorderSlots ?? 'Chưa rõ'} ô Pre-order`
    : `${app.packageName} · ${app.totalSlots} ô (hồ sơ cũ)`;
}
export function ApplicationRentalSummary({
  application: app,
}: {
  application: KioskApplicationResponse;
}) {
  return (
    <div>
      <strong>{rentalAllocation(app)}</strong>
      {app.pricingMode === 'SLOT_PRICING' && (
        <p>
          Walk-in:{' '}
          {app.walkInAnnualPrice == null ? 'Chưa có đơn giá' : rentalMoney(app.walkInAnnualPrice)}
          /ô/năm · Pre-order:{' '}
          {app.preorderAnnualPrice == null
            ? 'Chưa có đơn giá'
            : rentalMoney(app.preorderAnnualPrice)}
          /ô/năm
        </p>
      )}
      <p>
        Phí đã chốt: <strong>{rentalMoney(app.annualFee)}/năm</strong> · Tổng {app.totalSlots} ô
      </p>
      <p>12 tháng từ ngày bàn giao.</p>
    </div>
  );
}
