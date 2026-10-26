import { useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { ApiError, queryClient, request, sessionQuery } from '../../../api';
import type { CatalogItem } from '../catalog.types';

interface FlowerRequestFormProps {
  item: CatalogItem;
}

export function FlowerRequestForm({ item }: FlowerRequestFormProps) {
  const session = useQuery(sessionQuery);
  const [kind, setKind] = useState<'CUSTOM' | 'STOCK'>('CUSTOM');
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
    if (sending.current || !confirmed) return;
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
      kind,
      productId: item.productId,
      kioskId: item.kioskId,
      bouquetId: kind === 'STOCK' ? item.bouquets[0] : null,
      pickupAt: kind === 'CUSTOM' ? new Date(pickup).toISOString() : new Date().toISOString(),
      instructions,
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

  if (done) {
    return (
      <div role="status">
        <h3>Đã nhận yêu cầu của bạn</h3>
        <p>
          {kind === 'CUSTOM'
            ? 'Shop sẽ báo giá và xác nhận lịch nhận trong tài khoản của bạn.'
            : 'Bó hoa đang được giữ chờ thanh toán. Mở đơn ngay để xem thời hạn và thanh toán.'}
        </p>
        <Link href="/tai-khoan">Theo dõi và thanh toán trong tài khoản</Link>
      </div>
    );
  }

  if (item.isDemoSample) {
    return (
      <p role="note">
        Mẫu minh họa để xem giao diện. Không tạo đơn, thanh toán hoặc tin nhắn cho mẫu này.
      </p>
    );
  }

  if (!session.data) {
    return (
      <p>
        <Link href="/dang-nhap">Đăng nhập</Link> hoặc <Link href="/dang-ky">tạo tài khoản</Link> để
        đặt hoa và theo dõi đơn.
      </p>
    );
  }

  if (!['CUSTOMER', 'SELLER'].includes(session.data.role)) {
    return <p>Hãy dùng tài khoản thành viên để mua hoa. Tài khoản hiện tại dành cho vận hành.</p>;
  }

  return (
    <form onSubmit={(event) => void submit(event)}>
      <fieldset disabled={busy || uncertain}>
        <legend>Bạn muốn nhận bó hoa nào?</legend>
        <label className="payout-checkbox">
          <input
            type="radio"
            name={`kind-${item.productId}`}
            checked={kind === 'CUSTOM'}
            onChange={() => {
              setKind('CUSTOM');
              setConfirmed(false);
            }}
          />
          Đặt mẫu riêng, shop chuẩn bị theo yêu cầu
        </label>
        <label className="payout-checkbox">
          <input
            type="radio"
            name={`kind-${item.productId}`}
            checked={kind === 'STOCK'}
            disabled={!item.bouquets.length}
            onChange={() => {
              setKind('STOCK');
              setConfirmed(false);
            }}
          />
          Mua hoa có sẵn tại tủ ({item.bouquets.length} bó)
        </label>
        {kind === 'CUSTOM' ? (
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
            <p>
              Giá trên mẫu là giá tham khảo. Bạn chỉ thanh toán sau khi đồng ý báo giá và lịch nhận
              của shop.
            </p>
          </>
        ) : (
          <p>
            Bó có sẵn được giữ trong thời gian thanh toán. Sau khi thanh toán, đến tủ nhận trong
            thời hạn ghi trên đơn.
          </p>
        )}
        <p>
          <strong>Tủ nhận:</strong> {item.kioskName} — {item.address}
        </p>
        <label className="payout-checkbox">
          <input
            type="checkbox"
            required
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          Tôi đã kiểm tra tủ nhận và thông tin yêu cầu.
        </label>
      </fieldset>
      <p role="alert" className="error">
        {error}
      </p>
      <Button type="submit" disabled={busy || !confirmed}>
        {busy
          ? 'Đang gửi…'
          : uncertain
            ? 'Gửi lại cùng yêu cầu'
            : kind === 'CUSTOM'
              ? 'Gửi yêu cầu để shop báo giá'
              : 'Giữ bó hoa và tiếp tục thanh toán'}
      </Button>
      {uncertain && !busy && (
        <p>
          <Link href="/tai-khoan">Kiểm tra yêu cầu trong tài khoản</Link>
        </p>
      )}
    </form>
  );
}
