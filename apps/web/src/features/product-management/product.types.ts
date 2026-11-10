import type { components } from '../../../../../packages/contracts/src/generated/api';

export interface ProductItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  tags?: string[];
  status: string;
  shelfLifeHours?: number | null;
  inventoryKind?: 'ARTIFICIAL' | 'LEGACY_FRESH' | string | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  quantity?: number | string;
}

export type Product = ProductItem;

export interface CreateProductInput {
  quantity: number;
  kioskId: string;
  name: string;
  description: string;
  price: number;
  tags: string[];
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

export interface UpdateProductMetadataInput {
  quantity?: number;
  name: string;
  description: string;
  price: number;
  tags: string[];
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

export interface ProductKioskOption {
  id: string;
  code: string;
  name: string;
  status: string;
}

export type SellerKiosk = components['schemas']['SellerKioskDto'];
export type PhotoItem = components['schemas']['ProductPhotoResponse'] & {
  isCover?: boolean;
  sortOrder?: number;
};
export type PhotoPage = Omit<components['schemas']['ProductPhotoPage'], 'items'> & {
  items: PhotoItem[];
};

export const PAGE_SIZE = 8;

export const statusNames: Record<string, string> = {
  ACTIVE: 'Đang bán',
  INACTIVE: 'Ngừng bán',
  DRAFT: 'Bản nháp',
};
