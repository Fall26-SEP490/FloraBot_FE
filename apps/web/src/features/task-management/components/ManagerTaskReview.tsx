import type { ReactNode } from 'react';
import type { ActiveTaskRole, Task } from '../task-management.types';
import StaffTaskDetails from './StaffTaskDetails';
import RepairReadinessPanel from './RepairReadinessPanel';
import styles from './manager-review.module.css';

export default function ManagerTaskReview({
  task,
  apiBase,
  actorId,
  sellerId,
  role,
  readOnly,
  evidence,
  location,
  decision,
  showReadiness,
}: {
  task: Task;
  apiBase: string;
  actorId?: string;
  sellerId?: string | null;
  role: ActiveTaskRole;
  readOnly: boolean;
  evidence: ReactNode;
  location: ReactNode;
  decision: ReactNode;
  showReadiness: boolean;
}) {
  return (
    <div className={styles.review}>
      <div className={styles.overview}>
        <section className={styles.report} aria-label="Báo cáo kỹ thuật viên">
          <h4>Kết quả kiểm tra</h4>
          <p>{task.report || 'Chưa có nội dung báo cáo.'}</p>
        </section>
        <div className={styles.evidence}>{evidence}</div>
        <details className={styles.context}>
          <summary>Địa điểm & hướng dẫn</summary>
          {location}
        </details>
        <div className={styles.history}>
          <StaffTaskDetails
            taskId={task.id}
            version={task.version}
            apiBase={apiBase}
            admin
            readOnly={readOnly}
            actorId={actorId}
            sellerId={sellerId}
            role={role}
          />
        </div>
      </div>
      <div className={styles.decision}>
        <h4 className={styles.decisionTitle}>Kết quả nghiệm thu</h4>
        {decision}
        {showReadiness && (
          <RepairReadinessPanel
            taskId={task.id}
            apiBase={apiBase}
            actorId={actorId}
            version={task.version}
            phase="review"
          />
        )}
      </div>
    </div>
  );
}
