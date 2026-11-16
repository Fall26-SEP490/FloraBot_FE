import type { components } from '../../../../../packages/contracts/src/generated/api';

export type RequestedPreorderAccessory = components['schemas']['RequestedPreorderAccessory'];
export type QuotedPreorderAccessory = components['schemas']['QuotedPreorderAccessory'];

export type WebOrder = {
  id: string;
  kind: 'CUSTOM' | 'STOCK';
  state: string;
  productId: string;
  kioskId: string;
  sellerId: string;
  instructions: string;
  pickupAt: string;
  pickupBefore: string;
  quotedPrice: number | null;
  quotedFlowerPrice?: number | string | null;
  quotedAccessoryTotal?: number | string;
  quoteVersion?: number | string;
  requestedAccessories?: RequestedPreorderAccessory[];
  quotedAccessories?: QuotedPreorderAccessory[];
  quoteNote: string | null;
  quoteExpiresAt: string | null;
  orderId: string | null;
  checkoutId: string | null;
  orderCode: string | null;
  orderStatus: string | null;
  trackingToken: string | null;
  ready: boolean;
  payBefore: string | null;
  productName?: string | null;
  shopName?: string | null;
  kioskName?: string | null;
  address?: string | null;
};

export type OrderPage = {
  items: WebOrder[];
  page: number;
  hasMore: boolean;
};

export type Page = OrderPage;

export type OrderPhase = {
  state: string;
  orderStatus: string | null;
  ready: boolean;
};

export type OrderMode = 'member' | 'seller' | 'admin';

export type OrderFilter =
  'all' | 'attention' | 'requested' | 'quoted' | 'payment' | 'preparing' | 'ready' | 'closed';

export type SendPreorderPickupOtpResponse = {
  requestId: string;
  orderId: string;
  recipientMasked: string;
  expiresAt: string;
  resendAfterSeconds: number;
};
