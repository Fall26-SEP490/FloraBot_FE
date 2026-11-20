import type { ReactNode } from 'react';
import '../styles/workspace-table.css';

export default function WorkspaceTable({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    // This read-only region can receive focus for keyboard navigation through table content.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
    <div className="workspace-table" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}
