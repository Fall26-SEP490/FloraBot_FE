'use client';

import { useId } from 'react';
import { rentalMoney, rentalTotal, type KioskSlotPricing } from './kiosk-pricing';
import './kiosk-pricing.css';

export function SlotDemandFields({
  pricing,
  walkInSlots,
  preorderSlots,
  onChange,
  disabled = false,
}: {
  pricing: KioskSlotPricing;
  walkInSlots: number;
  preorderSlots: number;
  onChange: (walk: number, preorder: number) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const total = rentalTotal(pricing, walkInSlots, preorderSlots);
  return (
    <fieldset className="slot-demand" disabled={disabled}>
      <legend>Số ô bạn muốn thuê</legend>
      <div className="slot-demand-inputs">
        <div>
          <label htmlFor={`${id}-walk`}>Ô bán sẵn (Walk-in)</label>
          <p id={`${id}-walk-hint`}>Nạp hoa để khách mua ngay tại tủ.</p>
          <strong>{rentalMoney(pricing.walkInAnnualPrice!)} / ô / năm</strong>
          <input
            id={`${id}-walk`}
            type="number"
            min={0}
            max={50}
            step={1}
            value={Number.isNaN(walkInSlots) ? '' : walkInSlots}
            aria-describedby={`${id}-walk-hint ${id}-total`}
            onChange={(e) =>
              onChange(e.target.value === '' ? NaN : Number(e.target.value), preorderSlots)
            }
          />
        </div>
        <div>
          <label htmlFor={`${id}-preorder`}>Ô đặt trước (Pre-order)</label>
          <p id={`${id}-preorder-hint`}>Chuẩn bị hoa cho khách nhận theo lịch hẹn.</p>
          <strong>{rentalMoney(pricing.preorderAnnualPrice!)} / ô / năm</strong>
          <input
            id={`${id}-preorder`}
            type="number"
            min={0}
            max={50}
            step={1}
            value={Number.isNaN(preorderSlots) ? '' : preorderSlots}
            aria-describedby={`${id}-preorder-hint ${id}-total`}
            onChange={(e) =>
              onChange(walkInSlots, e.target.value === '' ? NaN : Number(e.target.value))
            }
          />
        </div>
      </div>
      <div id={`${id}-total`} className="slot-demand-total" aria-live="polite">
        {total === null ? (
          <p role="status">Nhập số ô nguyên, không âm; tổng từ 1 đến 50 ô.</p>
        ) : (
          <>
            <span>Tổng {walkInSlots + preorderSlots} ô · 12 tháng từ ngày bàn giao</span>
            <strong>{rentalMoney(total)} / năm</strong>
          </>
        )}
      </div>
      <p className="slot-demand-note">
        Sau khi kiosk hoạt động, bạn có thể gửi yêu cầu đổi số ô Walk-in / Pre-order (tổng số ô giữ
        nguyên).
      </p>
    </fieldset>
  );
}
