import type { components } from '../../../../../packages/contracts/src/generated/api';
import type { ActiveTaskRole } from '../task-management/task-management.types';

export type AdminIncidentResponse = components['schemas']['AdminIncidentResponse'];
export type AdminIncidentEvidenceItem = components['schemas']['IncidentPhoto'] & {
  source?: 'INCIDENT' | 'STAFF_TASK' | string;
  taskId?: string | null;
};
export type AdminIncidentDetail = Omit<components['schemas']['AdminIncidentDetail'], 'evidence'> & {
  evidence: {
    items: AdminIncidentEvidenceItem[];
    page?: number;
    hasMore: boolean;
  };
};
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
  slotRepair?: boolean;
  apiBase?: string;
};

export type ReportFaultProps = {
  slot: SellerSlot;
  sellerId: string;
};
