import type { components } from '../../../../../packages/contracts/src/generated/api';

export type DashboardRow = { id: string; title: string; detail: string; state: string };
export type DashboardFeed = { rows: DashboardRow[]; more: boolean };
export type DashboardPage<T> = { items: T[]; hasMore: boolean };

export type DashboardIncident = components['schemas']['AdminIncidentResponse'];
export type DashboardTask = { id: string; kioskName: string; assigneeName: string; kind: string };

export type ManagementRole = 'ADMIN' | 'SELLER' | 'SELLER_STAFF';

export type ManagementRecord = {
  id: string;
  name: string;
  reference: string;
  owner: string;
  status: string;
};
