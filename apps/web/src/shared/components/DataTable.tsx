import type { ReactNode } from 'react';
import { clampPage, pageRange, totalPages } from '../pagination';

export type DataTableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
};

export function DataTable<T>({
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
    <div
      className="management-table-wrap workspace-table-scroll"
      role="region"
      aria-label={`Bảng dữ liệu ${caption}`}
    >
      <table className="management-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={column.className}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="management-table-empty">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={getRowKey(row)}>
                {columns.map((column) => (
                  <td key={column.key} data-label={column.header} className={column.className}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function TablePagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  ariaLabel = 'Phân trang danh sách',
}: {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  ariaLabel?: string;
}) {
  const safePage = clampPage(page, totalItems, pageSize);
  const pages = totalPages(totalItems, pageSize);
  const range = pageRange(safePage, totalItems, pageSize);

  return (
    <nav className="management-pagination" aria-label={ariaLabel}>
      <p aria-live="polite">
        {totalItems === 0
          ? 'Không có dữ liệu'
          : `Hiển thị ${range.start + 1}–${range.end} trong ${totalItems} mục`}
      </p>
      <div>
        <button
          type="button"
          className="management-page-button"
          disabled={safePage === 1}
          onClick={() => onPageChange(safePage - 1)}
        >
          Trang trước
        </button>
        <span aria-current="page">
          Trang {safePage}/{pages}
        </span>
        <button
          type="button"
          className="management-page-button"
          disabled={safePage === pages}
          onClick={() => onPageChange(safePage + 1)}
        >
          Trang sau
        </button>
      </div>
    </nav>
  );
}
