'use client';

import WorkspaceTable from '@/features/portal/components/WorkspaceTable';
import { Modal } from '@/shared/components/Modal';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import PayosCheckout from '@/shared/components/PayosCheckout';
import { validatePayosCheckoutUrl } from '@/shared/lib/payos-checkout';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  ClipboardList,
  ChevronDown,
  Search,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  Flower2,
  CircleAlert,
  X,
} from '@florabot/ui';
import { ApiError, queryClient, request, sessionQuery } from '@/shared/lib/api';
import type { components } from '../../../../../packages/contracts/src/generated/api';
import {
  canSendPreorderPickupOtp,
  matchesOrderFilter,
  orderClosed,
  orderNextStep,
  orderStage,
  sellerOrderActionLabel,
  sellerOrderHint,
  statusName,
  money,
  when,
} from './orders.utils';
import type { OrderFilter, Page, SendPreorderPickupOtpResponse, WebOrder } from './orders.types';
import styles from './seller-orders.module.css';
import customerStyles from './customer-orders.module.css';
import './admin-preorders.css';
import { fetchMemberHistory } from '../customer-account/customer-account.api';
import { CustomerPurchaseCard } from '../customer-account/CustomerPurchaseCard';
import type { CustomerHistoryItem } from '../customer-account/customer-account.types';
import { CustomerQuoteDetails, CustomerPaymentReturn } from './CustomerQuoteDetails';
import CustomerOrderSummary from './CustomerOrderSummary';
import { PreorderAccessories, PreorderPackingList } from './PreorderAccessories';
import accessoryStyles from './preorder-accessories.module.css';
import CustomerOrderChat from './CustomerOrderChat';
import {
  ORDER_FILTERS,
  orderReturnHref,
  readOrderScroll,
  rememberOrderView,
} from './order-navigation';
import ReceiptContextLink from '../receipts/components/ReceiptContextLink';
import { pickupWindow } from './pickup-window';
import PreorderLoadingButton from './PreorderLoadingButton';
import { usePreorderLoadingAccess } from './usePreorderLoadingAccess';
import AssignPreorderStock from './AssignPreorderStock';
import { readSellerQueue, sellerQueueKey, SELLER_RESULT_SIZE } from './seller-queue';
import { rememberPreorderPayment } from './payment-return';
import ProductThumbnail from '../product-management/components/ProductThumbnail';
import { fetchProducts } from '../product-management/product.api';

const sellerFilters: { value: OrderFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'attention', label: 'Cần xử lý' },
  { value: 'requested', label: 'Chờ báo giá' },
  { value: 'quoted', label: 'Chờ xác nhận' },
  { value: 'payment', label: 'Chờ thanh toán' },
  { value: 'preparing', label: 'Đang chuẩn bị' },
  { value: 'ready', label: 'Sẵn sàng' },
  { value: 'closed', label: 'Đã kết thúc' },
];
const memberFilters: { value: OrderFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'attention', label: 'Cần bạn xử lý' },
  { value: 'tracking', label: 'Đang theo dõi' },
  { value: 'ready', label: 'Sẵn sàng tại tủ' },
  { value: 'closed', label: 'Đã kết thúc' },
];

const memberReceiptStatuses = new Set([
  'PAID',
  'DISPENSING',
  'COMPLETED',
  'DISPENSE_FAILED',
  'DISPUTED',
  'REFUNDED',
]);
const pickupDate = (value: string) =>
  new Date(value).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
const pickupClock = (value: string) =>
  new Date(value).toLocaleTimeString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
  });
const pickupDayKey = (value: string) =>
  new Date(value).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const searchable = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLocaleLowerCase('vi-VN');

function OrderActions({
  row,
  base,
  mode,
  role,
  userId,
  page,
  filter,
  onReload,
}: {
  row: WebOrder;
  base: string;
  mode: 'member' | 'seller' | 'admin';
  role?: string;
  userId?: string;
  page: number;
  filter: OrderFilter;
  onReload: () => Promise<WebOrder>;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const [action, setAction] = useState<'quote' | 'fulfill' | 'cancel' | 'accept' | null>(null);
  const actionHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (mode === 'member' && action) actionHeading.current?.focus();
  }, [action, mode]);
  const [busy, setBusy] = useState(false);
  const uncertaintyKey = `florabot-web-order-uncertain:${base}:${row.id}`;
  const [uncertain, setUncertain] = useState(() => {
    try {
      return typeof window !== 'undefined' && sessionStorage.getItem(uncertaintyKey) === '1';
    } catch {
      return false;
    }
  });
  const [paymentLink, setPaymentLink] = useState<
    components['schemas']['PaymentLinkResponse'] | null
  >(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [hadPaymentLink, setHadPaymentLink] = useState(false);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const paymentResult = useRef<HTMLDivElement>(null);
  const [checking, setChecking] = useState(false);
  const sending = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [priceDraft, setPriceDraft] = useState<string | null>(null);
  const [quoteQuantities, setQuoteQuantities] = useState<Record<string, number>>({});
  const requestedAccessories = row.requestedAccessories ?? [];
  const [unavailableQuote, setUnavailableQuote] = useState<WebOrder['quoteVersion'] | null>(null);
  const accessoryStockBlocked =
    unavailableQuote !== null && unavailableQuote === (row.quoteVersion ?? 0);
  const [note, setNote] = useState('');
  const [reject, setReject] = useState(false);
  const editingQuote = mode === 'seller' && action === 'quote' && !reject;
  const products = useQuery({
    queryKey: ['products', row.sellerId],
    queryFn: fetchProducts,
    enabled: editingQuote && row.quotedFlowerPrice == null && row.quotedPrice == null,
    staleTime: 0,
  });
  const accessoryCatalog = useQuery({
    queryKey: ['seller-accessories', row.sellerId, 'ALL'],
    queryFn: () =>
      request<components['schemas']['SellerAccessoryResponse'][]>(
        `/sellers/${row.sellerId}/accessories?scope=ALL`,
      ),
    enabled: editingQuote && requestedAccessories.length > 0,
    staleTime: 0,
  });
  const sample = Array.isArray(products.data)
    ? products.data.find((item) => item.id === row.productId)?.price
    : undefined;
  const price = priceDraft ?? (sample != null && Number(sample) > 0 ? String(sample) : '');
  const accessoryCatalogVerified =
    accessoryCatalog.isSuccess && Array.isArray(accessoryCatalog.data);
  const catalogItems = Array.isArray(accessoryCatalog.data) ? accessoryCatalog.data : [];
  const accessoryLines = requestedAccessories.map((item) => {
    const quantity = quoteQuantities[item.accessoryId] ?? 0;
    // Older requests can still reference accessories attached to their original pickup kiosk.
    const current = catalogItems.find(
      (entry) =>
        entry.id === item.accessoryId && (entry.kioskId === null || entry.kioskId === row.kioskId),
    );
    const unitPrice = current?.status === 'ACTIVE' ? Number(current.price) : NaN;
    const stock = current?.status === 'ACTIVE' ? Number(current.stockQuantity) : 0;
    const available = accessoryCatalogVerified
      ? Number.isSafeInteger(stock) && stock > 0
        ? stock
        : 0
      : null;
    return {
      ...item,
      accepted: quantity,
      available,
      lineTotal:
        quantity === 0
          ? 0
          : Number.isSafeInteger(unitPrice) && unitPrice > 0
            ? unitPrice * quantity
            : null,
      stockIssue: available !== null && quantity > available,
    };
  });
  const accessoryStockIssue = accessoryLines.some((item) => item.stockIssue);
  const accessoryVerificationNeeded = accessoryLines.some(
    (item) => item.accepted > 0 && (!accessoryCatalogVerified || item.lineTotal === null),
  );
  const quoteBlocked = editingQuote && (accessoryStockIssue || accessoryVerificationNeeded);
  const accessoryTotal =
    accessoryStockIssue || accessoryVerificationNeeded
      ? null
      : accessoryLines.reduce((sum, item) => sum + (item.lineTotal ?? 0), 0);
  const projectedTotal =
    price.trim() && Number(price) > 0 && accessoryTotal !== null
      ? Number(price) + accessoryTotal
      : null;
  const editableAccessories = accessoryLines.filter(
    (item) => !item.stockIssue && (item.available === null || item.available > 0),
  );
  const [pickup, setPickup] = useState(() => {
    const date = new Date(row.pickupAt);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  });
  const [slot, setSlot] = useState('');
  const [qr, setQr] = useState('');
  const {
    setAccess: setLoadingAccess,
    expired: loadingAccessExpired,
    loadingAccessId,
    getCurrentAccessId,
  } = usePreorderLoadingAccess();
  const [fulfillStep, setFulfillStep] = useState<1 | 2>(1);
  const [confirm, setConfirm] = useState(false);
  function changeQuoteQuantity(accessoryId: string, quantity: number) {
    setQuoteQuantities((current) => ({ ...current, [accessoryId]: quantity }));
    setConfirm(false);
    setError('');
  }
  const [reviewedQuote, setReviewedQuote] = useState<{
    price: number | null;
    pickupAt: string;
    note: string | null;
    quoteVersion?: number | string;
  } | null>(null);
  const reviewedQuoteChanged = Boolean(
    reviewedQuote &&
    (reviewedQuote.price !== row.quotedPrice ||
      reviewedQuote.pickupAt !== row.pickupAt ||
      reviewedQuote.note !== row.quoteNote ||
      reviewedQuote.quoteVersion !== row.quoteVersion),
  );
  const [otpSending, setOtpSending] = useState(false);
  const otpSendingRef = useRef(false);
  const [otpHasSent, setOtpHasSent] = useState(false);
  const [otpCooldownUntil, setOtpCooldownUntil] = useState<number | null>(null);
  const otpRemainingSeconds =
    otpCooldownUntil && otpCooldownUntil > now ? Math.ceil((otpCooldownUntil - now) / 1000) : 0;

  async function sendPickupOtp() {
    if (otpSendingRef.current || busy || uncertain || otpRemainingSeconds > 0) return;
    otpSendingRef.current = true;
    setOtpSending(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/me/preorders/${encodeURIComponent(row.id)}/pickup-otp`, {
        method: 'POST',
        credentials: 'include',
        signal: AbortSignal.timeout(15_000),
      });
      const data = (await response.json().catch(() => ({}))) as Partial<
        SendPreorderPickupOtpResponse & {
          detail?: string;
          title?: string;
          message?: string;
        }
      >;

      if (!response.ok) {
        const serverDetail = data.detail || data.title || data.message;
        if (response.status === 401) {
          setError(
            serverDetail ||
              'Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng kiểm tra phiên đăng nhập và đăng nhập lại.',
          );
        } else if (response.status === 403) {
          setError(
            serverDetail ||
              'Chỉ Chủ shop (Seller) sở hữu đơn mới được gửi mã nhận hoa. Vui lòng kiểm tra quyền truy cập và phiên đăng nhập.',
          );
        } else if (response.status === 404) {
          setError(serverDetail || 'Không tìm thấy đơn đặt trước thuộc shop của bạn.');
        } else if (response.status === 409) {
          setError(
            serverDetail ||
              'Trạng thái đơn đặt trước đã thay đổi. Đang tải lại trạng thái mới nhất từ máy chủ.',
          );
          await queryClient.invalidateQueries({ queryKey: ['web-orders'] });
        } else if (response.status === 429) {
          if (typeof data.resendAfterSeconds === 'number' && data.resendAfterSeconds > 0) {
            setOtpCooldownUntil(Date.now() + data.resendAfterSeconds * 1000);
          }
          setError(
            serverDetail || 'Bạn đã gửi mã quá giới hạn cho phép. Vui lòng chờ trước khi gửi lại.',
          );
        } else if (response.status === 503 || response.status >= 500) {
          setError(
            serverDetail ||
              'Chưa xác nhận gửi mã thành công do dịch vụ tạm thời gián đoạn. Hệ thống không tự gửi lại; vui lòng kiểm tra trước khi bấm gửi lại.',
          );
        } else {
          setError(serverDetail || `Gửi mã thất bại (${response.status}).`);
        }
        return;
      }

      const masked = data.recipientMasked || 'email đăng nhập của khách';
      const cooldownSec =
        typeof data.resendAfterSeconds === 'number' && data.resendAfterSeconds > 0
          ? data.resendAfterSeconds
          : 60;
      setOtpHasSent(true);
      setOtpCooldownUntil(Date.now() + cooldownSec * 1000);
      setNotice(`Đã gửi mã nhận hoa tới ${masked}. Khách vui lòng kiểm tra hộp thư và thư rác.`);
    } catch {
      setError(
        'Chưa xác nhận gửi mã thành công do lỗi kết nối mạng. Hệ thống không tự gửi lại; vui lòng kiểm tra trước khi thử lại.',
      );
    } finally {
      otpSendingRef.current = false;
      setOtpSending(false);
    }
  }
  const quoteExpired = Boolean(row.quoteExpiresAt && new Date(row.quoteExpiresAt).getTime() <= now);
  const paymentExpired = Boolean(row.payBefore && new Date(row.payBefore).getTime() <= now);
  const showingPayment = mode === 'member' && paymentOpen && row.orderStatus === 'AWAITING_PAYMENT';
  const paymentWasOpen = useRef(false);
  useEffect(() => {
    if (paymentWasOpen.current && !showingPayment && paymentOpen)
      paymentResult.current?.focus({ preventScroll: true });
    paymentWasOpen.current = showingPayment;
  }, [showingPayment, paymentOpen]);
  const hasQuotedPrice = row.quotedPrice != null && Number.isFinite(row.quotedPrice);
  const slots = useQuery({
    queryKey: ['seller-kiosk-slots', row.sellerId, row.kioskId],
    queryFn: () =>
      request<(components['schemas']['SellerSlotResponse'] & { zone?: string | null })[]>(
        `/me/kiosks/${row.kioskId}/slots`,
      ),
    enabled: action === 'fulfill' && Boolean(row.kioskId),
  });
  const emptyPreorderSlots =
    slots.data?.filter(
      (item) =>
        item.kioskId === row.kioskId &&
        item.zone === 'PREORDER' &&
        item.status === 'RENTED_EMPTY' &&
        !item.bouquetId,
    ) ?? [];
  const fulfillSlots = emptyPreorderSlots.filter((item) => item.sensorReady);
  async function send(kind: string, body: unknown) {
    if (mode === 'admin') return;
    if (sending.current || uncertain) return;
    if (
      mode === 'member' &&
      kind === 'accept' &&
      (!hasQuotedPrice ||
        accessoryStockBlocked ||
        reviewedQuoteChanged ||
        (row.quoteExpiresAt && new Date(row.quoteExpiresAt).getTime() <= Date.now()))
    ) {
      setError(
        'Báo giá đã hết hạn hoặc chưa có số tiền hợp lệ. Làm mới đơn và liên hệ shop để kiểm tra.',
      );
      return;
    }
    if (
      mode === 'member' &&
      kind === 'payment-link' &&
      row.payBefore &&
      new Date(row.payBefore).getTime() <= Date.now()
    ) {
      setError('Đã hết hạn thanh toán. Làm mới để kiểm tra trạng thái của đơn.');
      return;
    }
    sending.current = true;
    setBusy(true);
    if (kind === 'payment-link') {
      setPaymentOpen(true);
      setLoadingPayment(true);
      setPaymentLink(null);
    }
    setError('');
    setNotice('');
    try {
      const result = await request<components['schemas']['PaymentLinkResponse']>(
        `${base}/${row.id}/${kind}`,
        body,
      );
      if (kind === 'payment-link') {
        const validation = validatePayosCheckoutUrl(result.checkoutUrl || '');
        const amount = Number(result.amount);
        const orderCode = Number(result.orderCode);
        if (
          !validation.valid ||
          !validation.url ||
          !Number.isSafeInteger(amount) ||
          amount <= 0 ||
          !Number.isSafeInteger(orderCode) ||
          orderCode <= 0
        )
          throw new Error('Liên kết thanh toán không hợp lệ.');
        rememberPreorderPayment(row.id, page, orderCode, userId);
        setPaymentLink({ ...result, checkoutUrl: validation.url });
        setHadPaymentLink(true);
      } else {
        setAction(null);
        setConfirm(false);
        setNotice(
          kind === 'quote'
            ? reject
              ? 'Đã từ chối yêu cầu.'
              : row.state === 'QUOTED'
                ? 'Đã cập nhật báo giá.'
                : 'Đã gửi báo giá.'
            : 'Đã cập nhật yêu cầu.',
        );
      }
    } catch (cause) {
      if (
        kind === 'quote' &&
        !reject &&
        requestedAccessories.length > 0 &&
        cause instanceof ApiError &&
        [400, 409, 422].includes(cause.status)
      ) {
        setConfirm(false);
        void queryClient.invalidateQueries({ queryKey: ['seller-accessories', row.sellerId] });
      }
      if (
        !(cause instanceof ApiError) ||
        ((cause.status >= 500 || cause.status === 408) &&
          !(
            kind === 'payment-link' &&
            ['missing_seller_channel', 'seller_channel_unavailable'].includes(cause.code ?? '')
          ))
      ) {
        setUncertain(true);
        try {
          sessionStorage.setItem(uncertaintyKey, '1');
        } catch {
          /* Keep the in-memory lock. */
        }
      }
      if (kind === 'accept' && cause instanceof ApiError && cause.status === 409) {
        setAction(null);
        setConfirm(false);
        setReviewedQuote(null);
        if (cause.code === 'PREORDER_ACCESSORY_OUT_OF_STOCK') {
          setUnavailableQuote(row.quoteVersion ?? 0);
        } else {
          setError(
            `Không thể xác nhận báo giá: ${cause.message} Hãy kiểm tra lại báo giá từ shop.`,
          );
        }
      } else {
        setError(
          cause instanceof ApiError
            ? cause.message
            : 'Chưa xác nhận được kết quả. Chọn cập nhật để kiểm tra trước khi gửi lại.',
        );
      }
    } finally {
      await queryClient.invalidateQueries({ queryKey: ['web-orders'] });
      if (kind === 'accept' || kind === 'cancel') {
        void queryClient.invalidateQueries({ queryKey: ['preorder-accessories', row.sellerId] });
        void queryClient.invalidateQueries({ queryKey: ['seller-accessories', row.sellerId] });
      }
      if (mode === 'seller' && kind === 'fulfill') {
        await queryClient.invalidateQueries({ queryKey: ['products'] });
      }
      sending.current = false;
      setBusy(false);
      if (kind === 'payment-link') setLoadingPayment(false);
    }
  }
  const canCancel =
    mode !== 'admin' &&
    (!row.orderStatus
      ? ['REQUESTED', 'QUOTED'].includes(row.state)
      : row.orderStatus === 'AWAITING_PAYMENT' ||
        (mode !== 'member' && row.orderStatus === 'PAID'));
  function openCancellation() {
    setAction('cancel');
    setConfirm(false);
    setNote('');
  }

  const sellerWaitingForQuote = mode === 'seller' && row.state === 'QUOTED' && !row.orderStatus;
  const sellerWaitingForPayment = mode === 'seller' && row.orderStatus === 'AWAITING_PAYMENT';
  const pickupTiming = pickupWindow(row.pickupAt, row.pickupBefore, now);
  const showPickupChat =
    mode === 'member' &&
    role === 'CUSTOMER' &&
    !uncertain &&
    !action &&
    row.orderStatus === 'PAID' &&
    row.ready &&
    (pickupTiming === 'expired' || pickupTiming === 'unknown');
  const quoteStage = sellerWaitingForQuote
    ? quoteExpired
      ? 'Báo giá hết hạn'
      : 'Chờ khách xác nhận'
    : sellerWaitingForPayment
      ? 'Chờ thanh toán'
      : mode === 'member' && row.state === 'QUOTED' && !row.orderId
        ? 'Xác nhận báo giá'
        : mode === 'member' && row.orderStatus === 'AWAITING_PAYMENT'
          ? 'Chờ thanh toán'
          : 'Báo giá & thanh toán';
  const progress = (
    <ol className="order-progress" aria-label="Tiến độ đơn đặt hoa">
      {['Yêu cầu', quoteStage, 'Chuẩn bị', 'Sẵn sàng nhận', 'Hoàn tất'].map((label, index) => (
        <li
          key={label}
          data-complete={
            index < orderStage(row) ||
            ((mode === 'seller' || mode === 'member') && row.orderStatus === 'COMPLETED')
          }
          aria-current={index === orderStage(row) ? 'step' : undefined}
        >
          <span aria-hidden="true">
            {mode === 'seller' && (index < orderStage(row) || row.orderStatus === 'COMPLETED')
              ? '✓'
              : index + 1}
          </span>
          <div>
            {label}
            {(mode === 'seller' || mode === 'member') && (
              <span className="sr-only">
                {index < orderStage(row) || row.orderStatus === 'COMPLETED'
                  ? ' — đã hoàn thành'
                  : index === orderStage(row)
                    ? ' — hiện tại'
                    : ' — chưa đến'}
              </span>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
  const interaction = (
    <>
      {accessoryStockBlocked && row.state === 'QUOTED' && !row.orderId && (
        <p role="alert" className="error">
          Phụ kiện trong báo giá không còn đủ. Hãy nhắn shop cập nhật báo giá trước khi xác nhận
          lại.
        </p>
      )}
      {showingPayment && (
        <PayosCheckout
          checkoutUrl={paymentLink?.checkoutUrl}
          qrCode={paymentLink?.qrCode}
          amount={paymentLink?.amount ?? row.quotedPrice}
          recipientName={paymentLink?.recipientName}
          recipientAccountMasked={paymentLink?.recipientAccountMasked}
          title="Thanh toán đơn hoa"
          description={row.shopName || 'Đơn đặt hoa'}
          onClose={() => setPaymentOpen(false)}
          onRefresh={async () => {
            const fresh = await onReload();
            if (uncertain) {
              setUncertain(false);
              try {
                sessionStorage.removeItem(uncertaintyKey);
              } catch {
                /* In-memory state still applies. */
              }
            }
            return fresh.orderStatus !== 'AWAITING_PAYMENT';
          }}
          onRetryQr={() => void send('payment-link', {})}
          isLoadingQr={loadingPayment}
          qrError={error}
          expired={paymentExpired}
          retryDisabled={uncertain}
          allowStatusCheck={hadPaymentLink || uncertain}
        />
      )}
      {mode === 'admin' && (
        <>
          {row.address && (
            <p>
              <strong>Địa chỉ tủ:</strong> {row.address}
            </p>
          )}
          {row.instructions && (
            <p>
              <strong>Yêu cầu của khách:</strong> {row.instructions}
            </p>
          )}
          {row.quoteNote && (
            <p>
              <strong>Ghi chú:</strong> {row.quoteNote}
            </p>
          )}
          <dl className="bank-summary">
            <div>
              <dt>Nhận từ</dt>
              <dd>{when(row.pickupAt)}</dd>
            </div>
            <div>
              <dt>Hạn nhận</dt>
              <dd>{when(row.pickupBefore)}</dd>
            </div>
            {row.quotedPrice != null && (
              <div>
                <dt>{row.kind === 'CUSTOM' ? 'Giá shop xác nhận' : 'Giá đơn hàng'}</dt>
                <dd>{money(row.quotedPrice)}</dd>
              </div>
            )}
          </dl>
        </>
      )}
      {mode === 'seller' && (row.instructions || row.quoteNote) && (
        <div className="order-notes-box">
          {row.instructions && (
            <p className="order-instructions">
              <strong>Yêu cầu của khách:</strong> {row.instructions}
            </p>
          )}
          {row.quoteNote && (
            <p className="incident-text">
              <strong>Shop ghi chú:</strong> {row.quoteNote}
            </p>
          )}
        </div>
      )}
      {mode !== 'member' && action !== 'quote' && action !== 'fulfill' && (
        <PreorderAccessories row={row} showTotal={mode === 'seller'} />
      )}
      {!action && mode !== 'admin' && (
        <div
          className={
            mode === 'member' ? `stock-actions ${customerStyles.memberActionRow}` : 'stock-actions'
          }
        >
          {mode === 'member' && row.state === 'QUOTED' && !row.orderId && (
            <Button
              disabled={
                busy || uncertain || !hasQuotedPrice || quoteExpired || accessoryStockBlocked
              }
              onClick={() => {
                setReviewedQuote({
                  price: row.quotedPrice,
                  pickupAt: row.pickupAt,
                  note: row.quoteNote,
                  quoteVersion: row.quoteVersion,
                });
                setAction('accept');
                setConfirm(false);
              }}
            >
              Xác nhận báo giá
            </Button>
          )}
          {mode === 'member' && row.orderStatus === 'AWAITING_PAYMENT' && (
            <Button
              aria-busy={busy}
              disabled={busy || uncertain || paymentExpired}
              onClick={() => void send('payment-link', {})}
            >
              {busy ? 'Đang mở thanh toán…' : 'Thanh toán ngay'}
            </Button>
          )}
          {mode === 'member' && role === 'CUSTOMER' && !uncertain && !showPickupChat && (
            <CustomerOrderChat
              row={row}
              page={page}
              filter={filter}
              className={customerStyles.orderChatInline}
            />
          )}
          {mode === 'member' &&
            row.orderId &&
            row.trackingToken &&
            memberReceiptStatuses.has(row.orderStatus ?? '') && (
              <Button asChild variant="outline">
                <ReceiptContextLink
                  to="/receipt"
                  orderId={row.orderId}
                  trackingToken={row.trackingToken}
                  returnTo={orderReturnHref(row.id, page, filter)}
                >
                  <ClipboardList size={16} aria-hidden="true" />
                  Xem biên nhận
                </ReceiptContextLink>
              </Button>
            )}
          {mode === 'member' &&
            ['COMPLETED', 'DISPUTED'].includes(row.orderStatus ?? '') &&
            row.orderId &&
            row.trackingToken && (
              <Button asChild variant="outline" className={customerStyles.complaintButton}>
                <ReceiptContextLink
                  to="/phan-anh"
                  orderId={row.orderId}
                  trackingToken={row.trackingToken}
                  returnTo={orderReturnHref(row.id, page, filter)}
                >
                  <CircleAlert size={16} aria-hidden="true" />
                  {row.orderStatus === 'DISPUTED' ? 'Theo dõi phản ánh' : 'Phản ánh về hoa'}
                </ReceiptContextLink>
              </Button>
            )}
          {mode === 'seller' && ['REQUESTED', 'QUOTED'].includes(row.state) && (
            <Button
              variant={sellerWaitingForQuote ? 'outline' : 'default'}
              disabled={busy || uncertain}
              onClick={() => {
                const savedPrice = row.quotedFlowerPrice ?? row.quotedPrice;
                setPriceDraft(savedPrice == null ? null : String(savedPrice));
                setNote(row.quoteNote ?? '');
                setReject(false);
                const date = new Date(row.pickupAt);
                setPickup(
                  new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
                    .toISOString()
                    .slice(0, 16),
                );
                setQuoteQuantities(
                  Object.fromEntries(
                    requestedAccessories.map(({ accessoryId, quantity }) => [
                      accessoryId,
                      Number(
                        row.state === 'QUOTED'
                          ? (row.quotedAccessories?.find((item) => item.accessoryId === accessoryId)
                              ?.quantity ?? 0)
                          : quantity,
                      ),
                    ]),
                  ),
                );
                setAction('quote');
                setConfirm(false);
              }}
            >
              {sellerWaitingForQuote ? 'Chỉnh sửa báo giá' : 'Báo giá hoặc từ chối'}
            </Button>
          )}
          {mode === 'seller' &&
            row.kind === 'CUSTOM' &&
            row.orderStatus === 'PAID' &&
            !row.ready && (
              <Button
                disabled={busy || uncertain}
                onClick={() => {
                  setAction('fulfill');
                  setConfirm(false);
                  setFulfillStep(1);
                  setLoadingAccess(null);
                  setError('');
                }}
              >
                Nạp hoa cho đơn này
              </Button>
            )}
          {mode === 'seller' && canSendPreorderPickupOtp(row, role, now) && (
            <Button
              type="button"
              disabled={busy || uncertain || otpSending || otpRemainingSeconds > 0}
              onClick={() => void sendPickupOtp()}
            >
              {otpSending
                ? 'Đang gửi mã…'
                : otpRemainingSeconds > 0
                  ? `Gửi lại mã (${otpRemainingSeconds}s)`
                  : otpHasSent
                    ? 'Gửi lại mã'
                    : 'Gửi mã nhận hoa'}
            </Button>
          )}
          {canCancel && (
            <Button
              variant="outline"
              className={mode === 'member' ? customerStyles.cancelButton : undefined}
              disabled={busy || uncertain}
              onClick={openCancellation}
            >
              Hủy yêu cầu
            </Button>
          )}
        </div>
      )}
      {mode !== 'member' && row.payBefore && row.orderStatus === 'AWAITING_PAYMENT' && (
        <p>
          Thanh toán trước {when(row.payBefore)}. Hết hạn, yêu cầu thanh toán không còn hiệu lực.
        </p>
      )}
      {action && (
        <form
          className={`order-action-card ${action === 'fulfill' ? 'fulfill-wizard' : ''}`}
          onSubmit={(event) => {
            event.preventDefault();
            if (
              action === 'fulfill' &&
              (fulfillStep !== 2 || !fulfillSlots.some((item) => item.id === slot) || !qr.trim())
            ) {
              setError(
                'Chọn ô Pre-order có cảm biến sẵn sàng và nhập mã bó hoa trước khi xác nhận.',
              );
              setFulfillStep(1);
              return;
            }
            if (quoteBlocked) {
              setError('Kiểm tra hoặc điều chỉnh phụ kiện trước khi gửi báo giá.');
              return;
            }
            if (!confirm) {
              setError('Đọc lại thông tin và đánh dấu xác nhận trước khi gửi.');
              return;
            }
            if (action === 'accept') void send('accept', reviewedQuote);
            if (action === 'quote')
              void send('quote', {
                price: reject ? 0 : Number(price),
                pickupAt: new Date(pickup).toISOString(),
                note,
                reject,
                ...(!reject &&
                  requestedAccessories.length > 0 && {
                    accessories: requestedAccessories.flatMap(({ accessoryId, quantity }) => {
                      const accepted = quoteQuantities[accessoryId] ?? 0;
                      return accepted > 0 && accepted <= Number(quantity)
                        ? [{ accessoryId, quantity: accepted }]
                        : [];
                    }),
                  }),
              });
            if (action === 'fulfill') {
              const loadingAccessId = getCurrentAccessId();
              if (!loadingAccessId) {
                setError('Yêu cầu mã mở ô còn hiệu lực trước khi xác nhận nạp hoa.');
                return;
              }
              void send('fulfill', { slotId: slot, qrCode: qr, loadingAccessId });
            }
            if (action === 'cancel') void send('cancel', { reason: note });
          }}
        >
          <fieldset className="order-action-fields" disabled={busy || uncertain}>
            {action === 'fulfill' && (
              <ol className="fulfill-steps" aria-label="Các bước nạp hoa">
                <li
                  aria-current={fulfillStep === 1 ? 'step' : undefined}
                  data-complete={fulfillStep > 1}
                >
                  <span>1</span>
                  <div>
                    <strong>Chọn ô và mã bó hoa</strong>
                    <small>Thông tin bó hoa</small>
                  </div>
                </li>
                <li aria-current={fulfillStep === 2 ? 'step' : undefined}>
                  <span>2</span>
                  <div>
                    <strong>Kiểm tra và xác nhận</strong>
                    <small>Hoàn tất nạp hoa</small>
                  </div>
                </li>
              </ol>
            )}
            <h3 ref={mode === 'member' ? actionHeading : undefined} tabIndex={-1}>
              {action === 'accept'
                ? 'Xác nhận mẫu, giá và lịch nhận'
                : action === 'quote'
                  ? 'Báo giá cho khách'
                  : action === 'fulfill'
                    ? fulfillStep === 1
                      ? 'Chọn ô nhận hoa'
                      : 'Kiểm tra trước khi xác nhận'
                    : 'Kiểm tra trước khi hủy'}
            </h3>
            {action === 'accept' && reviewedQuote && (
              <p>
                Đối chiếu giá, ghi chú và lịch nhận trước khi đồng ý. Bạn sẽ thanh toán ở bước tiếp
                theo.
              </p>
            )}
            {action === 'accept' && reviewedQuoteChanged && (
              <p role="alert" className="error">
                Shop đã cập nhật báo giá trong lúc bạn xem. Đóng phần xác nhận rồi chọn Xác nhận báo
                giá để xem lại.
              </p>
            )}
            {action === 'quote' && (
              <>
                <label className="payout-checkbox">
                  <input
                    type="checkbox"
                    checked={reject}
                    onChange={(event) => setReject(event.target.checked)}
                  />
                  <span>Shop chưa thể nhận đơn này</span>
                </label>
                {!reject && (
                  <>
                    <div className={accessoryStyles.quoteFields}>
                      <div>
                        <label htmlFor={`quote-price-${row.id}`}>Giá bó hoa (đồng)</label>
                        <input
                          id={`quote-price-${row.id}`}
                          type="number"
                          min="1000"
                          max="100000000"
                          step="1"
                          required
                          value={price}
                          onChange={(event) => setPriceDraft(event.target.value)}
                        />
                        {priceDraft === null && (products.isFetching || !price) && (
                          <small>
                            {products.isFetching
                              ? 'Đang lấy giá mẫu…'
                              : 'Chưa có giá mẫu. Nhập giá bó hoa.'}
                          </small>
                        )}
                      </div>
                      <div>
                        <label htmlFor={`quote-pickup-${row.id}`}>Giờ bắt đầu nhận</label>
                        <input
                          id={`quote-pickup-${row.id}`}
                          type="datetime-local"
                          required
                          value={pickup}
                          onChange={(event) => setPickup(event.target.value)}
                        />
                      </div>
                    </div>
                    {requestedAccessories.length > 0 && (
                      <section className={accessoryStyles.section} aria-label="Xác nhận phụ kiện">
                        <strong>Phụ kiện khách yêu cầu</strong>
                        <ul className={accessoryStyles.quoteLines}>
                          {accessoryLines.map(
                            ({
                              accessoryId,
                              name,
                              quantity,
                              accepted,
                              available,
                              lineTotal,
                              stockIssue,
                            }) => (
                              <li key={accessoryId}>
                                <div>
                                  <span>
                                    {name}
                                    {accepted > 0 && ` × ${accepted}`}
                                  </span>
                                  {stockIssue ? (
                                    <>
                                      <small className="error">
                                        Khách chọn {quantity} ·{' '}
                                        {available === 0 ? 'Đã hết hàng' : `Kho còn ${available}`}
                                      </small>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        disabled={busy}
                                        aria-label={
                                          available === 0
                                            ? `Bỏ ${name} khỏi báo giá`
                                            : `Dùng ${available} ${name} còn lại`
                                        }
                                        onClick={() =>
                                          changeQuoteQuantity(accessoryId, available ?? 0)
                                        }
                                      >
                                        {available === 0
                                          ? 'Bỏ khỏi báo giá'
                                          : `Dùng ${available} còn lại`}
                                      </Button>
                                    </>
                                  ) : accepted === 0 ? (
                                    <small>Đã bỏ khỏi báo giá · Khách chọn {quantity}</small>
                                  ) : accepted < Number(quantity) ? (
                                    <small>
                                      Khách chọn {quantity} · Báo giá {accepted}
                                    </small>
                                  ) : null}
                                </div>
                                {accepted > 0 && !stockIssue && (
                                  <strong>
                                    {lineTotal === null ? 'Chưa có giá' : money(lineTotal)}
                                  </strong>
                                )}
                              </li>
                            ),
                          )}
                        </ul>
                        {accessoryStockIssue && (
                          <p role="status">Cập nhật các món thiếu hàng trước khi gửi báo giá.</p>
                        )}
                        {accessoryCatalogVerified === false && accessoryCatalog.isError && (
                          <div>
                            <p role="status">Chưa kiểm tra được tồn phụ kiện.</p>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => void accessoryCatalog.refetch()}
                              disabled={accessoryCatalog.isFetching || busy}
                            >
                              Kiểm tra lại tồn
                            </Button>
                          </div>
                        )}
                        {editableAccessories.length > 0 && (
                          <details className={accessoryStyles.quoteAdjust}>
                            <summary>Điều chỉnh phụ kiện</summary>
                            {editableAccessories.map(
                              ({ accessoryId, name, quantity, available, accepted }) => (
                                <div key={accessoryId} className={accessoryStyles.quoteOption}>
                                  {accepted > 0 ? (
                                    <label htmlFor={`quote-accessory-${row.id}-${accessoryId}`}>
                                      {name} · yêu cầu {quantity}
                                    </label>
                                  ) : (
                                    <span>
                                      {name} · yêu cầu {quantity}
                                    </span>
                                  )}
                                  {accepted > 0 && (
                                    <input
                                      id={`quote-accessory-${row.id}-${accessoryId}`}
                                      aria-label={`Số lượng xác nhận ${name}`}
                                      type="number"
                                      min={1}
                                      max={Math.min(
                                        Number(quantity),
                                        available ?? Number(quantity),
                                      )}
                                      step={1}
                                      value={accepted}
                                      onChange={(event) => {
                                        const value = Number(event.target.value);
                                        if (
                                          Number.isInteger(value) &&
                                          value > 0 &&
                                          value <=
                                            Math.min(
                                              Number(quantity),
                                              available ?? Number(quantity),
                                            )
                                        ) {
                                          changeQuoteQuantity(accessoryId, value);
                                        }
                                      }}
                                    />
                                  )}
                                  <Button
                                    type="button"
                                    variant="outline"
                                    disabled={busy}
                                    aria-label={
                                      accepted > 0
                                        ? `Bỏ ${name} khỏi báo giá`
                                        : `Thêm lại ${name} vào báo giá`
                                    }
                                    onClick={() =>
                                      changeQuoteQuantity(
                                        accessoryId,
                                        accepted > 0
                                          ? 0
                                          : Math.min(
                                              Number(quantity),
                                              available ?? Number(quantity),
                                            ),
                                      )
                                    }
                                  >
                                    {accepted > 0 ? 'Bỏ món' : 'Thêm lại'}
                                  </Button>
                                </div>
                              ),
                            )}
                          </details>
                        )}
                      </section>
                    )}
                  </>
                )}
              </>
            )}
            {(action === 'quote' || action === 'cancel') && (
              <>
                <label htmlFor={`order-note-${row.id}`}>
                  {action === 'cancel'
                    ? 'Lý do hủy'
                    : reject
                      ? 'Lý do từ chối'
                      : 'Ghi chú cho khách'}
                </label>
                <textarea
                  id={`order-note-${row.id}`}
                  minLength={5}
                  maxLength={1000}
                  required
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </>
            )}
            {editingQuote && (
              <div className={accessoryStyles.quoteTotal}>
                <span>Tổng dự kiến</span>
                <strong aria-live="polite">
                  {projectedTotal === null ? 'Chưa đủ thông tin' : money(projectedTotal)}
                </strong>
                <small>
                  {accessoryTotal === null
                    ? accessoryStockIssue
                      ? 'Có phụ kiện không đủ tồn.'
                      : accessoryCatalog.isFetching
                        ? 'Đang lấy giá phụ kiện…'
                        : 'Chưa xác minh được giá một số phụ kiện.'
                    : requestedAccessories.length > 0
                      ? `Tiền phụ kiện: ${money(accessoryTotal)}. Tồn và tổng chính thức được kiểm tra khi gửi.`
                      : 'Giá chính thức được xác nhận khi gửi báo giá.'}
                </small>
              </div>
            )}
            {action === 'fulfill' && fulfillStep === 1 && (
              <>
                <p>
                  Chọn ô tại kiosk của đơn để mở cửa và đặt hoa vào. Sau khi xác nhận nạp thành
                  công, chọn “Gửi mã nhận hoa” để gửi OTP 8 số tới email của khách.
                </p>
                <label htmlFor={`order-slot-${row.id}`}>Ô trống tại tủ nhận</label>
                <select
                  id={`order-slot-${row.id}`}
                  required
                  value={slot}
                  disabled={slots.isPending || slots.isError}
                  aria-describedby={`order-slot-help-${row.id}`}
                  onChange={(event) => {
                    setSlot(event.target.value);
                    setLoadingAccess(null);
                  }}
                >
                  <option value="">Chọn ô Pre-order trống</option>
                  {emptyPreorderSlots.map((item) => (
                    <option key={item.id} value={item.id} disabled={!item.sensorReady}>
                      {item.slotCode}
                      {!item.sensorReady && ' · Cảm biến chưa sẵn sàng'}
                    </option>
                  ))}
                </select>
                {fulfillSlots.some((item) => item.id === slot) &&
                  row.sellerId &&
                  !loadingAccessId && (
                    <AssignPreorderStock
                      key={`assignment:${slot}`}
                      sellerId={row.sellerId}
                      orderId={row.id}
                      slotId={slot}
                      onAssigned={() => {
                        setAction(null);
                        setNotice('Đã giao nhân viên nạp đúng đơn và ô đã chọn.');
                      }}
                    />
                  )}
                <div id={`order-slot-help-${row.id}`}>
                  {slots.isPending ? (
                    <p role="status">Đang tải các ô tại tủ nhận…</p>
                  ) : slots.isError ? (
                    <p role="alert">Chưa tải được các ô tại tủ nhận.</p>
                  ) : emptyPreorderSlots.length === 0 ? (
                    <p className="quiet">Tủ nhận của đơn hiện chưa có ô Pre-order trống.</p>
                  ) : fulfillSlots.length < emptyPreorderSlots.length ? (
                    <p className="quiet">
                      Ô có cảm biến chưa sẵn sàng cần Admin xác minh cảm biến cửa, cảm biến hoa và
                      bật giám sát trong mục Phân bổ kiosk.
                    </p>
                  ) : null}
                  {(slots.isError || (!slots.isPending && fulfillSlots.length === 0)) && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={slots.isFetching}
                      onClick={() => void slots.refetch()}
                    >
                      Tải lại danh sách ô
                    </Button>
                  )}
                </div>
                <label htmlFor={`order-qr-${row.id}`}>Mã định danh bó hoa</label>
                <div className="field-action">
                  <input
                    id={`order-qr-${row.id}`}
                    required
                    maxLength={120}
                    value={qr}
                    aria-describedby={`order-qr-help-${row.id}`}
                    onChange={(event) => setQr(event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setQr(`BOUQUET-${(row.orderCode || row.id.slice(0, 8)).toUpperCase()}`)
                    }
                  >
                    Tạo mã bó tự động
                  </Button>
                </div>
                <p id={`order-qr-help-${row.id}`} className="quiet">
                  Dùng để theo dõi bó hoa trong kho. Có thể nhập mã trên tem QR hoặc tạo mã bó tự
                  động.
                </p>
              </>
            )}
            {action === 'fulfill' && fulfillStep === 2 && (
              <div className="fulfill-review">
                <p>
                  Chỉ xác nhận sau khi đã đặt đúng bó hoa
                  {row.quotedAccessories?.length ? ' và phụ kiện' : ''} vào ô. Thao tác này giữ ô
                  cho khách, chưa mở cửa nhận hoa.
                </p>
                <dl>
                  <div>
                    <dt>Tủ nhận</dt>
                    <dd>{row.kioskName || row.kioskId}</dd>
                  </div>
                  <div>
                    <dt>Ô Pre-order</dt>
                    <dd>
                      {fulfillSlots.find((item) => item.id === slot)?.slotCode ||
                        'Không còn phù hợp'}
                    </dd>
                  </div>
                  <div>
                    <dt>Mã định danh bó hoa</dt>
                    <dd>{qr}</dd>
                  </div>
                </dl>
                <PreorderPackingList items={row.quotedAccessories} />
                <PreorderLoadingButton
                  key={slot}
                  path={`/me/preorders/${row.id}/loading-access`}
                  slotId={slot}
                  onAccess={setLoadingAccess}
                  expired={loadingAccessExpired}
                  disabled={!fulfillSlots.some((item) => item.id === slot)}
                />
              </div>
            )}
            {action === 'cancel' && row.orderStatus === 'PAID' && (
              <div className="order-action-warning" role="alert">
                Đơn đã thanh toán sẽ tạo yêu cầu hoàn tiền để ADMIN xử lý; đây không phải hoàn tiền
                ngân hàng tự động.
              </div>
            )}
            {(action !== 'fulfill' || fulfillStep === 2) && (
              <label className="payout-checkbox">
                <input
                  type="checkbox"
                  checked={confirm}
                  onChange={(event) => setConfirm(event.target.checked)}
                  disabled={busy}
                />
                <span>
                  {action === 'accept' && mode === 'member'
                    ? 'Tôi đồng ý với giá, ghi chú và lịch nhận của shop.'
                    : 'Tôi đã đối chiếu và xác nhận thông tin trên.'}
                </span>
              </label>
            )}
            <div className="stock-actions">
              {action === 'fulfill' && fulfillStep === 1 ? (
                <Button
                  type="button"
                  disabled={
                    !fulfillSlots.some((item) => item.id === slot) || !qr.trim() || slots.isFetching
                  }
                  onClick={() => {
                    setError('');
                    setConfirm(false);
                    setFulfillStep(2);
                  }}
                >
                  Tiếp tục kiểm tra
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={
                    busy ||
                    quoteBlocked ||
                    (action === 'fulfill' &&
                      (!loadingAccessId || !fulfillSlots.some((item) => item.id === slot))) ||
                    (mode === 'member' &&
                      action === 'accept' &&
                      (!confirm || quoteExpired || !hasQuotedPrice || reviewedQuoteChanged))
                  }
                  className={
                    action === 'cancel' || (action === 'quote' && reject)
                      ? 'management-danger-button'
                      : undefined
                  }
                >
                  {busy
                    ? 'Đang gửi…'
                    : action === 'cancel'
                      ? 'Xác nhận hủy đơn'
                      : action === 'quote' && reject
                        ? 'Xác nhận từ chối'
                        : action === 'fulfill'
                          ? 'Xác nhận nạp hoa'
                          : action === 'accept' && mode === 'member'
                            ? 'Đồng ý báo giá'
                            : action === 'quote'
                              ? sellerWaitingForQuote
                                ? 'Cập nhật báo giá'
                                : 'Gửi báo giá'
                              : 'Xác nhận gửi'}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  if (action === 'fulfill' && fulfillStep === 2) {
                    setFulfillStep(1);
                    setConfirm(false);
                  } else {
                    setAction(null);
                  }
                  setError('');
                }}
              >
                {action === 'fulfill' && fulfillStep === 2 ? 'Quay lại' : 'Đóng'}
              </Button>
            </div>
          </fieldset>
        </form>
      )}
      {uncertain && (
        <div className="order-uncertain" role="alert">
          <p>
            Chưa xác nhận được kết quả lần gửi trước. Các thao tác đang khóa để tránh gửi trùng; tải
            lại hồ sơ và đối chiếu trạng thái trước khi tiếp tục.
          </p>
          <Button
            variant="outline"
            disabled={checking || busy}
            onClick={async () => {
              setChecking(true);
              try {
                await onReload();
                try {
                  sessionStorage.removeItem(uncertaintyKey);
                } catch {
                  /* This tab can continue after review. */
                }
                setUncertain(false);
                setAction(null);
                setError('');
                setNotice(
                  'Đã tải lại hồ sơ từ máy chủ. Hãy đối chiếu trạng thái trước khi tạo thao tác mới.',
                );
              } catch {
                setError('Chưa đọc được trạng thái mới. Các thao tác vẫn được khóa.');
              } finally {
                setChecking(false);
              }
            }}
          >
            {checking ? 'Đang kiểm tra…' : 'Kiểm tra kết quả từ máy chủ'}
          </Button>
        </div>
      )}
      <p role="alert" className="error">
        {showingPayment ? '' : error}
      </p>
      <p
        role="status"
        className={sellerWaitingForQuote && notice === 'Đã gửi báo giá.' ? 'sr-only' : undefined}
      >
        {notice}
      </p>
    </>
  );
  return (
    <div
      className={
        mode === 'member' ? `web-order-actions ${customerStyles.orderDetails}` : 'web-order-actions'
      }
    >
      {mode === 'seller' &&
        (!orderClosed(row) || (mode === 'seller' && row.orderStatus === 'COMPLETED')) &&
        !['DISPUTED', 'DISPENSE_FAILED'].includes(row.orderStatus ?? '') &&
        progress}
      {action !== 'quote' && mode !== 'member' && (
        <div
          className={
            mode === 'seller' && orderClosed(row) ? 'order-closed-note' : 'order-next-step'
          }
          role="note"
        >
          {!(mode === 'seller' && orderClosed(row)) && (
            <strong>
              {sellerWaitingForQuote
                ? quoteExpired
                  ? 'Báo giá đã hết hạn'
                  : 'Đã gửi báo giá · Chờ khách xác nhận'
                : sellerWaitingForPayment
                  ? 'Khách đã xác nhận · Chờ thanh toán'
                  : mode === 'admin'
                    ? 'Tình trạng xử lý'
                    : 'Bước tiếp theo'}
            </strong>
          )}
          <p>
            {mode === 'admin'
              ? statusName(row)
              : sellerWaitingForQuote && quoteExpired
                ? 'Chỉnh sửa và gửi báo giá mới nếu shop vẫn nhận được yêu cầu.'
                : sellerWaitingForQuote || sellerWaitingForPayment
                  ? 'Bạn có thể chuẩn bị hoa sau khi đơn đã thanh toán.'
                  : orderNextStep(row, mode)}
          </p>
        </div>
      )}
      {mode === 'member' && (
        <div ref={paymentResult} tabIndex={-1} className={customerStyles.detailFocus}>
          <CustomerQuoteDetails
            row={row}
            now={now}
            pickupAction={
              showPickupChat ? (
                <CustomerOrderChat row={row} page={page} filter={filter} />
              ) : undefined
            }
          >
            {interaction}
          </CustomerQuoteDetails>
        </div>
      )}
      {mode !== 'member' && interaction}
    </div>
  );
}

export default function WebRequests({
  mode,
  sellerId,
}: {
  mode: 'member' | 'seller' | 'admin';
  sellerId?: string;
}) {
  const session = useQuery(sessionQuery);
  const [selectedAdminOrderId, setSelectedAdminOrderId] = useState<string | null>(null);
  const params = useSearchParams();
  const initialPage = Number(params.get('page'));
  const initialFilter = params.get('filter');
  const [page, setPage] = useState(
    Number.isSafeInteger(initialPage) && initialPage > 0 ? initialPage : 1,
  );
  const [filter, setFilter] = useState<OrderFilter>(
    ORDER_FILTERS.find((value) => value === initialFilter) ?? 'all',
  );
  const [resultPage, setResultPage] = useState<number | null>(null);
  const [queueLimit, setQueueLimit] = useState(50);
  const [search, setSearch] = useState('');
  const [pickupDay, setPickupDay] = useState('');
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const base =
    mode === 'member'
      ? '/member/preorders'
      : mode === 'admin'
        ? '/admin/preorders'
        : `/sellers/${sellerId}/preorders`;
  const query = useQuery({
    queryKey: mode === 'seller' ? sellerQueueKey(base, queueLimit) : ['web-orders', base, page],
    queryFn: ({ signal }) =>
      mode === 'seller'
        ? readSellerQueue((next) => request<Page>(`${base}?page=${next}`), queueLimit, signal)
        : request<Page>(`${base}?page=${page}`),
    refetchInterval: (q) =>
      mode !== 'seller' &&
      q.state.data?.items?.some((item) => item.orderStatus === 'AWAITING_PAYMENT')
        ? 5_000
        : 30_000,
    placeholderData: (previous, previousQuery) =>
      mode === 'seller' && previousQuery?.queryKey[1] === base ? previous : undefined,
    enabled: mode !== 'seller' || Boolean(sellerId),
  });
  const history = useQuery({
    queryKey: ['member-history', session.data?.id, page],
    queryFn: () => fetchMemberHistory(page),
    enabled: mode === 'member' && Boolean(session.data?.id),
  });
  const historyItems = (history.data?.items ?? []).filter(
    (order) =>
      !query.data?.items.some(
        (row) => row.orderId === order.id || (row.orderCode && row.orderCode === order.orderCode),
      ),
  );
  const purchaseRows: (WebOrder & { purchase: CustomerHistoryItem })[] = historyItems.map(
    (order) => ({
      id: `purchase-${order.id}`,
      kind: 'STOCK',
      state: order.status,
      orderStatus: order.status,
      orderId: order.id,
      orderCode: order.orderCode,
      productName: order.items.join(', '),
      shopName: order.shopName,
      pickupAt: order.createdAt,
      pickupBefore: '',
      quotedPrice: Number(order.totalAmount),
      productId: '',
      kioskId: '',
      sellerId: '',
      instructions: '',
      quoteNote: null,
      quoteExpiresAt: null,
      checkoutId: null,
      trackingToken: null,
      ready: false,
      payBefore: null,
      purchase: order,
    }),
  );
  const items = query.data?.items ?? [];
  const returnedRequest = mode === 'member' || mode === 'seller' ? params.get('requestId') : null;
  const [openMemberOrder, setOpenMemberOrder] = useState(returnedRequest);
  const [readyNotice, setReadyNotice] = useState('');
  const previousReady = useRef<Map<string, boolean>>(new Map());
  const scrolledRequest = useRef<string | null>(null);
  function changePage(next: number) {
    if (mode === 'member') {
      scrolledRequest.current = null;
      setOpenMemberOrder(null);
      rememberOrderView(null, next, filter);
    }
    setPage(next);
  }
  useEffect(() => {
    if (mode !== 'member' || !query.data) return;
    for (const row of query.data.items) {
      const ready = row.orderStatus === 'PAID' && row.ready;
      if (ready && previousReady.current.get(row.id) === false) {
        setReadyNotice(
          `Đơn ${row.orderCode || row.id}: hoa đã sẵn sàng tại ${row.kioskName || 'tủ nhận'}. Nhận từ ${when(row.pickupAt)} đến ${when(row.pickupBefore)}.`,
        );
      }
      previousReady.current.set(row.id, ready);
    }
  }, [query.data, mode]);
  useEffect(() => {
    if (returnedRequest && query.data && scrolledRequest.current !== returnedRequest) {
      const target = document.getElementById(`preorder-${returnedRequest}`);
      if (target) {
        const historyGroup = target.closest<HTMLDetailsElement>('details[data-order-history]');
        if (historyGroup) historyGroup.open = true;
        if (mode === 'member' && target instanceof HTMLDetailsElement) target.open = true;
        const savedScroll = mode === 'member' ? readOrderScroll(returnedRequest, page) : null;
        if (savedScroll != null) window.scrollTo({ top: savedScroll, behavior: 'instant' });
        else target.scrollIntoView({ block: 'center' });
        if (mode === 'seller')
          target.querySelector<HTMLElement>('summary')?.focus({ preventScroll: true });
        scrolledRequest.current = returnedRequest;
      }
    }
  }, [returnedRequest, query.data, history.data, mode, page]);
  const Container = mode === 'seller' ? 'div' : 'section';
  const loadedItems: (WebOrder & { purchase?: CustomerHistoryItem })[] =
    mode === 'member' ? [...items, ...purchaseRows] : items;
  const searchNeedle = searchable(search.trim());
  const matchesSearch = (row: WebOrder) =>
    !searchNeedle ||
    searchable(
      [row.orderCode, row.id, row.productName, row.shopName, row.kioskName, row.address]
        .filter(Boolean)
        .join(' '),
    ).includes(searchNeedle);
  const filtered = loadedItems.filter(
    (row) =>
      matchesOrderFilter(row, filter, mode) &&
      matchesSearch(row) &&
      (mode !== 'seller' || !pickupDay || pickupDayKey(row.pickupAt) === pickupDay),
  );
  const targetIndex = returnedRequest
    ? filtered.findIndex((row) => row.id === returnedRequest)
    : -1;
  const totalResultPages = Math.max(1, Math.ceil(filtered.length / SELLER_RESULT_SIZE));
  const displayPage =
    mode === 'seller'
      ? Math.min(
          resultPage ?? (targetIndex >= 0 ? Math.floor(targetIndex / SELLER_RESULT_SIZE) + 1 : 1),
          totalResultPages,
        )
      : page;
  const displayItems =
    mode === 'seller'
      ? filtered.slice((displayPage - 1) * SELLER_RESULT_SIZE, displayPage * SELLER_RESULT_SIZE)
      : mode === 'member'
        ? [...filtered].sort(
            (a, b) =>
              Number(matchesOrderFilter(b, 'attention', 'member')) -
              Number(matchesOrderFilter(a, 'attention', 'member')),
          )
        : filtered;
  const interventionCount =
    mode === 'admin'
      ? items.filter((row) => matchesOrderFilter(row, 'attention', 'admin')).length
      : 0;
  const filterName = sellerFilters.find((item) => item.value === filter)?.label ?? 'Tất cả';
  const memberGroups = [
    {
      id: 'attention',
      title: 'Cần bạn xử lý',
      rows: displayItems.filter((row) => matchesOrderFilter(row, 'attention', 'member')),
    },
    {
      id: 'tracking',
      title: 'Đang theo dõi',
      rows: displayItems
        .filter((row) => !orderClosed(row) && !matchesOrderFilter(row, 'attention', 'member'))
        .sort((a, b) => Number(b.ready) - Number(a.ready)),
    },
    { id: 'history', title: 'Đã kết thúc', rows: displayItems.filter(orderClosed) },
  ];
  const openMemberHistory =
    Boolean(returnedRequest && memberGroups[2].rows.some((row) => row.id === returnedRequest)) ||
    filter === 'closed' ||
    Boolean(searchNeedle) ||
    (typeof window !== 'undefined' && window.location.hash === '#member-orders');
  function rememberMemberAction(
    event: { target: EventTarget | null; currentTarget: HTMLDetailsElement },
    requestId: string,
  ) {
    if (!(event.target instanceof Element)) return;
    const trigger = event.target.closest('a,button,summary');
    if (!trigger) return;
    const closing =
      trigger.tagName === 'SUMMARY' &&
      trigger.parentElement === event.currentTarget &&
      event.currentTarget.open;
    scrolledRequest.current = closing ? null : requestId;
    rememberOrderView(closing ? null : requestId, page, filter);
  }
  const selectedAdminOrder =
    mode === 'admin' ? displayItems.find((row) => row.id === selectedAdminOrderId) : undefined;
  const renderOrder = (row: (typeof displayItems)[number]) =>
    row.purchase ? (
      <CustomerPurchaseCard
        key={row.id}
        order={row.purchase}
        disclosureGroup="customer-orders"
        supportHref={`/lien-he?${new URLSearchParams({
          orderCode: row.purchase.orderCode,
          from: orderReturnHref(row.id, page, filter),
        })}`}
        id={`preorder-${row.id}`}
        open={row.id === openMemberOrder || undefined}
        onClickCapture={(event) => rememberMemberAction(event, row.id)}
        onToggle={(event) => {
          const isOpen = event.currentTarget.open;
          setOpenMemberOrder((current) => (isOpen ? row.id : current === row.id ? null : current));
        }}
      />
    ) : (
      <li key={row.id}>
        <details
          id={`preorder-${row.id}`}
          name={mode === 'member' ? 'customer-orders' : undefined}
          open={row.id === (mode === 'member' ? openMemberOrder : returnedRequest) || undefined}
          onClickCapture={
            mode === 'member' ? (event) => rememberMemberAction(event, row.id) : undefined
          }
          onToggle={
            mode === 'member'
              ? (event) => {
                  const isOpen = event.currentTarget.open;
                  setOpenMemberOrder((current) =>
                    isOpen ? row.id : current === row.id ? null : current,
                  );
                }
              : undefined
          }
        >
          <summary
            className={
              mode === 'seller'
                ? styles.orderSummary
                : mode === 'member'
                  ? customerStyles.summary
                  : 'admin-preorder-row'
            }
          >
            {mode === 'seller' ? (
              <span className={styles.orderHeading}>
                <strong>{row.orderCode || `Yêu cầu ${row.id.slice(0, 8)}`}</strong>
                <span className={styles.kind}>
                  {row.kind === 'CUSTOM' ? 'Hoa theo yêu cầu' : 'Hoa có sẵn'}
                </span>
                <span
                  className={styles.status}
                  data-status={
                    row.ready && row.orderStatus === 'PAID' ? 'READY' : row.orderStatus || row.state
                  }
                >
                  {statusName(row)}
                </span>
              </span>
            ) : mode === 'member' ? (
              <CustomerOrderSummary row={row} />
            ) : (
              <>
                <span className="admin-preorder-cell">
                  <strong>{row.orderCode || `Yêu cầu ${row.id.slice(0, 8)}`}</strong>
                  <small>
                    {row.productName || (row.kind === 'CUSTOM' ? 'Hoa theo yêu cầu' : 'Hoa có sẵn')}
                  </small>
                </span>
                <span className="admin-preorder-cell">
                  <strong>{row.shopName || 'Chưa rõ shop'}</strong>
                  <small>{row.kioskName || 'Chưa rõ tủ nhận'}</small>
                </span>
                <span className="admin-preorder-cell admin-preorder-schedule">
                  <span>{when(row.pickupAt)}</span>
                  <small>{row.quotedPrice == null ? 'Chưa báo giá' : money(row.quotedPrice)}</small>
                </span>
                <span className="admin-preorder-state">
                  <span
                    className="order-status-pill"
                    data-status={
                      row.ready && row.orderStatus === 'PAID'
                        ? 'READY'
                        : row.orderStatus || row.state
                    }
                  >
                    {statusName(row)}
                  </span>
                  <ChevronDown size={17} aria-hidden="true" />
                </span>
              </>
            )}
            {mode === 'seller' && (
              <>
                <span className={styles.orderBody}>
                  <span className={styles.product}>
                    <ProductThumbnail
                      sellerId={sellerId ?? row.sellerId}
                      productId={row.productId}
                      productName={row.productName || 'mẫu hoa'}
                      className={styles.flowerIcon}
                    />
                    <span>
                      <small>Mẫu hoa</small>
                      <strong>{row.productName || 'Hoa theo yêu cầu'}</strong>
                    </span>
                  </span>
                  <span>
                    <small>Tủ nhận hoa</small>
                    <strong>{row.kioskName || row.kioskId}</strong>
                    {row.address && <span className={styles.address}>{row.address}</span>}
                  </span>
                  <span>
                    <small>Thời gian nhận</small>
                    <strong>{pickupDate(row.pickupAt)}</strong>
                    <span className={styles.address}>
                      {pickupClock(row.pickupAt)} –{' '}
                      {pickupDayKey(row.pickupAt) !== pickupDayKey(row.pickupBefore)
                        ? `${pickupDate(row.pickupBefore)} · `
                        : ''}
                      {pickupClock(row.pickupBefore)}
                    </span>
                  </span>
                  <span className={styles.price}>
                    <small>Giá xác nhận</small>
                    <strong>
                      {row.quotedPrice == null ? 'Chưa báo giá' : money(row.quotedPrice)}
                    </strong>
                  </span>
                </span>
                <span className={styles.disclosure}>
                  <span className={styles.nextTask}>{sellerOrderHint(row)}</span>
                  <span className={styles.showDetails}>
                    {sellerOrderActionLabel(row)} <ArrowRight size={15} aria-hidden="true" />
                  </span>
                  <span className={styles.hideDetails}>Thu gọn chi tiết</span>
                </span>
              </>
            )}
          </summary>
          <OrderActions
            row={row}
            base={base}
            mode={mode}
            role={session.data?.role}
            userId={session.data?.id}
            page={page}
            filter={filter}
            onReload={async () => {
              const fresh = await query.refetch();
              const updated = fresh.data?.items.find((item) => item.id === row.id);
              if (fresh.isError || !updated) throw new Error('Order could not be reloaded.');
              return updated;
            }}
          />
        </details>
      </li>
    );
  return (
    <Container
      id="web-orders"
      className={`web-orders ${mode === 'seller' ? styles.sellerOrders : mode === 'admin' ? 'admin-preorders' : ''}`}
      aria-labelledby="web-orders-title"
    >
      {mode === 'member' ? (
        <h1 id="web-orders-title" className="sr-only">
          Đơn hàng
        </h1>
      ) : (
        <h2 id="web-orders-title" className={mode === 'seller' ? 'sr-only' : undefined}>
          {mode === 'admin' ? 'Danh sách đơn từ website' : 'Đơn đặt trước từ website'}
        </h2>
      )}
      {mode === 'member' && params.get('paymentReturn') === '1' && (
        <CustomerPaymentReturn
          row={items.find((row) => row.id === returnedRequest)}
          loading={query.isPending}
          failed={query.isError}
        />
      )}
      {mode === 'member' && (
        <p role="status" aria-live="polite" className="sr-only">
          {readyNotice}
        </p>
      )}
      {mode === 'member' && (
        <div className={customerStyles.memberToolbar}>
          <div className={customerStyles.memberSearch}>
            <label>
              <span className="sr-only">Tìm đơn hàng trong trang</span>
              <input
                type="search"
                placeholder="Tìm hoa, shop hoặc mã đơn"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            {search && (
              <button
                type="button"
                className={customerStyles.memberSearchClear}
                aria-label="Xóa từ khóa tìm kiếm"
                onClick={() => setSearch('')}
              >
                <X size={15} aria-hidden="true" />
              </button>
            )}
          </div>
          <label className={customerStyles.memberFilter}>
            <span className="sr-only">Lọc đơn hàng</span>
            <select
              value={filter}
              onChange={(event) => {
                const value = event.currentTarget.value as OrderFilter;
                setFilter(value);
                if (value !== 'all') setOpenMemberOrder(null);
              }}
            >
              {!memberFilters.some(({ value }) => value === filter) && (
                <option value={filter}>{filterName}</option>
              )}
              {memberFilters.map(({ value, label }) => (
                <option key={value} value={value}>
                  {value === 'all' ? 'Tất cả trạng thái' : label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {mode === 'admin' && (
        <>
          <div className="admin-preorder-toolbar" role="group" aria-label="Bộ lọc đơn đặt trước">
            <label className="admin-preorder-search">
              <span>Tìm đơn trong trang</span>
              <span className="admin-preorder-search-input">
                <Search size={17} aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Mã đơn, tên shop hoặc tủ…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </span>
            </label>
            <label>
              <span>Trạng thái</span>
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value as OrderFilter)}
              >
                {sellerFilters.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {value === 'attention' ? 'Cần theo dõi' : label}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              variant="outline"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              <RefreshCw size={16} aria-hidden="true" />
              {query.isFetching ? 'Đang cập nhật…' : 'Làm mới'}
            </Button>
          </div>
          {query.isSuccess && (
            <div className="admin-preorder-results">
              <p role="status">
                Trang {page} · {filtered.length}/{items.length} yêu cầu
              </p>
              {interventionCount > 0 && (
                <button
                  type="button"
                  className="admin-preorder-flag"
                  aria-pressed={filter === 'attention'}
                  onClick={() => setFilter(filter === 'attention' ? 'all' : 'attention')}
                >
                  Cần theo dõi <strong>{interventionCount}</strong>
                </button>
              )}
            </div>
          )}
        </>
      )}
      {mode === 'seller' && (
        <>
          <div className={styles.filters}>
            <div className={styles.filterHeading}>
              <div>
                <h3>Quản lý đơn đặt trước</h3>
                <p>Chọn trạng thái, tìm đơn rồi mở chi tiết để xử lý.</p>
              </div>
              <Button
                variant="outline"
                disabled={query.isFetching}
                onClick={() => void query.refetch()}
              >
                <RefreshCw size={15} aria-hidden="true" />
                {query.isFetching ? 'Đang cập nhật…' : 'Làm mới'}
              </Button>
            </div>
            <label className={styles.mobileStatus}>
              <span>Trạng thái đơn</span>
              <select
                value={filter}
                onChange={(event) => {
                  setFilter(event.target.value as OrderFilter);
                  setResultPage(1);
                }}
              >
                {sellerFilters.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                    {query.isSuccess
                      ? ` (${items.filter((row) => matchesOrderFilter(row, value, mode)).length})`
                      : ''}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.tabs} role="group" aria-label="Lọc trạng thái đơn">
              {sellerFilters.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => {
                    setFilter(value);
                    setResultPage(1);
                  }}
                >
                  {label}
                  {query.isSuccess && (
                    <span>
                      {items.filter((row) => matchesOrderFilter(row, value, mode)).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className={styles.searchBar}>
              <label className={styles.searchField}>
                <span>Tìm đơn của shop</span>
                <input
                  type="search"
                  value={search}
                  placeholder="Mã đơn, tên hoa hoặc kiosk…"
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setResultPage(1);
                  }}
                />
              </label>
              <label className={styles.dateField}>
                <span>Lọc theo ngày nhận</span>
                <input
                  type="date"
                  value={pickupDay}
                  onInput={(event) => {
                    setPickupDay(event.currentTarget.value);
                    setResultPage(1);
                  }}
                  onChange={(event) => {
                    setPickupDay(event.target.value);
                    setResultPage(1);
                  }}
                />
              </label>
              <div className={styles.mobileDate}>
                <button
                  type="button"
                  aria-expanded={dateFilterOpen}
                  onClick={() => setDateFilterOpen((open) => !open)}
                >
                  {pickupDay
                    ? `Ngày nhận: ${pickupDate(`${pickupDay}T12:00:00+07:00`)}`
                    : 'Lọc theo ngày nhận'}
                </button>
                {dateFilterOpen && (
                  <label>
                    <span>Ngày nhận hoa</span>
                    <input
                      type="date"
                      value={pickupDay}
                      onChange={(event) => {
                        setPickupDay(event.target.value);
                        setResultPage(1);
                      }}
                    />
                  </label>
                )}
              </div>
              {(search || pickupDay || filter !== 'all') && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch('');
                    setPickupDay('');
                    setFilter('all');
                    setResultPage(1);
                  }}
                >
                  Xóa bộ lọc
                </Button>
              )}
            </div>
          </div>
          {query.isSuccess && (
            <p className={styles.resultCount} role="status">
              {filterName}: {filtered.length} yêu cầu
              {filtered.length > 0
                ? ` · Hiển thị ${(displayPage - 1) * SELLER_RESULT_SIZE + 1}–${Math.min(displayPage * SELLER_RESULT_SIZE, filtered.length)}`
                : ''}
              .{' '}
              {query.data?.hasMore
                ? `Còn đơn chưa được tải; kết quả hiện tính trên ${items.length} yêu cầu đã tải.`
                : `Đã tìm trên ${items.length} yêu cầu của shop.`}
            </p>
          )}
        </>
      )}
      {mode === 'member' && query.isError && !query.data && !history.isError && (
        <p role="alert">Chưa tải được đơn đặt trước; giao dịch mua hoa vẫn hiển thị bên dưới.</p>
      )}
      {mode === 'member' && query.isError && (
        <Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>
          Tải lại đơn đặt trước
        </Button>
      )}
      {mode === 'member' && history.isError && (
        <div role="alert" className={customerStyles.historyNotice}>
          Chưa tải được giao dịch mua hoa. Bạn vẫn có thể xử lý đơn đặt trước.
          <Button variant="outline" onClick={() => void history.refetch()}>
            Tải lại giao dịch
          </Button>
        </div>
      )}
      {query.isPending && (mode !== 'member' || history.isPending) ? (
        <p role="status">Đang tải yêu cầu…</p>
      ) : query.isError && !query.data && (mode !== 'member' || history.isError) ? (
        <p role="alert">Chưa tải được yêu cầu. Hãy chọn cập nhật để thử lại.</p>
      ) : (
        <>
          {!filtered.length && (
            <div className="operations-empty" role="status">
              {mode === 'member' ? (
                <Flower2 size={32} aria-hidden="true" />
              ) : (
                <ClipboardList size={32} aria-hidden="true" />
              )}
              <h3>
                {mode === 'member'
                  ? history.isPending
                    ? 'Đang tải giao dịch…'
                    : loadedItems.length || query.data?.hasMore || history.data?.hasMore || page > 1
                      ? loadedItems.length
                        ? 'Không tìm thấy đơn phù hợp'
                        : 'Chưa có đơn ở trang này'
                      : 'Chưa có đơn hàng'
                  : items.length
                    ? 'Không tìm thấy yêu cầu phù hợp'
                    : 'Chưa có đơn đặt trước'}
              </h3>
              <p>
                {items.length
                  ? mode === 'seller'
                    ? 'Thử đổi trạng thái, từ khóa hoặc ngày nhận để tìm đơn.'
                    : mode === 'admin'
                      ? 'Thử đổi trạng thái hoặc từ khóa. Bộ lọc áp dụng cho trang đang xem.'
                      : 'Không có yêu cầu phù hợp bộ lọc trong trang này.'
                  : mode === 'member' &&
                      (filter !== 'all' || Boolean(searchNeedle)) &&
                      loadedItems.length > 0
                    ? 'Không có đơn phù hợp bộ lọc trong trang này. Thử xóa lọc hoặc kiểm tra trang khác.'
                    : mode === 'member' && page === 1
                      ? 'Chọn một mẫu hoa bạn thích và gửi mong muốn cho shop. Đơn của bạn sẽ xuất hiện tại đây.'
                      : 'Chưa có yêu cầu ở trang này.'}
              </p>
              {mode === 'member' &&
                (filter !== 'all' || Boolean(searchNeedle)) &&
                loadedItems.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setFilter('all');
                      setSearch('');
                    }}
                  >
                    Xóa bộ lọc
                  </Button>
                )}
              {mode === 'member' &&
                !history.isPending &&
                !history.isError &&
                !query.isError &&
                loadedItems.length === 0 &&
                !query.data?.hasMore &&
                !history.data?.hasMore &&
                page === 1 && (
                  <Link href="/dat-hoa" className="button button-outline">
                    Khám phá hoa <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                )}
            </div>
          )}
          {mode === 'member' ? (
            <div className={customerStyles.orderGroups}>
              {memberGroups.map(
                ({ id, title, rows }) =>
                  rows.length > 0 &&
                  (id === 'history' ? (
                    <details
                      key={id}
                      data-order-history
                      className={customerStyles.orderHistory}
                      open={openMemberHistory || undefined}
                    >
                      <summary>
                        {title} <span className={customerStyles.groupCount}>{rows.length}</span>
                        <ChevronDown size={16} aria-hidden="true" />
                      </summary>
                      <ul className="member-orders customer-order-list">{rows.map(renderOrder)}</ul>
                    </details>
                  ) : (
                    <section
                      key={id}
                      className={customerStyles.orderGroup}
                      aria-labelledby={`order-group-${id}`}
                    >
                      <h2 id={`order-group-${id}`}>
                        {title} <span className={customerStyles.groupCount}>{rows.length}</span>
                      </h2>
                      <ul className="member-orders customer-order-list">{rows.map(renderOrder)}</ul>
                    </section>
                  )),
              )}
            </div>
          ) : mode === 'admin' ? (
            <>
              <WorkspaceTable label="Giám sát đơn đặt trước">
                <table className="admin-monitor-table">
                  <thead>
                    <tr>
                      <th scope="col">Đơn / Mẫu hoa</th>
                      <th scope="col">Shop / Kiosk</th>
                      <th scope="col">Lịch nhận / Giá</th>
                      <th scope="col">Trạng thái</th>
                      <th scope="col">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayItems.map((row) => (
                      <tr className="admin-monitor-order-row" key={row.id}>
                        <td>
                          <strong>{row.orderCode || `Yêu cầu ${row.id.slice(0, 8)}`}</strong>
                          <span className="table-secondary">
                            {row.productName ||
                              (row.kind === 'CUSTOM' ? 'Hoa theo yêu cầu' : 'Hoa có sẵn')}
                          </span>
                        </td>
                        <td>
                          <strong>{row.shopName || '—'}</strong>
                          <span className="table-secondary">{row.kioskName || '—'}</span>
                        </td>
                        <td>
                          <time dateTime={row.pickupAt}>{when(row.pickupAt)}</time>
                          <span className="table-secondary">
                            {row.quotedPrice == null ? 'Chưa báo giá' : money(row.quotedPrice)}
                          </span>
                        </td>
                        <td>
                          <span
                            className="table-badge"
                            data-state={
                              row.ready && row.orderStatus === 'PAID'
                                ? 'READY'
                                : row.orderStatus || row.state
                            }
                          >
                            {statusName(row)}
                          </span>
                        </td>
                        <td>
                          <Button
                            type="button"
                            variant="outline"
                            aria-label={`Xem đơn ${row.orderCode || row.id}`}
                            onClick={() => setSelectedAdminOrderId(row.id)}
                          >
                            Xem
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </WorkspaceTable>
              <Modal
                open={!!selectedAdminOrder}
                onClose={() => setSelectedAdminOrderId(null)}
                title={`Đơn ${selectedAdminOrder?.orderCode || selectedAdminOrder?.id.slice(0, 8) || ''}`}
                size="lg"
                className="admin-monitor-dialog"
              >
                {selectedAdminOrder && (
                  <OrderActions
                    key={selectedAdminOrder.id}
                    row={selectedAdminOrder}
                    base={base}
                    mode="admin"
                    role={session.data?.role}
                    userId={session.data?.id}
                    page={page}
                    filter={filter}
                    onReload={async () => {
                      const fresh = await query.refetch();
                      const updated = fresh.data?.items.find(
                        (item) => item.id === selectedAdminOrder.id,
                      );
                      if (fresh.isError || !updated)
                        throw new Error('Order could not be reloaded.');
                      return updated;
                    }}
                  />
                )}
              </Modal>
            </>
          ) : (
            <ul className={styles.orderList}>{displayItems.map(renderOrder)}</ul>
          )}
          {mode === 'seller' && query.data?.hasMore && (
            <div className={styles.loadMore}>
              <p>Chưa tải hết đơn của shop. Tải thêm để tiếp tục tìm và thống kê.</p>
              <Button
                variant="outline"
                disabled={query.isFetching}
                onClick={() => setQueueLimit((value) => value + 50)}
              >
                Tải thêm đơn của shop
              </Button>
            </div>
          )}
          {(mode === 'seller'
            ? totalResultPages > 1
            : page > 1 || query.data?.hasMore || (mode === 'member' && history.data?.hasMore)) && (
            <nav className="order-pagination" aria-label="Phân trang đơn đặt trước">
              <Button
                variant="outline"
                disabled={displayPage === 1 || query.isFetching}
                onClick={() =>
                  mode === 'seller' ? setResultPage(displayPage - 1) : changePage(page - 1)
                }
              >
                <ArrowLeft size={15} aria-hidden="true" />
                <span>Trang trước</span>
              </Button>
              <span className="order-page-indicator">
                Trang {displayPage}
                {mode === 'seller' ? ` / ${totalResultPages}` : ''}
              </span>
              <Button
                variant="outline"
                disabled={
                  (mode === 'seller'
                    ? displayPage >= totalResultPages
                    : !(query.data?.hasMore || (mode === 'member' && history.data?.hasMore))) ||
                  query.isFetching ||
                  (mode === 'member' && history.isFetching)
                }
                onClick={() =>
                  mode === 'seller' ? setResultPage(displayPage + 1) : changePage(page + 1)
                }
              >
                <span>Trang sau</span>
                <ArrowRight size={15} aria-hidden="true" />
              </Button>
            </nav>
          )}
        </>
      )}
    </Container>
  );
}
