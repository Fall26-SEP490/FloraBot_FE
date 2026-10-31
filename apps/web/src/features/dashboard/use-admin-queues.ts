import { useQueries } from '@tanstack/react-query';
import { request } from '@/shared/lib/api';
import { adminQueues, readQueue, type AdminQueue } from './admin-queues';

export const overviewQueueKeys = ['refunds', 'kiosk-refunds', 'withdrawals', 'complaints'] as const;

export function useAdminQueues(actorId: string, keys?: readonly AdminQueue['key'][]) {
  const queues = keys ? adminQueues.filter((queue) => keys.includes(queue.key)) : adminQueues;
  const queries = useQueries({
    queries: queues.map((queue) => ({
      queryKey: ['admin-approval-queue', actorId, queue.key],
      queryFn: async () => readQueue(await request<unknown>(queue.endpoint)),
      staleTime: 30_000,
      refetchInterval: 60_000,
    })),
  });
  return queues.map((queue, index) => ({ queue, query: queries[index] }));
}
