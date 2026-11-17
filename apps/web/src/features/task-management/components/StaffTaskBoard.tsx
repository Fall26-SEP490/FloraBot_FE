import { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Button, RefreshCw } from '@florabot/ui';
import { queryClient, request } from '@/shared/lib/api';
import type { TaskPage } from '../task-management.types';
import { TaskItem } from './TaskItem';

const lanes = [
  { status: 'IN_PROGRESS', title: 'Đang thực hiện' },
  { status: 'ASSIGNED', title: 'Chờ bắt đầu' },
  { status: 'SUBMITTED', title: 'Chờ chủ shop duyệt' },
  { status: 'COMPLETED', title: 'Đã hoàn thành' },
  { status: 'CANCELLED', title: 'Đã hủy' },
] as const;

type Status = (typeof lanes)[number]['status'];

export default function StaffTaskBoard({
  apiBase,
  actorId,
  sellerId,
  readOnly,
}: {
  apiBase: string;
  actorId?: string;
  sellerId?: string | null;
  readOnly: boolean;
}) {
  const [pages, setPages] = useState<Partial<Record<Status, number>>>({});
  const [reload, setReload] = useState(0);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const scopeKey = sellerId ? `seller:${sellerId}` : apiBase;
  const queries = useQueries({
    queries: lanes.map(({ status }) => {
      const page = pages[status] ?? 1;
      return {
        queryKey: ['staff-tasks', 'SELLER_STAFF', actorId ?? 'none', scopeKey, page, status],
        queryFn: async () => {
          const result = await request<TaskPage>(`${apiBase}?page=${page}&status=${status}`);
          if (!Array.isArray(result?.items)) throw new Error('Invalid task page');
          return result;
        },
      };
    }),
  });
  const latestVersions = new Map<string, number>();
  queries.forEach(({ data }) =>
    data?.items.forEach(({ id, version }) =>
      latestVersions.set(id, Math.max(version, latestVersions.get(id) ?? version)),
    ),
  );
  const groups = lanes.map((lane, index) => {
    const query = queries[index];
    return {
      ...lane,
      query,
      page: pages[lane.status] ?? 1,
      tasks:
        query.data?.items.filter(
          (task) => task.status === lane.status && task.version === latestVersions.get(task.id),
        ) ?? [],
    };
  });
  const activeGroups = groups.slice(0, 3);
  const history = groups.slice(3);
  const loading = queries.some((query) => query.isPending);
  const fetching = queries.some((query) => query.isFetching);
  const failed = queries.some((query) => query.isError);
  const hasContent = ({ tasks, page }: (typeof groups)[number]) => tasks.length > 0 || page > 1;

  function renderGroup(group: (typeof groups)[number]) {
    if (!hasContent(group)) return null;
    const { status, title, query, page, tasks } = group;
    const qualityTasks = tasks.filter((task) => task.workType === 'FLOWER_QUALITY');
    const otherTasks = tasks.filter((task) => task.workType !== 'FLOWER_QUALITY');
    const renderTask = (task: (typeof tasks)[number]) => (
      <TaskItem
        key={`${task.id}-${task.version}-${reload}`}
        task={task}
        mode="worker"
        actorRole="SELLER_STAFF"
        actorId={actorId}
        sellerId={sellerId}
        apiBase={apiBase}
        canReassign={false}
        readOnly={readOnly}
        staffOpen={openTaskId === task.id}
        onToggleStaff={() => setOpenTaskId((current) => (current === task.id ? null : task.id))}
      />
    );
    return (
      <section key={status} className="staff-task-group" aria-labelledby={`staff-group-${status}`}>
        <h3 id={`staff-group-${status}`}>{title}</h3>
        {qualityTasks.length > 0 && (
          <div role="group" aria-label="Xử lý chất lượng hoa">
            <p>
              <strong>Xử lý chất lượng hoa</strong>
            </p>
            {qualityTasks.map(renderTask)}
          </div>
        )}
        {otherTasks.map(renderTask)}
        {!tasks.length && <p>Trang này không còn công việc.</p>}
        {(page > 1 || query.data?.hasMore) && (
          <nav aria-label={`Phân trang: ${title}`} className="order-pagination">
            <Button
              variant="outline"
              disabled={page === 1 || query.isFetching}
              onClick={() => setPages((current) => ({ ...current, [status]: page - 1 }))}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Trang trước
            </Button>
            <span className="order-pagination-indicator" aria-live="polite">
              Trang {page}
            </span>
            <Button
              variant="outline"
              disabled={!query.data?.hasMore || query.isFetching}
              onClick={() => setPages((current) => ({ ...current, [status]: page + 1 }))}
            >
              Trang sau
              <ArrowRight size={16} aria-hidden="true" />
            </Button>
          </nav>
        )}
      </section>
    );
  }

  return (
    <section id="staff-tasks" className="staff-task-board" aria-labelledby="staff-tasks-title">
      <h2 id="staff-tasks-title" className="sr-only">
        Danh sách công việc
      </h2>
      <div className="staff-task-toolbar">
        <Button
          variant="outline"
          disabled={fetching}
          onClick={async () => {
            const results = await Promise.all(queries.map((query) => query.refetch()));
            if (results.every((result) => !result.isError)) setReload((value) => value + 1);
            await Promise.all(
              [
                'staff-inventory-maintenance',
                'staff-stock',
                'staff-preorders',
                'staff-quality',
              ].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
            );
          }}
        >
          <RefreshCw size={15} aria-hidden="true" className={fetching ? 'spin' : ''} />
          Tải lại công việc
        </Button>
      </div>
      {loading && <p role="status">Đang tải công việc…</p>}
      {failed && (
        <p role="alert">Chưa tải được một số công việc. Bấm “Tải lại công việc” để thử lại.</p>
      )}
      {!loading && !failed && !activeGroups.some(hasContent) && (
        <p className="staff-board-empty">Chưa có công việc cần xử lý hoặc chờ duyệt.</p>
      )}
      {activeGroups.map(renderGroup)}
      {history.some(hasContent) && (
        <details className="staff-board-history">
          <summary>Lịch sử công việc</summary>
          {history.map(renderGroup)}
        </details>
      )}
    </section>
  );
}
