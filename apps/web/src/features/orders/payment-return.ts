const key = 'florabot-preorder-payment';

export function rememberPreorderPayment(requestId: string, page: number, orderCode: number) {
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({ requestId, page, orderCode, savedAt: Date.now() }),
    );
  } catch {
    // Payment remains available when browser storage is disabled.
  }
}

export function preorderPaymentReturn(search: string): string | null {
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
      Date.now() - saved.savedAt > 86400000
    )
      return null;
    sessionStorage.removeItem(key);
    return `/tai-khoan?requestId=${encodeURIComponent(saved.requestId)}&page=${saved.page}&paymentReturn=1#web-orders`;
  } catch {
    return null;
  }
}
