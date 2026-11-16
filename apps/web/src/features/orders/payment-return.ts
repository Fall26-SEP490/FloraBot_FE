const key = 'florabot-preorder-payment';
const maxAge = 86_400_000;

const idPattern = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function validPaymentCode(code: string | null) {
  return code && /^[1-9]\d{0,15}$/.test(code) && Number.isSafeInteger(Number(code)) ? code : null;
}

type PaymentReturnTarget =
  | { kind: 'preorder'; resourceId: string; page: number }
  | { kind: 'rental'; resourceId: string }
  | { kind: 'renewal'; resourceId: string; kioskId: string };

function paymentReturnPath(target: PaymentReturnTarget) {
  if (!target || !idPattern.test(target.resourceId)) return null;
  const id = target.resourceId;
  if (
    target.kind === 'preorder' &&
    Number.isInteger(target.page) &&
    target.page >= 1 &&
    target.page <= 100000
  )
    return `/tai-khoan?requestId=${id}&page=${target.page}&paymentReturn=1#web-orders`;
  if (target.kind === 'rental')
    return `/thue-kiosk?applicationId=${id}&paymentReturn=1#rental-application`;
  if (target.kind === 'renewal' && target.kioskId && idPattern.test(target.kioskId))
    return `/seller/subscriptions?renewalId=${id}#renewal-${target.kioskId}`;
  return null;
}

type SavedTarget = { code: string; target: PaymentReturnTarget; savedAt: number };
const localKey = (userId: string) => `florabot-payment-return:${userId}`;

function recentTargets(userId: string): SavedTarget[] {
  const entries = JSON.parse(localStorage.getItem(localKey(userId)) || '[]');
  return Array.isArray(entries)
    ? entries.filter(
        (entry) =>
          entry &&
          Number.isFinite(entry.savedAt) &&
          Date.now() >= entry.savedAt &&
          Date.now() - entry.savedAt <= maxAge,
      )
    : [];
}

export function rememberPaymentReturn(
  userId: string | undefined,
  orderCode: number | string | null | undefined,
  target: PaymentReturnTarget,
) {
  const code = validPaymentCode(orderCode == null ? null : String(orderCode));
  if (!userId || !code || !paymentReturnPath(target)) return;
  try {
    const entries = recentTargets(userId).filter((entry) => entry.code !== code);
    localStorage.setItem(
      localKey(userId),
      JSON.stringify([{ code, target, savedAt: Date.now() }, ...entries.slice(0, 9)]),
    );
  } catch {
    // Payment and manual lookup still work if storage is unavailable.
  }
}

export function findPaymentReturn(code: string, userId: string, role: string) {
  try {
    const saved = recentTargets(userId).find((entry) => entry.code === code)?.target;
    if (
      saved &&
      ((saved.kind === 'preorder' && role === 'CUSTOMER') ||
        (saved.kind === 'rental' && (role === 'CUSTOMER' || role === 'SELLER')) ||
        (saved.kind === 'renewal' && role === 'SELLER'))
    ) {
      const path = paymentReturnPath(saved);
      if (path) return path;
    }
  } catch {
    // The old in-tab pointer may still be available.
  }
  return role === 'CUSTOMER' ? preorderPaymentReturn(`?orderCode=${code}`) : null;
}

export function rememberPreorderPayment(
  requestId: string,
  page: number,
  orderCode: number,
  userId?: string,
) {
  rememberPaymentReturn(userId, orderCode, { kind: 'preorder', resourceId: requestId, page });
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({ requestId, page, orderCode, savedAt: Date.now() }),
    );
  } catch {
    // Payment remains available when browser storage is disabled.
  }
}

function preorderPaymentReturn(search: string): string | null {
  const code = new URLSearchParams(search).get('orderCode');
  if (!code) return null;
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (
      !saved ||
      String(saved.orderCode) !== code ||
      !/^[0-9a-f-]{36}$/i.test(saved.requestId) ||
      !Number.isSafeInteger(saved.page) ||
      saved.page < 1 ||
      saved.page > 100000 ||
      !Number.isFinite(saved.savedAt) ||
      Date.now() - saved.savedAt > maxAge
    )
      return null;
    sessionStorage.removeItem(key);
    return `/tai-khoan?requestId=${encodeURIComponent(saved.requestId)}&page=${saved.page}&paymentReturn=1#web-orders`;
  } catch {
    return null;
  }
}
