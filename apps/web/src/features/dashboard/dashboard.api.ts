import { request } from '../../api';
import type { DashboardFeed, DashboardPage, DashboardRow } from './dashboard.types';

export const dashboardApi = {
  readFeed: async <T>(url: string, toRow: (value: T) => DashboardRow): Promise<DashboardFeed> => {
    const result = await request<DashboardPage<T>>(url);
    if (!Array.isArray(result.items)) throw new Error('Invalid dashboard response');
    return { rows: result.items.map(toRow), more: result.hasMore };
  },
};
