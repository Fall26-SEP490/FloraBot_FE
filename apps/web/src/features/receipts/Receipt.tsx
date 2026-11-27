import { useEffect, useEffectEvent, useRef, useState } from 'react';
import {
  ArrowLeft,
  Button,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  ClipboardList,
  Clock,
  FileText,
  QrCode,
} from '@florabot/ui';
import type { components } from '../../../../../packages/contracts/src/generated/api';
import '../portal/styles/portal.css';
import './styles/receipt.css';
import RefundAccount from '../finance/components/refunds/RefundAccount';
import ReceiptComplaint from './components/ReceiptComplaint';
import ReceiptPaper from './components/ReceiptPaper';
import ComplaintOrderSummary from './components/ComplaintOrderSummary';
import CustomerComplaintProgress from '../complaints/CustomerComplaintProgress';
import ReceiptContextLink from './components/ReceiptContextLink';
import { readReceiptContext, rememberReceiptContext } from './receipt-navigation';
import type { ReceiptContext } from './receipt-navigation';

type ReceiptData = components['schemas']['ReceiptResponse'];
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

export default function Receipt({ complaintOnly = false }: { complaintOnly?: boolean }) {
  const [context, setContext] = useState(readReceiptContext);
  useEffect(() => {
    const sync = () => setContext(readReceiptContext());
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);
  return (
    <ReceiptContent
      key={JSON.stringify([complaintOnly, context])}
      complaintOnly={complaintOnly}
      initial={context}
    />
  );
}

function ReceiptContent({
  complaintOnly,
  initial,
}: {
  complaintOnly: boolean;
  initial: ReceiptContext;
}) {
  const [orderId, setOrderId] = useState(initial.orderId);
  const [token, setToken] = useState(initial.token);
  const [openingLink, setOpeningLink] = useState(() =>
    Boolean(initial.orderId.trim() && initial.token.trim()),
  );
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [receiptRevision, setReceiptRevision] = useState(0);
  const [receiptCheckedAt, setReceiptCheckedAt] = useState(0);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const orderOrigin = orderId.trim() === initial.orderId.trim() ? initial.returnTo : null;
  const controller = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const complaintStatus = useRef<HTMLDivElement>(null);
  const displayedReceiptId = receipt?.orderId;
  const complaintAllowed = Boolean(receipt?.canComplain && !receipt.hasComplaint);
  useEffect(() => {
    if (!displayedReceiptId) return;
    if (!complaintOnly) heading.current?.focus();
    else if (!complaintAllowed) complaintStatus.current?.focus();
  }, [displayedReceiptId, complaintOnly, complaintAllowed]);

  async function lookup(preserveReceipt = false): Promise<ReceiptData | null> {
    if (!preserveReceipt) {
      setReceipt(null);
    }
    setError('');
    if (
      !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(orderId.trim()) ||
      !/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(token.trim().toUpperCase())
    ) {
      setError(
        'Kiểm tra ID biên nhận và mã tra cứu 8 ký tự trên màn hình kiosk. Bạn cũng có thể quét lại mã QR.',
      );
      return null;
    }
    controller.current?.abort();
    rememberReceiptContext({ orderId, token, returnTo: orderOrigin });
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
      if (!active.signal.aborted) {
        setReceipt(result);
        setReceiptCheckedAt(Date.now());
        setReceiptRevision((value) => value + 1);
        return result;
      }
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
    return null;
  }

  const openLinkedReceipt = useEffectEvent(async () => {
    if (!openingLink) return;
    await lookup();
    setOpeningLink(false);
  });

  useEffect(() => {
    const previous = document.title;
    document.title = complaintOnly
      ? 'Phản ánh chất lượng hoa — FloraBot'
      : 'Biên nhận của bạn — FloraBot';
    rememberReceiptContext(initial);
    let mounted = true;
    // Wait for the current effect setup to survive React's development cleanup.
    queueMicrotask(() => {
      if (mounted) void openLinkedReceipt();
    });
    return () => {
      mounted = false;
      document.title = previous;
      controller.current?.abort();
    };
  }, [initial, complaintOnly]);

  const complaintExpired = Boolean(
    receipt &&
    !receipt.canComplain &&
    receipt.disputeDeadline &&
    Date.parse(receipt.disputeDeadline) <= receiptCheckedAt,
  );

  return (
    <main
      id="main"
      className={complaintOnly ? 'receipt-page complaint-page' : 'receipt-page receipt-view'}
    >
      <header className="receipt-heading">
        {orderOrigin ? (
          <a href={orderOrigin} className="complaint-back" referrerPolicy="no-referrer">
            <ArrowLeft size={16} aria-hidden="true" />
            Quay lại đơn hàng
          </a>
        ) : complaintOnly && orderId && token ? (
          <ReceiptContextLink
            to="/receipt"
            orderId={orderId}
            trackingToken={token}
            returnTo={null}
            className="complaint-back"
          >
            <ArrowLeft size={16} aria-hidden="true" /> Quay lại biên nhận
          </ReceiptContextLink>
        ) : null}
        <h1>{complaintOnly ? 'Phản ánh chất lượng hoa' : 'Biên nhận của bạn'}</h1>
        <p>
          {complaintOnly
            ? 'Gửi tình trạng bó hoa bạn đã nhận để shop kiểm tra và hỗ trợ.'
            : 'Xem thông tin đơn, trạng thái nhận hoa và khoản hoàn.'}
        </p>
      </header>
      {complaintOnly && openingLink && (
        <div className="complaint-state complaint-state-standalone">
          <span className="complaint-standalone-icon" aria-hidden="true">
            <Clock size={22} />
          </span>
          <p role="status" className="complaint-loading-text">
            Đang kiểm tra điều kiện phản ánh…
          </p>
        </div>
      )}
      {!complaintOnly && (
        <section
          className="receipt-lookup"
          aria-labelledby="receipt-lookup-title"
          aria-busy={pending || openingLink}
        >
          <h2 id="receipt-lookup-title">Tra cứu biên nhận</h2>
          <p className="quiet">
            Nhập mã từ kiosk hoặc liên kết đơn hàng (không phải OTP trong email).
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
              readOnly={pending || openingLink}
              aria-describedby="receipt-help receipt-error"
            />
            <p className="quiet" id="receipt-help">
              Dãy 36 ký tự, khác với mã đơn hàng.
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
              readOnly={pending || openingLink}
              aria-describedby="receipt-error"
            />
            <p id="receipt-error" role="alert" className="error">
              {!receipt && error}
            </p>
            <div className="receipt-actions">
              <Button type="submit" disabled={pending || openingLink}>
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
          <p className="quiet receipt-privacy">Giữ kín hai mã này để bảo vệ thông tin đơn hàng.</p>
        </section>
      )}
      {!complaintOnly && !receipt && (
        <div className="receipt-preview-placeholder">
          {openingLink || pending ? (
            <p role="status">Đang mở biên nhận…</p>
          ) : (
            <>
              <span className="receipt-placeholder-icon" aria-hidden="true">
                <FileText size={24} />
              </span>
              <h2>Biên nhận sẽ hiển thị tại đây</h2>
              <p>Nhập ID biên nhận và mã tra cứu để xem thông tin đơn hoa.</p>
            </>
          )}
        </div>
      )}
      {complaintOnly && !openingLink && !receipt && (
        <div
          className={
            error
              ? 'complaint-state complaint-state-standalone complaint-state-error'
              : 'complaint-state complaint-state-standalone'
          }
        >
          {error ? (
            <>
              <span className="complaint-standalone-icon is-error" aria-hidden="true">
                <CircleAlert size={22} />
              </span>
              <h2>Chưa tải được thông tin đơn</h2>
              <p role="alert" className="complaint-standalone-alert">
                {error}
              </p>
              <div className="complaint-standalone-actions">
                <Button disabled={pending} onClick={() => void lookup()}>
                  {pending ? 'Đang kiểm tra…' : 'Thử lại'}
                </Button>
              </div>
            </>
          ) : (
            <>
              <span className="complaint-standalone-icon" aria-hidden="true">
                <FileText size={22} />
              </span>
              <h2>Chọn đơn cần phản ánh</h2>
              <p className="complaint-standalone-lead">
                Chọn đơn đã nhận hoa trong tài khoản hoặc dùng mã biên nhận nếu mua tại kiosk.
              </p>
              <div className="complaint-entry-options">
                <div className="complaint-entry-card">
                  <div className="complaint-entry-card-head">
                    <ClipboardList size={18} aria-hidden="true" />
                    <h3>Đơn đặt qua tài khoản</h3>
                  </div>
                  <p>Mở danh sách đơn hàng đã nhận và chọn mục phản ánh trực tiếp trên đơn.</p>
                  <Button asChild>
                    <a href="/tai-khoan#web-orders">Xem đơn hàng</a>
                  </Button>
                </div>
                <div className="complaint-entry-card">
                  <div className="complaint-entry-card-head">
                    <QrCode size={18} aria-hidden="true" />
                    <h3>Đơn mua tại kiosk</h3>
                  </div>
                  <p>Nhập ID biên nhận và mã tra cứu 8 ký tự hiển thị trên màn hình kiosk.</p>
                  <Button asChild variant="outline">
                    <a href="/receipt">Tra cứu bằng mã biên nhận</a>
                  </Button>
                </div>
              </div>
              <p className="complaint-standalone-footnote">
                Phản ánh chỉ áp dụng cho đơn đã nhận hoa và còn trong thời hạn hỗ trợ.
              </p>
            </>
          )}
        </div>
      )}
      {receipt && (
        <section className="receipt-result" aria-labelledby="receipt-result">
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {complaintOnly ? (
            <ComplaintOrderSummary
              receipt={receipt}
              status={statuses[receipt.status] || 'Đang cập nhật trạng thái'}
              headingRef={heading}
              pending={pending}
              onRefresh={() => void lookup(true)}
              trackingToken={token}
              returnTo={orderOrigin}
            />
          ) : (
            <>
              <ReceiptPaper
                receipt={receipt}
                status={statuses[receipt.status] || 'Đang cập nhật trạng thái'}
                headingRef={heading}
              />
              <div className="receipt-actions receipt-paper-actions">
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => void lookup(true)}
                >
                  {pending ? 'Đang cập nhật…' : 'Cập nhật trạng thái'}
                </Button>
                {(receipt.status === 'COMPLETED' || receipt.hasComplaint) && (
                  <Button asChild variant="outline">
                    <ReceiptContextLink
                      to="/phan-anh"
                      orderId={receipt.orderId}
                      trackingToken={token}
                      returnTo={orderOrigin}
                    >
                      <CircleAlert size={16} aria-hidden="true" />
                      {receipt.hasComplaint ? 'Theo dõi phản ánh' : 'Phản ánh về hoa'}
                    </ReceiptContextLink>
                  </Button>
                )}
              </div>
              {['PAID', 'DISPENSING'].includes(receipt.status) && receipt.items.length > 0 && (
                <details className="receipt-recovery">
                  <summary>
                    <span>Mã tra cứu khi cần hỗ trợ tại kiosk</span>
                    <ChevronDown size={18} aria-hidden="true" />
                  </summary>
                  <p>
                    Hai mã này khác với OTP nhận đơn đặt trước trong email. Chỉ nhập khi màn hình
                    kiosk yêu cầu tại mục “Đã thanh toán nhưng chưa nhận hoa?”. Biên nhận không xác
                    nhận hoa đã sẵn sàng hoặc tủ đã mở.
                  </p>
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
                </details>
              )}
              {Number(receipt.refunds.pendingAmount) > 0 && (
                <RefundAccount
                  orderId={receipt.orderId}
                  trackingToken={token.trim().toUpperCase()}
                  provided={receipt.refundInformationProvided}
                  pendingAmount={receipt.refunds.pendingAmount}
                  onSaved={() =>
                    setReceipt((current) =>
                      current ? { ...current, refundInformationProvided: true } : null,
                    )
                  }
                />
              )}
            </>
          )}
          {complaintOnly && (
            <div className="complaint-work-panel">
              <div
                ref={complaintStatus}
                tabIndex={-1}
                className={!complaintAllowed ? 'complaint-state' : 'complaint-policy'}
                data-state={
                  receipt.hasComplaint ? 'reported' : complaintExpired ? 'expired' : undefined
                }
              >
                {receipt.hasComplaint ? (
                  <>
                    <CheckCircle2 size={28} aria-hidden="true" />
                    <h3>Đã gửi phản ánh</h3>
                    <p role="status">Đã ghi nhận phản ánh cho đơn này.</p>
                  </>
                ) : receipt.canComplain && receipt.disputeDeadline ? (
                  <p>
                    <Clock size={16} aria-hidden="true" />
                    <span>Bạn có thể gửi phản ánh trước {date(receipt.disputeDeadline)}.</span>
                  </p>
                ) : complaintExpired ? (
                  <>
                    <Clock size={28} aria-hidden="true" />
                    <h3>Đã hết hạn phản ánh</h3>
                    <p role="status">Hạn gửi: {date(receipt.disputeDeadline!)}.</p>
                    {orderOrigin && (
                      <a className="complaint-state-link" href={orderOrigin}>
                        Về đơn hàng để nhắn shop
                      </a>
                    )}
                  </>
                ) : !receipt.canComplain ? (
                  <>
                    <CircleAlert size={28} aria-hidden="true" />
                    <h3>Chưa thể gửi phản ánh</h3>
                    <p role="status">
                      {receipt.status !== 'COMPLETED'
                        ? 'Chỉ có thể gửi phản ánh chất lượng sau khi đơn đã nhận hoa.'
                        : 'Đơn này hiện chưa được hệ thống cho phép gửi phản ánh chất lượng hoa.'}
                    </p>
                  </>
                ) : null}
              </div>
              {receipt.hasComplaint && (
                <CustomerComplaintProgress
                  key={`complaint-progress-${receipt.orderId}`}
                  orderId={receipt.orderId}
                  trackingToken={token.trim().toUpperCase()}
                />
              )}
              {
                <ReceiptComplaint
                  key={`complaint-form-${receipt.orderId}`}
                  orderId={receipt.orderId}
                  canComplain={receipt.canComplain && !receipt.hasComplaint}
                  receiptRevision={receiptRevision}
                  initiallyOpen
                  trackingToken={token.trim().toUpperCase()}
                  onCheckReceipt={async () => {
                    const fresh = await lookup(true);
                    return !!fresh && fresh.canComplain && !fresh.hasComplaint;
                  }}
                  onSaved={() =>
                    setReceipt((current) =>
                      current
                        ? { ...current, status: 'DISPUTED', canComplain: false, hasComplaint: true }
                        : null,
                    )
                  }
                />
              }
            </div>
          )}
        </section>
      )}
    </main>
  );
}
