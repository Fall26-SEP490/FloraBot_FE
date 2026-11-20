import WorkspaceTable from '@/features/portal/components/WorkspaceTable';
import type { DataTableColumn } from '@/shared/components/DataTable';
import '../styles/operations-directories.css';

export default function DirectoryTable<T>({
  caption,
  columns,
  rows,
  getRowKey,
  emptyMessage,
}: {
  caption: string;
  columns: readonly DataTableColumn<T>[];
  rows: readonly T[];
  getRowKey: (row: T) => string;
  emptyMessage: string;
}) {
  return (
    <WorkspaceTable label={`Bảng dữ liệu ${caption}`}>
      <table className="operations-directory-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={getRowKey(row)}>
                {columns.map((column) => (
                  <td key={column.key} data-label={column.header}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length}>{emptyMessage}</td>
            </tr>
          )}
        </tbody>
      </table>
    </WorkspaceTable>
  );
}
