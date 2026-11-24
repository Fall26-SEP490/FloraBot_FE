import { CheckCircle2, CircleAlert } from '@florabot/ui';
import type { AdminIncidentResponse } from './incidents.types';
import { formatIncidentDate, incidentProgressLabel } from './incidents.utils';
import styles from './incident-overview.module.css';

export default function IncidentOverview({ incident }: { incident: AdminIncidentResponse }) {
  const resolved = incident.status === 'RESOLVED_FIXED';
  const Icon = resolved ? CheckCircle2 : CircleAlert;
  return (
    <div className={styles.overview}>
      <section className={styles.result} data-resolved={resolved} aria-label="Kết quả xử lý sự cố">
        <Icon size={24} aria-hidden="true" />
        <div>
          <strong>{incidentProgressLabel(incident)}</strong>
          <p>
            {resolved
              ? incident.decision || 'Chưa có ghi chú xử lý.'
              : 'Quản lý vận hành phụ trách xử lý.'}
          </p>
          {resolved && incident.resolvedAt && (
            <time dateTime={incident.resolvedAt}>{formatIncidentDate(incident.resolvedAt)}</time>
          )}
        </div>
      </section>
      <dl className={styles.facts}>
        <div>
          <dt>Ô tủ</dt>
          <dd>{incident.slot?.slotCode || 'Toàn kiosk'}</dd>
        </div>
        <div>
          <dt>Người phụ trách</dt>
          <dd>{incident.task?.assigneeName || 'Chưa phân công'}</dd>
        </div>
        <div>
          <dt>Ghi nhận</dt>
          <dd>
            <time dateTime={incident.createdAt}>{formatIncidentDate(incident.createdAt)}</time>
          </dd>
        </div>
        {incident.location?.address && (
          <div className={styles.address}>
            <dt>Địa điểm</dt>
            <dd>{incident.location.address}</dd>
          </div>
        )}
      </dl>
      <section className={styles.reason}>
        <h3>Nội dung sự cố</h3>
        <p>{incident.reason}</p>
      </section>
      <details className={styles.references}>
        <summary>Mã tra cứu</summary>
        <dl>
          <div>
            <dt>Phiếu sự cố</dt>
            <dd>{incident.id}</dd>
          </div>
          {incident.task && (
            <div>
              <dt>Công việc</dt>
              <dd>{incident.task.id}</dd>
            </div>
          )}
        </dl>
      </details>
    </div>
  );
}
