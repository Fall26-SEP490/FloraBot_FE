import type { Query } from '@tanstack/react-query';

// These reads change after explicit edits or server notifications, not on a timer.
const staticReads =
  /^(products|product-photos|dashboard-products|dashboard-seller-staff|preorder-assignment-staff|.*(?:accessories|payment-channel|revenue|packages|profile|config|tags|templates).*)$/;
const sessionReads = /^(session|auth-config)$/;

export function portalRefreshCandidate(query: Query, periodic = false): boolean {
  const root = String(query.queryKey[0] ?? '');
  if (!query.isActive() || sessionReads.test(root)) return false;
  if (!periodic) return true;
  if (query.state.fetchStatus !== 'idle') return false;
  if (staticReads.test(root)) return false;
  // A component polling its own state already has fresh data; do not fetch it twice.
  return Date.now() - query.state.dataUpdatedAt >= 30_000;
}
