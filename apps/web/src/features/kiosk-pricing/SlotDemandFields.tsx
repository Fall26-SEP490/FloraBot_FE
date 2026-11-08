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
  showSteppers = false,
}: {
  pricing: KioskSlotPricing;
  walkInSlots: number;
  preorderSlots: number;
  onChange: (walk: number, preorder: number) => void;
  disabled?: boolean;
  showSteppers?: boolean;
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
          <div className={showSteppers ? 'slot-quantity-control' : undefined}>
            {showSteppers && (
              <button
                type="button"
                aria-label="Giảm ô Walk-in"
                disabled={disabled || !Number.isFinite(walkInSlots) || walkInSlots <= 0}
                onClick={() => onChange(walkInSlots - 1, preorderSlots)}
              >
                −
              </button>
            )}
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
            {showSteppers && (
              <button
                type="button"
                aria-label="Tăng ô Walk-in"
                disabled={disabled || walkInSlots >= 50 || walkInSlots + preorderSlots >= 50}
                onClick={() =>
                  onChange((Number.isFinite(walkInSlots) ? walkInSlots : 0) + 1, preorderSlots)
                }
              >
                +
              </button>
            )}
          </div>
        </div>
        <div>
          <label htmlFor={`${id}-preorder`}>Ô đặt trước (Pre-order)</label>
          <p id={`${id}-preorder-hint`}>Chuẩn bị hoa cho khách nhận theo lịch hẹn.</p>
          <strong>{rentalMoney(pricing.preorderAnnualPrice!)} / ô / năm</strong>
          <div className={showSteppers ? 'slot-quantity-control' : undefined}>
            {showSteppers && (
              <button
                type="button"
                aria-label="Giảm ô Pre-order"
                disabled={disabled || !Number.isFinite(preorderSlots) || preorderSlots <= 0}
                onClick={() => onChange(walkInSlots, preorderSlots - 1)}
              >
                −
              </button>
            )}
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
            {showSteppers && (
              <button
                type="button"
                aria-label="Tăng ô Pre-order"
                disabled={disabled || preorderSlots >= 50 || walkInSlots + preorderSlots >= 50}
                onClick={() =>
                  onChange(walkInSlots, (Number.isFinite(preorderSlots) ? preorderSlots : 0) + 1)
                }
              >
                +
              </button>
            )}
          </div>
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
