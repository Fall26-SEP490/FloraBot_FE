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
type ApplicationWithUniformPrice = KioskApplicationResponse & {
  annualSlotPrice?: number | null;
};

export function ApplicationRentalSummary({
  application: app,
}: {
  application: ApplicationWithUniformPrice;
}) {
  const unitPrice = app.annualSlotPrice ?? app.walkInAnnualPrice ?? app.preorderAnnualPrice ?? null;
  return (
    <div>
      <strong>{rentalAllocation(app)}</strong>
      {app.pricingMode === 'SLOT_PRICING' && (
        <p>
          Đơn giá ô: {unitPrice == null ? 'Chưa có đơn giá' : `${rentalMoney(unitPrice)}/ô/năm`}
        </p>
      )}
      <p>
        Phí đã chốt: <strong>{rentalMoney(app.annualFee)}/năm</strong> · Tổng {app.totalSlots} ô
      </p>
      <p>12 tháng từ ngày bàn giao.</p>
    </div>
  );
}
