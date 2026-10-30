import { useEffect, useRef, useState } from 'react';
import { Button } from '@florabot/ui';
import type { components } from '../../../../../packages/contracts/src/generated/api';
import '../portal/styles/portal.css';
import './styles/receipt.css';
import RefundAccount from '../finance/components/refunds/RefundAccount';
import ReceiptComplaint from './components/ReceiptComplaint';
import { saveReceipt } from './receipts.utils';

type ReceiptData = components['schemas']['ReceiptResponse'];
const money = (amount: number | string) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(amount));
const date = (value: string) =>
  new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
const statuses: Record<string, string> = {
  AWAITING_PAYMENT: 'Đang chờ thanh toán',
  PAID: 'Đã thanh toán',
  DISPENSING: 'Tủ đang giao hoa',
  COMPLETED: 'Đã nhận hoa',
  DISPENSE_FAILED: 'Giao hoa chưa thành công',
  DISPUTED: 'Đang xử lý phản ánh',
  REFUNDED: 'Đã hoàn tiền',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Đã hết hạn',
};

export default function Receipt() {
  const [initial] = useState(() => new URLSearchParams(window.location.hash.slice(1)));
  const [orderId, setOrderId] = useState(initial.get('order') || '');
  const [token, setToken] = useState(initial.get('token') || '');
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [personalDevice, setPersonalDevice] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');
  const controller = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const previous = document.title;
    document.title = 'Biên nhận của bạn — FloraBot';
    // Remove the capability from navigation history; saving requires explicit consent.
    window.history.replaceState(window.history.state, '', window.location.pathname);
    initial.delete('order');
    initial.delete('token');
    return () => {
      document.title = previous;
      controller.current?.abort();
    };
  }, [initial]);
  useEffect(() => {
    if (receipt) heading.current?.focus();
  }, [receipt]);

  async function lookup() {
    setSaveNotice('');
    setPersonalDevice(false);
    setError('');
    setReceipt(null);
    if (
      !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(orderId.trim()) ||
      !/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(token.trim().toUpperCase())
    ) {
      setError(
        'Kiểm tra ID biên nhận và mã tra cứu 8 ký tự trên màn hình kiosk. Bạn cũng có thể quét lại mã QR.',
      );
      return;
    }
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    setPending(true);
    try {
      const response = await fetch('/api/receipts/lookup', {
        method: 'POST',
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderId.trim(),
          trackingToken: token.trim().toUpperCase(),
        }),
        signal: AbortSignal.any([active.signal, AbortSignal.timeout(15_000)]),
      });
      if (!response.ok)
        throw new Error(
          response.status === 404
            ? 'Không tìm thấy biên nhận khớp hai mã này. Kiểm tra lại hoặc quét lại mã QR tại kiosk.'
            : response.status === 429
              ? 'Bạn đã tra cứu nhiều lần. Vui lòng thử lại sau một phút.'
              : 'Chưa tải được biên nhận. Bạn thử lại nhé.',
        );
      const result = (await response.json()) as ReceiptData;
      if (!active.signal.aborted) setReceipt(result);
    } catch (cause) {
      if (!active.signal.aborted)
        setError(
          cause instanceof Error && cause.name === 'Error'
            ? cause.message
            : 'Kết nối bị gián đoạn. Kiểm tra mạng rồi chọn xem biên nhận lần nữa.',
        );
    } finally {
      if (!active.signal.aborted) setPending(false);
    }
  }

  return (
    <main id="main" className="receipt-page">
      <a className="portal-brand" href={'/'}>
        FloraBot
      </a>
      <h1>Biên nhận của bạn</h1>
      <a href="/lich-su-mua">Biên nhận đã lưu trên thiết bị này</a>
      <p>Mỗi bó hoa, một niềm vui. Xem lại đơn hàng và tình trạng hoàn tiền tại đây.</p>
      <p className="quiet">
        Giữ riêng mã tra cứu: người có cả hai mã có thể xem và gửi yêu cầu cho đơn này. Thông tin
        nhập sẽ mất khi tải lại hoặc đóng trang, trừ khi bạn chọn lưu biên nhận trên thiết bị.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void lookup();
        }}
        aria-label="Tra cứu biên nhận"
      >
        <label htmlFor="receipt-order">ID biên nhận</label>
        <input
          id="receipt-order"
          value={orderId}
          onChange={(event) => {
            setOrderId(event.target.value);
            setReceipt(null);
          }}
          autoComplete="off"
          spellCheck={false}
          maxLength={36}
          readOnly={pending}
          aria-describedby="receipt-help receipt-error"
        />
        <p className="quiet" id="receipt-help">
          Dãy 36 ký tự tại kiosk, khác với mã đơn hàng. Quét QR để điền sẵn cả hai mã.
        </p>
        <label htmlFor="receipt-token">Mã tra cứu</label>
        <input
          id="receipt-token"
          value={token}
          onChange={(event) => {
            setToken(event.target.value);
            setReceipt(null);
          }}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={8}
          readOnly={pending}
          aria-describedby="receipt-error"
        />
        <p id="receipt-error" role="alert" className="error">
          {error}
        </p>
        <div className="receipt-actions">
          <Button type="submit" disabled={pending}>
            {pending ? 'Đang tra cứu…' : 'Xem biên nhận'}
          </Button>
          {pending && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                controller.current?.abort();
                setPending(false);
                setError('');
                document.getElementById('receipt-order')?.focus();
              }}
            >
              Hủy tra cứu
            </Button>
          )}
        </div>
      </form>
      <p className="quiet">
        Việc tra cứu không xóa biên nhận hoặc giao dịch thanh toán trong hệ thống.
      </p>
      {receipt && (
        <section aria-labelledby="receipt-result">
          <h2 id="receipt-result" ref={heading} tabIndex={-1}>
            Đơn {receipt.orderCode}
          </h2>
          <p className="receipt-status">{statuses[receipt.status] || 'Đang cập nhật trạng thái'}</p>
          <p>Đặt lúc {date(receipt.createdAt)}</p>
          <dl className="receipt-totals" aria-label="Mã nhận hoa tại Kiosk">
            <div>
              <dt>ID biên nhận (nhập tại Kiosk)</dt>
              <dd>
                <code>{receipt.orderId}</code>
              </dd>
            </div>
            <div>
              <dt>Mã biên nhận 8 ký tự</dt>
              <dd>
                <strong>{token.trim().toUpperCase()}</strong>
              </dd>
            </div>
          </dl>
          <ul className="receipt-items">
            {receipt.items.map((item, index) => (
              <li key={index}>
                <strong>{item.name}</strong>
                <span>
                  {item.quantity} × {money(item.unitPrice)}
                </span>
                <span>{money(item.total)}</span>
              </li>
            ))}
          </ul>
          <dl className="receipt-totals">
            <div>
              <dt>Tiền hàng</dt>
              <dd>{money(receipt.subtotal)}</dd>
            </div>
            <div>
              <dt>Giảm giá</dt>
              <dd>{money(receipt.discount)}</dd>
            </div>
            <div>
              <dt>Tổng đơn</dt>
              <dd>
                <strong>{money(receipt.total)}</strong>
              </dd>
            </div>
            <div>
              <dt>Hoàn tiền đang chờ</dt>
              <dd>{money(receipt.refunds.pendingAmount)}</dd>
            </div>
            <div>
              <dt>Đã hoàn</dt>
              <dd>{money(receipt.refunds.paidAmount)}</dd>
            </div>
          </dl>
          {Number(receipt.refunds.pendingAmount) > 0 && (
            <p>
              {receipt.refundInformationProvided
                ? 'Đã nhận thông tin tài khoản hoàn tiền. Khoản hoàn đang chờ được xử lý.'
                : 'Khoản hoàn đang chờ thông tin tài khoản nhận tiền.'}
            </p>
          )}
          {Number(receipt.refunds.pendingAmount) > 0 && (
            <RefundAccount
              orderId={receipt.orderId}
              trackingToken={token.trim().toUpperCase()}
              provided={receipt.refundInformationProvided}
              onSaved={() =>
                setReceipt((current) =>
                  current ? { ...current, refundInformationProvided: true } : null,
                )
              }
            />
          )}
          {receipt.completedAt && <p>Nhận hoa lúc {date(receipt.completedAt)}.</p>}
          {receipt.completedAt && (
            <section aria-labelledby="save-receipt-title">
              <h3 id="save-receipt-title">Giữ lại lần gửi thương này</h3>
              <p>
                Lưu biên nhận để xem lại mà không cần đăng nhập. Chỉ lưu trên điện thoại hoặc thiết
                bị riêng của bạn.
              </p>
              <label className="receipt-save-consent">
                <input
                  type="checkbox"
                  checked={personalDevice}
                  onChange={(event) => setPersonalDevice(event.target.checked)}
                />{' '}
                Đây là thiết bị riêng của tôi; tôi đồng ý lưu mã tra cứu tại đây.
              </label>
              <Button
                disabled={!personalDevice}
                onClick={() => {
                  try {
                    saveReceipt({
                      orderId: receipt.orderId,
                      token: token.trim().toUpperCase(),
                      orderCode: receipt.orderCode,
                      savedAt: new Date().toISOString(),
                    });
                    setSaveNotice('Đã lưu. Bạn có thể xem lại trong Biên nhận đã lưu.');
                  } catch (cause) {
                    setSaveNotice(
                      cause instanceof Error && cause.name === 'Error'
                        ? cause.message
                        : 'Không lưu được trên thiết bị này. Giữ mã QR để tra cứu lại.',
                    );
                  }
                }}
              >
                Lưu vào lịch sử trên thiết bị
              </Button>
              <p role="status">{saveNotice}</p>
            </section>
          )}
          {receipt.hasComplaint ? (
            <p role="status">Đã ghi nhận phản ánh cho đơn này.</p>
          ) : receipt.canComplain && receipt.disputeDeadline ? (
            <p>Bạn có thể gửi phản ánh trước {date(receipt.disputeDeadline)}.</p>
          ) : (
            receipt.disputeDeadline && <p>Đã hết thời hạn gửi phản ánh cho đơn này.</p>
          )}
          {receipt.canComplain && (
            <ReceiptComplaint
              orderId={receipt.orderId}
              trackingToken={token.trim().toUpperCase()}
              onSaved={() =>
                setReceipt((current) =>
                  current
                    ? { ...current, status: 'DISPUTED', canComplain: false, hasComplaint: true }
                    : null,
                )
              }
            />
          )}
          <p className="quiet">Chọn “Xem biên nhận” để cập nhật tình trạng mới nhất.</p>
        </section>
      )}
    </main>
  );
}
