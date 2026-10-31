import Link from 'next/link';
import type { UseQueryResult } from '@tanstack/react-query';
import { ArrowRight, Button, CircleAlert } from '@florabot/ui';
import { queueCountLabel, type AdminQueue, type QueueSnapshot } from '../admin-queues';

export default function AdminQueueItem({
  queue,
  query,
  compact = false,
}: {
  queue: AdminQueue;
  query: UseQueryResult<QueueSnapshot>;
  compact?: boolean;
}) {
  const hasItems = query.isSuccess && query.data.count > 0;
  return (
    <article
      className={compact ? 'admin-queue-item is-compact' : 'admin-queue-item'}
      data-attention={hasItems || undefined}
      aria-labelledby={`admin-queue-${queue.key}`}
    >
      <div className="admin-queue-copy">
        <h3 id={`admin-queue-${queue.key}`}>
          <Link href={`/admin/${queue.key}`} title={queue.action}>
            {queue.title}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </h3>
        {!compact && <p>{queue.description}</p>}
        {query.isPending ? (
          <p role="status">Đang tải yêu cầu…</p>
        ) : query.isError ? (
          <div className="admin-queue-error">
            <p role="alert">
              <CircleAlert size={15} aria-hidden="true" /> Chưa tải được danh sách.
            </p>
            <Button
              variant="outline"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              Thử lại {queue.title.toLocaleLowerCase('vi')}
            </Button>
          </div>
        ) : (
          <p className="admin-queue-state">
            {query.data.count === 0
              ? 'Chưa có yêu cầu trong lần tải này.'
              : queue.group === 'monitor'
                ? 'Mở danh sách để theo dõi.'
                : 'Yêu cầu đang chờ kiểm tra.'}
            {query.isFetching && <span role="status"> Đang cập nhật…</span>}
          </p>
        )}
      </div>
      {query.isSuccess && (
        <div
          className="admin-queue-count"
          aria-label={`${queueCountLabel(query.data)} yêu cầu đang hiển thị`}
        >
          <strong>{queueCountLabel(query.data)}</strong>
          <span>đang hiển thị</span>
        </div>
      )}
    </article>
  );
}
