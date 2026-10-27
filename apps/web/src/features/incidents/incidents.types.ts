import type { components } from '../../../../../packages/contracts/src/generated/api';
import type { ActiveTaskRole } from '../task-management/task-management.types';

export type AdminIncidentResponse = components['schemas']['AdminIncidentResponse'];
export type AdminIncidentDetail = components['schemas']['AdminIncidentDetail'];
export type AdminIncidentPage = components['schemas']['AdminIncidentPage'];
export type ResolveDeviceFaultRequest = components['schemas']['ResolveDeviceFaultRequest'];
export type ReportDeviceFaultRequest = components['schemas']['ReportDeviceFaultRequest'];
export type SellerSlot = components['schemas']['SellerSlotResponse'];
export type FlowResult = components['schemas']['FlowResult'];

export type StaffIncidentResolutionAttempt = {
  id: string;
  version: number;
  report: string;
};

export type StaffIncidentResolutionProps = {
  taskId: string;
  actorId: string;
  sellerId?: string | null;
  role?: ActiveTaskRole;
  version: number;
  active: boolean;
  apiBase?: string;
};

export type ReportFaultProps = {
  slot: SellerSlot;
  sellerId: string;
};
