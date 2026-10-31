import type { ReactNode } from 'react';
import { ChevronDown } from '@florabot/ui';

export function AdminFilterBar({
  children,
  actions,
  label = 'Bộ lọc danh sách',
}: {
  children: ReactNode;
  actions?: ReactNode;
  label?: string;
}) {
  return (
    <div className="admin-filterbar" role="group" aria-label={label}>
      <div className="admin-filter-fields">{children}</div>
      {actions && <div className="admin-filter-actions">{actions}</div>}
    </div>
  );
}

export function AdminDisclosureSummary({
  title,
  meta,
  status,
  statusCode,
}: {
  title: ReactNode;
  meta?: ReactNode;
  status?: ReactNode;
  statusCode?: string;
}) {
  return (
    <summary className="admin-disclosure-summary">
      <span className="admin-disclosure-main">
        <strong>{title}</strong>
        {meta && <span className="admin-disclosure-meta">{meta}</span>}
      </span>
      {status && (
        <span className="admin-disclosure-status" data-status={statusCode}>
          {status}
        </span>
      )}
      <span className="admin-disclosure-toggle" aria-hidden="true">
        <span className="when-closed">Xem chi tiết</span>
        <span className="when-open">Ẩn chi tiết</span>
        <ChevronDown size={17} />
      </span>
    </summary>
  );
}
