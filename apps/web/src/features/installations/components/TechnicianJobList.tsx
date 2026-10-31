import { ClipboardList, ListChecks, MapPin } from '@florabot/ui';
import { KIOSK_STATUS_LABELS } from '../installations.constants';
import type { TechnicianInstallationSummary } from '../installations.types';
import { formatDateVN } from '../installations.utils';

interface TechnicianInstallationCardProps {
  job: TechnicianInstallationSummary;
  isSelected: boolean;
  onSelect: () => void;
}

function TechnicianInstallationCard({
  job,
  isSelected,
  onSelect,
}: TechnicianInstallationCardProps) {
  return (
    <button
      type="button"
      className={`tech-job-card ${isSelected ? 'is-selected' : ''}`}
      onClick={onSelect}
      aria-pressed={isSelected}
    >
      <div className="job-card-header">
        <strong className="job-shop-name">{job.shopName}</strong>
        <span className="kiosk-status-pill" data-status={job.status}>
          {KIOSK_STATUS_LABELS[job.status] || job.status}
        </span>
      </div>

      <p className="job-address-line">
        <MapPin size={16} aria-hidden="true" />
        <span>{job.installationAddress}</span>
      </p>

      <div className="job-meta-row">
        <span>
          <ClipboardList size={14} aria-hidden="true" /> {formatDateVN(job.scheduledDate)}
        </span>
        <span>
          <ListChecks size={14} aria-hidden="true" /> {job.timeWindow}
        </span>
        <span>
          Tủ: <code>{job.kioskCode}</code>
        </span>
      </div>

      {job.reworkReason && (
        <div className="job-rework-tag" role="alert">
          Cần làm lại: {job.reworkReason}
        </div>
      )}
    </button>
  );
}

interface TechnicianJobListProps {
  jobs: TechnicianInstallationSummary[];
  selectedJobId?: string | null;
  onSelectJobId: (id: string) => void;
}

export function TechnicianJobList({ jobs, selectedJobId, onSelectJobId }: TechnicianJobListProps) {
  return (
    <section className="tech-jobs-list" aria-label="Danh sách công việc lắp đặt">
      <div className="tech-list-heading">
        <h2>Phiếu được giao</h2>
        <span>{jobs.length}</span>
      </div>
      {jobs.map((job) => (
        <TechnicianInstallationCard
          key={job.id}
          job={job}
          isSelected={selectedJobId === job.id}
          onSelect={() => onSelectJobId(job.id)}
        />
      ))}
    </section>
  );
}
