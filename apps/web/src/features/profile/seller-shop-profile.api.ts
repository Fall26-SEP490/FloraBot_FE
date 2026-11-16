import { queryOptions } from '@tanstack/react-query';
import { request, type Session } from '@/shared/lib/api';
import type { components } from '../../../../../packages/contracts/src/generated/api';

type SellerShopProfile = components['schemas']['SellerShopProfileResponse'];
type ShopProfileUpdate = components['schemas']['UpdateSellerShopProfileRequest'];

export function sellerShopProfileQuery(session: Session | undefined) {
  return queryOptions({
    queryKey: ['seller-shop-profile', session?.id, session?.sellerId],
    queryFn: () => request<SellerShopProfile>('/me/shop'),
    enabled: session?.role === 'SELLER' && Boolean(session.sellerId),
    staleTime: 60_000,
    retry: false,
  });
}

export function updateSellerShopProfile(payload: ShopProfileUpdate) {
  return request<SellerShopProfile>('/me/shop', payload, true, 'PATCH');
}

export function shopAccountName(session: Session, shop: SellerShopProfile | undefined): string {
  return session.role === 'SELLER' ? shop?.shopName?.trim() || session.name : session.name;
}
