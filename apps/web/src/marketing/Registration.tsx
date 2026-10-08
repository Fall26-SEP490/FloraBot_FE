'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registrationSchema, packages, type RegistrationInput } from '@florabot/contracts';
import { ArrowUpRight, Button, useHydrated } from '@florabot/ui';

export default function Registration() {
  const ready = useHydrated();
  const [status, setStatus] = useState('');
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegistrationInput>({
    resolver: zodResolver(registrationSchema),
    defaultValues: { packageId: packages[0].id, website: '' },
  });
  useEffect(() => {
    const choose = (event: Event) => {
      if (sent) return;
      const id: unknown =
        (event as CustomEvent).detail || document.documentElement.dataset.selectedPackage;
      const selected = packages.find((p) => p.id === id);
      if (selected) {
        setValue('packageId', selected.id);
        setStatus(`Đã chọn gói ${selected.name}.`);
      }
    };
    window.addEventListener('florabot:package', choose);
    choose(new Event('initial-package'));
    return () => window.removeEventListener('florabot:package', choose);
  }, [setValue, sent]);
  async function submit(values: RegistrationInput) {
    setStatus('Đang gửi đăng ký…');
    try {
      const response = await fetch(`${'/api'}/sellers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          errors?: Record<string, string[]>;
        };
        if (body.errors) {
          let focused = false;
          for (const [key, messages] of Object.entries(body.errors))
            if (key in values && messages[0]) {
              setError(
                key as keyof RegistrationInput,
                { message: messages[0] },
                { shouldFocus: !focused },
              );
              focused = true;
            }
        }
        throw new Error(
          response.status === 429
            ? 'Bạn gửi quá nhanh. Vui lòng thử lại sau một phút.'
            : 'Chưa gửi được đăng ký. Thông tin vẫn được giữ, bạn thử lại nhé.',
        );
      }
      setSent(true);
      setStatus('Đã nhận đăng ký. FloraBot sẽ liên hệ qua số điện thoại của bạn. Chưa thu phí.');
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError')
      ) {
        setStatus('Kết nối quá lâu. Thông tin vẫn được giữ, bạn thử lại nhé.');
      } else if (error instanceof TypeError) {
        setStatus('Kết nối bị gián đoạn. Kiểm tra mạng rồi thử lại.');
      } else {
        setStatus(
          error instanceof Error ? error.message : 'Chưa gửi được đăng ký. Vui lòng thử lại.',
        );
      }
    }
  }
  return (
    <form onSubmit={handleSubmit(submit)} noValidate aria-label="Đăng ký tư vấn">
      <div className="form-fields">
        <div>
          <label htmlFor="shop-name">Tên shop</label>
          <input
            type="text"
            id="shop-name"
            autoComplete="organization"
            {...register('shopName')}
            aria-invalid={!!errors.shopName}
            aria-describedby={errors.shopName ? 'shop-error' : undefined}
            disabled={sent}
          />
          {errors.shopName && (
            <p className="field-error" id="shop-error">
              {errors.shopName.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="phone">Số điện thoại</label>
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            {...register('phone')}
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? 'phone-error' : undefined}
            disabled={sent}
          />
          {errors.phone && (
            <p className="field-error" id="phone-error">
              {errors.phone.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="area">Khu vực của shop</label>
          <input
            type="text"
            id="area"
            autoComplete="address-level2"
            {...register('area')}
            aria-invalid={!!errors.area}
            aria-describedby={errors.area ? 'area-error' : undefined}
            disabled={sent}
          />
          {errors.area && (
            <p className="field-error" id="area-error">
              {errors.area.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="package">Gói quan tâm</label>
          <select
            id="package"
            {...register('packageId')}
            disabled={sent}
            aria-invalid={!!errors.packageId}
            aria-describedby={errors.packageId ? 'package-error' : undefined}
          >
            {packages.map((p) => (
              <option value={p.id} key={p.id}>
                {p.name} · {p.slots} ô
              </option>
            ))}
          </select>
          {errors.packageId && (
            <p className="field-error" id="package-error">
              {errors.packageId.message}
            </p>
          )}
        </div>
      </div>
      <div className="honeypot" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" tabIndex={-1} autoComplete="off" {...register('website')} />
      </div>
      <p className="form-privacy">
        FloraBot sẽ liên hệ để tư vấn gói thuê.{' '}
        <a href="/chinh-sach-rieng-tu">Chính sách riêng tư</a>.
      </p>
      <Button type="submit" disabled={!ready || isSubmitting || sent}>
        {isSubmitting ? 'Đang gửi…' : sent ? 'Đã gửi đăng ký' : 'Đăng ký tư vấn'}
        <ArrowUpRight size={20} aria-hidden="true" />
      </Button>
      <p role="status" aria-live="polite" className="form-status">
        {status}
      </p>
    </form>
  );
}
