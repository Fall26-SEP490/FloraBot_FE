import WorkspaceTable from '@/features/portal/components/WorkspaceTable';
import { ArrowRight, Button } from '@florabot/ui';
import type { ActiveTaskRole, Task } from '../task-management.types';
import { TASK_STATUS_LABELS } from '../task-management.constants';
import reviewStyles from './manager-review.module.css';

export default function TaskTable({
  tasks,
  role,
  reviewing,
  onOpen,
}: {
  tasks: Task[];
  role: ActiveTaskRole;
  reviewing: boolean;
  onOpen: (taskId: string) => void;
}) {
  const managerTable = role === 'OPERATIONS_MANAGER';
  const managerReview = managerTable && reviewing;
  return (
    <div className={managerTable ? reviewStyles.sheet : undefined}>
      <WorkspaceTable
        label={
          managerReview
            ? 'Báo cáo chờ nghiệm thu'
            : managerTable
              ? 'Công việc đã phân công'
              : role === 'SELLER'
                ? 'Danh sách công việc'
                : 'Giám sát công việc'
        }
      >
        <table className={`admin-monitor-table ${managerTable ? reviewStyles.table : ''}`}>
          <thead>
            <tr>
              <th scope="col">Công việc / Kiosk</th>
              <th scope="col">Người phụ trách</th>
              <th scope="col">Trạng thái</th>
              <th scope="col">Báo cáo gần nhất</th>
              <th scope="col">
                {role === 'SELLER' ? (
                  <span className="sr-only">Chi tiết</span>
                ) : managerReview ? (
                  'Thao tác'
                ) : (
                  'Chi tiết'
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr
                key={task.id}
                className={
                  managerTable
                    ? reviewStyles.row
                    : role === 'SELLER'
                      ? 'seller-task-row'
                      : undefined
                }
                tabIndex={role === 'SELLER' || managerTable ? 0 : undefined}
                onClick={
                  role === 'SELLER' || managerTable
                    ? (event) => {
                        if (
                          (event.target as HTMLElement).closest(
                            'button, a, input, select, textarea',
                          )
                        )
                          return;
                        onOpen(task.id);
                      }
                    : undefined
                }
                onKeyDown={
                  role === 'SELLER' || managerTable
                    ? (event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onOpen(task.id);
                        }
                      }
                    : undefined
                }
              >
                <td>
                  <strong>
                    {task.workType === 'FLOWER_QUALITY'
                      ? 'Xử lý chất lượng hoa'
                      : task.kind === 'INCIDENT'
                        ? 'Kiểm tra sự cố'
                        : task.kind === 'KIOSK_REMOVAL'
                          ? 'Tháo dỡ kiosk'
                          : 'Giao hoa'}
                  </strong>
                  <span className="table-secondary">{task.kioskName}</span>
                </td>
                <td>{task.assigneeName || '—'}</td>
                <td>
                  <span className="table-badge" data-state={task.status}>
                    {TASK_STATUS_LABELS[task.status] || task.status}
                  </span>
                </td>
                <td>
                  <span className="table-truncate" title={task.report || ''}>
                    {task.report || '—'}
                  </span>
                </td>
                <td>
                  <Button
                    type="button"
                    variant="outline"
                    className={role === 'SELLER' ? 'seller-task-open' : undefined}
                    aria-label={`${managerReview ? 'Nghiệm thu' : 'Xem'} công việc ${task.id}`}
                    onClick={() => onOpen(task.id)}
                  >
                    {role === 'SELLER' ? (
                      <>
                        <ArrowRight size={18} aria-hidden="true" />
                        <span className="sr-only">Xem</span>
                      </>
                    ) : managerReview ? (
                      'Nghiệm thu'
                    ) : (
                      'Xem'
                    )}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </WorkspaceTable>
    </div>
  );
}
