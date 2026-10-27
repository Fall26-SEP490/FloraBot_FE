import { ClipboardList, ListChecks, MapPin } from '@florabot/ui';
import { KIOSK_STATUS_LABELS } from '../installations.constants';
import type { TechnicianInstallationSummary } from '../installations.types';

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
    <div
      className={`tech-job-card ${isSelected ? 'is-selected' : ''}`}
      onClick={onSelect}
      tabIndex={0}
      role="button"
      aria-pressed={isSelected}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="job-card-header">
        <h4>{job.shopName}</h4>
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
          <ClipboardList size={14} aria-hidden="true" /> {job.scheduledDate}
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
    </div>
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
