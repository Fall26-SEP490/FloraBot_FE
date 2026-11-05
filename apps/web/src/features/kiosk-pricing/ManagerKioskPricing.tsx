'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { ApiError, queryClient, request } from '@/shared/lib/api';
import {
  kioskPricingKey,
  kioskPricingQuery,
  pricingReady,
  rentalMoney,
  type KioskSlotPricing,
} from './kiosk-pricing';
import './kiosk-pricing.css';

function PricingForm({ pricing, onSaved }: { pricing: KioskSlotPricing; onSaved: () => void }) {
  const [walk, setWalk] = useState(String(pricing.walkInAnnualPrice ?? ''));
  const [pre, setPre] = useState(String(pricing.preorderAnnualPrice ?? ''));
  const [message, setMessage] = useState('');
  const save = useMutation({
    mutationFn: () =>
      request<KioskSlotPricing>(
        '/operations/kiosk-pricing',
        {
          walkInAnnualPrice: Number(walk),
          preorderAnnualPrice: Number(pre),
          expectedVersion: pricing.version,
        },
        true,
        'PUT',
      ),
    onSuccess: async () => {
      onSaved();
      await queryClient.invalidateQueries({ queryKey: kioskPricingKey });
    },
    onError: (error) => {
      setMessage(
        error instanceof ApiError && error.status === 409
          ? 'Bảng giá đã được người khác cập nhật. Tải lại và kiểm tra giá trước khi lưu.'
          : error.message,
      );
    },
  });
  const valid = [walk, pre].every(
    (value) => value.trim() !== '' && Number.isSafeInteger(Number(value)) && Number(value) > 0,
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) save.mutate();
      }}
    >
      <p>Đơn giá cho một ô trong 12 tháng. Bảng giá mới chỉ áp dụng cho hồ sơ thuê mới.</p>
      <div className="slot-demand-inputs">
        <label>
          Giá ô Walk-in (đ/ô/năm)
          <input
            type="number"
            min={1}
            max={Number.MAX_SAFE_INTEGER}
            step={1}
            required
            value={walk}
            onChange={(e) => setWalk(e.target.value)}
            disabled={save.isPending}
          />
        </label>
        <label>
          Giá ô Pre-order (đ/ô/năm)
          <input
            type="number"
            min={1}
            max={Number.MAX_SAFE_INTEGER}
            step={1}
            required
            value={pre}
            onChange={(e) => setPre(e.target.value)}
            disabled={save.isPending}
          />
        </label>
      </div>
      {message && <p role={save.isError ? 'alert' : 'status'}>{message}</p>}
      {save.isError && (
        <Button
          type="button"
          variant="outline"
          onClick={() => void queryClient.invalidateQueries({ queryKey: kioskPricingKey })}
        >
          Tải lại bảng giá
        </Button>
      )}
      <Button
        type="submit"
        disabled={
          !valid ||
          save.isPending ||
          (save.isError && save.error instanceof ApiError && save.error.status === 409)
        }
      >
        {save.isPending ? 'Đang lưu…' : 'Lưu bảng giá'}
      </Button>
    </form>
  );
}
export default function ManagerKioskPricing() {
  const query = useQuery(kioskPricingQuery);
  const [saved, setSaved] = useState(false);
  return (
    <details className="kiosk-pricing-settings">
      <summary>
        Bảng giá thuê ô kiosk
        {pricingReady(query.data)
          ? ` · Walk-in ${rentalMoney(query.data!.walkInAnnualPrice!)} · Pre-order ${rentalMoney(query.data!.preorderAnnualPrice!)}/ô/năm`
          : ' · Chưa có bảng giá'}
      </summary>
      {query.isPending && <p role="status">Đang tải bảng giá…</p>}
      {query.isError && (
        <div role="alert">
          <p>Chưa tải được bảng giá.</p>
          <Button onClick={() => void query.refetch()}>Tải lại bảng giá</Button>
        </div>
      )}
      {saved && <p role="status">Đã lưu bảng giá. Giá đã chốt trên hồ sơ cũ được giữ nguyên.</p>}
      {query.data && (
        <PricingForm key={query.data.version} pricing={query.data} onSaved={() => setSaved(true)} />
      )}
    </details>
  );
}
