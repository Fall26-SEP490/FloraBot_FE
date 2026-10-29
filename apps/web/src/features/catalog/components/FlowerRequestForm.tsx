import { useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button, MapPin, MessageSquare } from '@florabot/ui';
import { ApiError, queryClient, request, sessionQuery } from '@/shared/lib/api';
import type { CatalogItem, CatalogResponse } from '../catalog.types';
import { canOrderOnWeb, isWalkIn } from '../catalog.utils';

interface FlowerRequestFormProps {
  item: CatalogItem;
  onOpenChat?: () => void;
  openingChat?: boolean;
}

export function FlowerRequestForm({ item, onOpenChat, openingChat }: FlowerRequestFormProps) {
  const session = useQuery(sessionQuery);
  const [kioskId, setKioskId] = useState(item.kioskId);
  const kiosks = useQuery({
    queryKey: ['catalog-pickup-kiosks', item.productId, item.sellerId],
    enabled: !item.isDemoSample && canOrderOnWeb(item),
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
            canOrderOnWeb(entry)
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
  const [instructions, setInstructions] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // Keep the same request identity and payload after a network timeout.
  const pending = useRef<object | null>(null);
  const sending = useRef(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sending.current || !confirmed || !canOrderOnWeb(item)) return;
    if (!selectedKiosk || kiosks.isPending || kiosks.isError) {
      setError('Chưa xác minh được tủ nhận hoa. Hãy tải lại danh sách tủ.');
      return;
    }
    const pickupDate = new Date(pickup);
    const delay = pickupDate.getTime() - Date.now();
    if (!Number.isFinite(delay) || delay < 2 * 60 * 60 * 1000 || delay > 30 * 24 * 60 * 60 * 1000) {
      setError('Chọn thời gian nhận từ 2 giờ đến 30 ngày tới.');
      return;
    }
    const brief = instructions.trim();
    if (brief.length < 10 || brief.length > 2000) {
      setError('Mô tả từ 10 đến 2000 ký tự.');
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
      setDone(true);
      await queryClient.invalidateQueries({ queryKey: ['web-orders'] });
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Chưa xác nhận được kết quả. Kiểm tra tài khoản hoặc gửi lại cùng yêu cầu.',
      );
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

  if (!canOrderOnWeb(item)) {
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
        <div className="flower-request-done-icon">✓</div>
        <h3>Đã nhận yêu cầu của bạn</h3>
        <p>Shop sẽ báo giá và xác nhận lịch nhận trong tài khoản của bạn.</p>
        <Link href="/tai-khoan">Theo dõi và thanh toán trong tài khoản</Link>
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
    return (
      <div className="flower-request-notice">
        <p>
          <Link href="/dang-nhap">Đăng nhập</Link> hoặc <Link href="/dang-ky">tạo tài khoản</Link>{' '}
          để đặt hoa và theo dõi đơn.
        </p>
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
    <form onSubmit={(event) => void submit(event)}>
      <fieldset disabled={busy || uncertain}>
        <legend>Đặt trước, shop chuẩn bị theo yêu cầu</legend>
        <>
          <label htmlFor={`pickup-${item.productId}`}>Thời gian mong muốn nhận hoa</label>
          <input
            id={`pickup-${item.productId}`}
            type="datetime-local"
            required
            value={pickup}
            onChange={(event) => setPickup(event.target.value)}
          />
          <p className="quiet">
            Chọn từ 2 giờ đến 30 ngày tới. Lịch chính thức được shop xác nhận cùng báo giá.
          </p>
          <label htmlFor={`brief-${item.productId}`}>
            Dịp tặng, màu hoa, ngân sách và lời nhắn
          </label>
          <textarea
            id={`brief-${item.productId}`}
            minLength={10}
            maxLength={2000}
            required
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
          />
          <p className="quiet">
            Giá trên mẫu là giá tham khảo. Bạn chỉ thanh toán sau khi đồng ý báo giá và lịch nhận
            của shop.
          </p>
        </>
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
              {entry.kioskName} — {entry.address}
            </option>
          ))}
        </select>
        {kiosks.isPending && <p role="status">Đang tải tủ nhận phù hợp…</p>}
        {kiosks.isError && <p role="alert">Chưa tải được danh sách tủ nhận. Vui lòng thử lại.</p>}
        {kiosks.isError && (
          <Button type="button" variant="outline" onClick={() => void kiosks.refetch()}>
            Tải lại tủ nhận
          </Button>
        )}
        <div className="flower-request-kiosk-box">
          <MapPin size={16} className="flower-request-kiosk-icon" aria-hidden="true" />
          <div className="flower-request-kiosk-content">
            <strong>Tủ nhận:</strong> {selectedKiosk?.kioskName ?? item.kioskName} —{' '}
            {selectedKiosk?.address ?? item.address}
          </div>
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
      <p role="alert" className="error">
        {error}
      </p>
      <div className="flower-request-footer">
        {onOpenChat && (
          <Button
            variant="outline"
            type="button"
            className="chat-open-btn"
            disabled={openingChat}
            onClick={onOpenChat}
          >
            <MessageSquare size={16} aria-hidden="true" />
            <span>{openingChat ? 'Đang mở chat…' : 'Nhắn tin với shop'}</span>
          </Button>
        )}
        <Button
          type="submit"
          disabled={busy || !confirmed || kiosks.isPending || kiosks.isError}
          className="flower-request-submit-btn"
        >
          {busy ? 'Đang gửi…' : uncertain ? 'Gửi lại cùng yêu cầu' : 'Gửi yêu cầu để shop báo giá'}
        </Button>
      </div>
      {uncertain && !busy && (
        <p className="flower-request-uncertain-link">
          <Link href="/tai-khoan">Kiểm tra yêu cầu trong tài khoản</Link>
        </p>
      )}
    </form>
  );
}
