import type { components } from '../../../../../packages/contracts/src/generated/api';
import type { ActiveTaskRole } from '../../StaffTasks';

export type Slot = components['schemas']['SellerSlotResponse'];
export type Product = components['schemas']['ProductResponse'];
export type SellerKiosk = components['schemas']['SellerKioskDto'];
export type Accessory = components['schemas']['SellerAccessoryResponse'];

export type StaffStockPayload = {
  id: string;
  productId: string;
  slotId: string;
  qrCode: string;
};

export type StaffStockOptions = {
  products: { id: string; name: string }[];
  slots: { id: string; code: string }[];
  actions: { id: string; qrCode: string; createdAt: string }[];
};

export type StaffStockFields = Omit<StaffStockPayload, 'id'> & { confirm: boolean };

export type StaffStockProps = {
  taskId: string;
  actorId: string;
  sellerId?: string | null;
  role?: ActiveTaskRole;
  active: boolean;
  apiBase?: string;
};
