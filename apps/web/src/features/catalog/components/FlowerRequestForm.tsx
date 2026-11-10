'use client';

import { catalogReturnPath } from '../catalog.navigation';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  Check,
  CheckCircle2,
  Clock,
  LogIn,
  MapPin,
  MessageSquare,
  ShieldCheck,
} from '@florabot/ui';
import { ApiError, queryClient, request, sessionQuery } from '@/shared/lib/api';
import type { CatalogItem, CatalogResponse } from '../catalog.types';
import { formatPrice, isPreorder, isPreorderSoldOut, isWalkIn } from '../catalog.utils';
import type { components } from '../../../../../../packages/contracts/src/generated/api';

interface FlowerRequestFormProps {
  item: CatalogItem;
  onOpenChat?: () => void;
  openingChat?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
  onUncertainChange?: (uncertain: boolean) => void;
}

export function FlowerRequestForm({
  item,
  onOpenChat,
  openingChat,
  onDirtyChange,
  onBusyChange,
  onUncertainChange,
}: FlowerRequestFormProps) {
  const session = useQuery(sessionQuery);
  const [kioskId, setKioskId] = useState(item.kioskId);
  const kiosks = useQuery({
    queryKey: ['catalog-pickup-kiosks', item.productId, item.sellerId],
    enabled: !item.isDemoSample && isPreorder(item),
    queryFn: async () => {
      const matches = new Map<string, CatalogItem>();
      let page = 1;
      let hasMore = true;
      while (hasMore && page <= 100) {
        const result = await request<CatalogResponse>(
          `/shop/catalog?page=${page}&search=${encodeURIComponent(item.name)}`,
        );
        for (const entry of result.items) {
          if (
            entry.productId === item.productId &&
            entry.sellerId === item.sellerId &&
            isPreorder(entry)
          ) {
            matches.set(entry.kioskId, entry);
          }
        }
        hasMore = result.hasMore;
        page++;
      }
      if (hasMore) throw new Error('Danh sách tủ nhận quá dài; chưa tải hết.');
      return [...matches.values()];
    },
  });
  const eligibleKiosks = kiosks.data ?? [item];
  const selectedKiosk = eligibleKiosks.find((entry) => entry.kioskId === kioskId);
  const [pickup, setPickup] = useState('');
  const pickupDateForEstimate = pickup ? new Date(pickup) : null;
  const availability = useQuery({
    queryKey: ['preorder-availability', kioskId, pickup],
    enabled: Boolean(
      kioskId && pickupDateForEstimate && Number.isFinite(pickupDateForEstimate.getTime()),
    ),
    queryFn: () =>
      request<components['schemas']['KioskPreorderAvailabilityResponse']>(
        `/kiosks/${kioskId}/preorder-availability?pickupAt=${encodeURIComponent(new Date(pickup).toISOString())}`,
      ),
    staleTime: 15_000,
  });
  const [instructions, setInstructions] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [stockConflict, setStockConflict] = useState(false);
  // A retry of an unconfirmed request can still succeed with its existing request ID.
  const soldOut = !uncertain && (stockConflict || isPreorderSoldOut(selectedKiosk ?? item));
  const [error, setError] = useState('');
  const [pickupError, setPickupError] = useState('');
  const [briefError, setBriefError] = useState('');
  const pickupRef = useRef<HTMLInputElement>(null);
  const briefRef = useRef<HTMLTextAreaElement>(null);
  const [done, setDone] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const dirty = !done && Boolean(pickup || instructions || confirmed || kioskId !== item.kioskId);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);
  useEffect(() => {
    onUncertainChange?.(uncertain);
  }, [uncertain, onUncertainChange]);

  // Keep the same request identity and payload after a network timeout.
  const pending = useRef<{
    id: string;
    kind: 'CUSTOM';
    productId: string;
    kioskId: string;
    pickupAt: string;
    instructions: string;
  } | null>(null);
  const sending = useRef(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sending.current || !confirmed || !isPreorder(item) || soldOut) return;
    setError('');
    setPickupError('');
    setBriefError('');
    if (!selectedKiosk || kiosks.isPending || kiosks.isError) {
      setError('Chưa xác minh được tủ nhận hoa. Hãy tải lại danh sách tủ.');
      return;
    }
    const pickupDate = new Date(pickup);
    const delay = pickupDate.getTime() - Date.now();
    if (!Number.isFinite(delay) || delay <= 0 || delay > 30 * 24 * 60 * 60 * 1000) {
      setPickupError('Chọn thời gian nhận trong tương lai, tối đa 30 ngày tới.');
      pickupRef.current?.focus();
      return;
    }
    if (availability.data && availability.data.available === false) {
      setError(availability.data.message || 'Tủ nhận hiện không còn sức chứa đặt trước.');
      return;
    }
    const brief = instructions.trim();
    if (brief.length < 10 || brief.length > 2000) {
      setBriefError('Nhập mong muốn từ 10 đến 2.000 ký tự để shop báo giá.');
      briefRef.current?.focus();
      return;
    }
    sending.current = true;
    setBusy(true);

    if (item.isDemoSample) {
      setError('Mẫu minh họa chỉ dùng để xem giao diện và không thể tạo đơn thật.');
      sending.current = false;
      setBusy(false);
      setUncertain(false);
      return;
    }

    pending.current ??= {
      id: crypto.randomUUID(),
      kind: 'CUSTOM',
      productId: item.productId,
      kioskId: selectedKiosk.kioskId,
      pickupAt: pickupDate.toISOString(),
      instructions: brief,
    };

    try {
      await request('/member/preorders', pending.current);
      setSubmittedId(pending.current.id);
      setDone(true);
      await queryClient.invalidateQueries({ queryKey: ['web-orders'] });
    } catch (cause) {
      if (
        cause instanceof ApiError &&
        cause.status === 409 &&
        cause.code === 'PREORDER_PRODUCT_OUT_OF_STOCK'
      ) {
        setStockConflict(true);
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: ['web-catalog'] }),
          queryClient.invalidateQueries({ queryKey: ['web-catalog-detail', item.productId] }),
          queryClient.invalidateQueries({ queryKey: ['landing-catalog-preview'] }),
          queryClient.invalidateQueries({
            queryKey: ['catalog-pickup-kiosks', item.productId, item.sellerId],
          }),
        ]);
      } else {
        setError(
          cause instanceof ApiError
            ? cause.message
            : 'Chưa xác nhận được kết quả. Kiểm tra tài khoản hoặc gửi lại cùng yêu cầu.',
        );
      }
      if (cause instanceof ApiError && cause.status >= 400 && cause.status < 500) {
        pending.current = null;
        setUncertain(false);
      } else {
        setUncertain(true);
      }
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  if (!isPreorder(item)) {
    return (
      <div className="flower-request-notice">
        <p role="note">
          {isWalkIn(item) ? 'Chỉ mua tại kiosk' : 'Chưa xác định hình thức mua'}: {item.kioskName} —{' '}
          {item.address}
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div role="status" className="flower-request-done">
        <div className="flower-request-done-icon" aria-hidden="true">
          <Check size={24} />
        </div>
        <h3>Đã nhận yêu cầu của bạn</h3>
        <p>Shop sẽ báo giá và xác nhận lịch nhận trong tài khoản của bạn.</p>
        <Link
          href={`/tai-khoan${submittedId ? `?requestId=${encodeURIComponent(submittedId)}` : ''}#web-orders`}
        >
          Xem yêu cầu vừa gửi
        </Link>
      </div>
    );
  }

  if (item.isDemoSample) {
    return (
      <div className="flower-request-notice">
        <p role="note">
          Mẫu minh họa để xem giao diện. Không tạo đơn, thanh toán hoặc tin nhắn cho mẫu này.
        </p>
      </div>
    );
  }

  if (!session.data) {
    const params = new URLSearchParams({ order: '1' });
    const current = new URL(window.location.href);
    const from = catalogReturnPath(
      current.pathname === '/dat-hoa'
        ? current.pathname + current.search
        : current.searchParams.get('from'),
    );
    if (from !== '/dat-hoa') params.set('from', from);
    if (item.zone) params.set('zone', item.zone);
    const returnUrl = `/dat-hoa/${encodeURIComponent(item.productId)}/${encodeURIComponent(item.kioskId)}?${params}`;
    const authQuery = `?returnUrl=${encodeURIComponent(returnUrl)}`;
    return (
      <div className="flower-request-guest-card">
        <div className="flower-request-guest-icon-badge">
          <LogIn size={26} aria-hidden="true" />
        </div>
        <div className="flower-request-guest-content">
          <h3 className="flower-request-guest-title">Đăng nhập để gửi yêu cầu báo giá</h3>
          <p className="flower-request-guest-desc">
            Đăng nhập để nhận báo giá từ shop và theo dõi đơn đặt hoa của bạn.
          </p>
          <div className="flower-request-guest-trust-list">
            <div className="flower-request-trust-item">
              <ShieldCheck size={16} className="flower-request-trust-icon" aria-hidden="true" />
              <span>Chưa cần thanh toán · Miễn phí gửi yêu cầu</span>
            </div>
            <div className="flower-request-trust-item">
              <CheckCircle2 size={16} className="flower-request-trust-icon" aria-hidden="true" />
              <span>Trao đổi mẫu và yêu cầu với shop</span>
            </div>
          </div>
          <Link
            className="button button-primary flower-request-guest-login-btn"
            href={`/dang-nhap${authQuery}`}
          >
            Đăng nhập để tiếp tục →
          </Link>
          <p className="flower-request-guest-register-text">
            Chưa có tài khoản?{' '}
            <Link className="flower-request-register-link" href={`/dang-ky${authQuery}`}>
              Tạo tài khoản mới
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (session.data.role !== 'CUSTOMER') {
    return (
      <div className="flower-request-notice">
        <p>Hãy dùng tài khoản thành viên để mua hoa. Tài khoản hiện tại dành cho vận hành.</p>
      </div>
    );
  }

  return (
    <form className="flower-request-form" noValidate onSubmit={(event) => void submit(event)}>
      <div className="flower-request-scroll">
        <div className="flower-request-intro">
          <div className="flower-request-intro-text">
            <div className="flower-request-intro-badge">
              <ShieldCheck size={15} aria-hidden="true" />
              <strong>Bạn chưa cần thanh toán</strong>
            </div>
            <p>Shop sẽ gửi báo giá và lịch nhận để bạn kiểm tra.</p>
          </div>
          <div className="flower-request-reference-price">
            <span>Giá mẫu</span>
            <strong>{formatPrice(item.price)} đ</strong>
          </div>
        </div>
        <fieldset disabled={busy || uncertain}>
          <legend className="sr-only">Đặt trước, shop chuẩn bị theo yêu cầu</legend>
          <div className="flower-request-field">
            <label htmlFor={`kiosk-${item.productId}`}>Tủ nhận hoa</label>
            <select
              id={`kiosk-${item.productId}`}
              value={kioskId}
              disabled={kiosks.isPending || kiosks.isError}
              onChange={(event) => {
                setKioskId(event.target.value);
                setConfirmed(false);
              }}
              required
            >
              {eligibleKiosks.map((entry) => (
                <option key={entry.kioskId} value={entry.kioskId}>
                  {entry.kioskName}
                </option>
              ))}
            </select>
            {kiosks.isPending && <p role="status">Đang tải tủ nhận phù hợp…</p>}
            {kiosks.isError && (
              <p role="alert">Chưa tải được danh sách tủ nhận. Vui lòng thử lại.</p>
            )}
            {kiosks.isError && (
              <Button type="button" variant="outline" onClick={() => void kiosks.refetch()}>
                Tải lại tủ nhận
              </Button>
            )}
            <div className="flower-request-kiosk-box">
              <MapPin size={16} className="flower-request-kiosk-icon" aria-hidden="true" />
              <div className="flower-request-kiosk-content">
                <strong>Địa chỉ nhận hoa</strong>
                <span>{selectedKiosk?.address || 'Chọn tủ để xem địa chỉ nhận hoa.'}</span>
              </div>
            </div>
          </div>
          <div className="flower-request-field">
            <label htmlFor={`pickup-${item.productId}`}>Thời gian mong muốn nhận hoa</label>
            <input
              id={`pickup-${item.productId}`}
              ref={pickupRef}
              type="datetime-local"
              required
              value={pickup}
              onChange={(event) => {
                setPickup(event.target.value);
                setPickupError('');
              }}
              aria-invalid={Boolean(pickupError)}
              aria-describedby={`pickup-hint-${item.productId}${pickupError ? ` pickup-error-${item.productId}` : ''}`}
            />
            <p className="quiet" id={`pickup-hint-${item.productId}`}>
              Chọn thời gian trong tương lai, tối đa 30 ngày tới. Lịch chính thức được shop xác nhận
              cùng báo giá.
            </p>
            {pickupError && (
              <p
                className="flower-request-field-error"
                role="alert"
                id={`pickup-error-${item.productId}`}
              >
                {pickupError}
              </p>
            )}
            {availability.isFetching && <p role="status">Đang kiểm tra sức chứa tủ…</p>}
            {availability.data && (
              <p
                className={availability.data.available ? 'quiet' : 'flower-request-field-error'}
                role="status"
              >
                {availability.data.available
                  ? `Ước tính còn ${availability.data.availablePreorderCapacity} ô đặt trước. Sức chứa sẽ được xác nhận khi bạn chấp nhận báo giá.`
                  : availability.data.message}
              </p>
            )}
            {availability.isError && (
              <p role="status" className="quiet">
                Chưa kiểm tra được sức chứa. Hệ thống sẽ xác nhận lại khi bạn duyệt báo giá.
              </p>
            )}
          </div>
          <div className="flower-request-field">
            <div className="flower-request-field-header">
              <label htmlFor={`brief-${item.productId}`}>
                Dịp tặng, màu hoa, ngân sách và lời nhắn
              </label>
            </div>
            <div className="flower-request-quick-tags" aria-label="Gợi ý nhanh lời nhắn">
              <span className="quick-tags-label">Gợi ý nhanh:</span>
              {[
                'Sinh nhật bạn nữ, tone pastel',
                'Kỷ niệm ngày cưới, hoa hồng đỏ sang',
                'Chúc mừng khai trương, hoa tươi sáng',
                'Tone ấm cúng tặng gia đình',
              ].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="quick-tag-btn"
                  onClick={() => {
                    setInstructions((prev) => (prev ? `${prev}, ${tag}` : tag));
                    setBriefError('');
                    briefRef.current?.focus();
                  }}
                >
                  + {tag}
                </button>
              ))}
            </div>
            <textarea
              id={`brief-${item.productId}`}
              ref={briefRef}
              minLength={10}
              maxLength={2000}
              required
              value={instructions}
              onChange={(event) => {
                setInstructions(event.target.value);
                setBriefError('');
              }}
              placeholder="Ví dụ: Tặng sinh nhật, hoa hồng tông pastel, ngân sách 400.000 đ…"
              aria-invalid={Boolean(briefError)}
              aria-describedby={`brief-hint-${item.productId}${briefError ? ` brief-error-${item.productId}` : ''}`}
            />
            <p className="quiet" id={`brief-hint-${item.productId}`}>
              Chia sẻ mong muốn của bạn trong 10–2.000 ký tự.
            </p>
            {briefError && (
              <p
                className="flower-request-field-error"
                role="alert"
                id={`brief-error-${item.productId}`}
              >
                {briefError}
              </p>
            )}
          </div>
          <label className="payout-checkbox flower-request-confirm-label">
            <input
              type="checkbox"
              required
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>Tôi đã kiểm tra tủ nhận và thông tin yêu cầu.</span>
          </label>
        </fieldset>
        <div className="flower-request-pickup-hint">
          <Clock size={14} className="flower-request-clock-icon" aria-hidden="true" />
          <span>
            Khi hoa sẵn sàng, mã OTP nhận hoa được gửi tới <strong>email đăng nhập của bạn</strong>.
          </span>
        </div>
        <p role="alert" className="error">
          {error}
        </p>
      </div>
      {soldOut && (
        <p role="alert" className="flower-request-stock-alert">
          Mẫu hoa đã hết hàng. Bạn có thể nhắn shop hoặc chọn mẫu khác.
        </p>
      )}
      <div className="flower-request-footer">
        {onOpenChat && (
          <Button
            variant="outline"
            type="button"
            className="chat-open-btn"
            disabled={openingChat || busy}
            onClick={onOpenChat}
          >
            <MessageSquare size={16} aria-hidden="true" />
            <span>{openingChat ? 'Đang mở chat…' : 'Nhắn tin với shop'}</span>
          </Button>
        )}
        <Button
          type="submit"
          disabled={busy || soldOut || !confirmed || kiosks.isPending || kiosks.isError}
          className="flower-request-submit-btn"
        >
          {busy ? 'Đang gửi…' : uncertain ? 'Gửi lại cùng yêu cầu' : 'Gửi yêu cầu để shop báo giá'}
        </Button>
      </div>
      {uncertain && !busy && (
        <p className="flower-request-uncertain-link">
          <Link href="/tai-khoan#web-orders">Kiểm tra đơn đặt trước</Link>
        </p>
      )}
    </form>
  );
}
