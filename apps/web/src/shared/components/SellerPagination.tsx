import { ArrowLeft, ArrowRight } from '@florabot/ui';
import styles from './seller-pagination.module.css';

export default function SellerPagination({
  page,
  totalPages,
  hasMore,
  busy = false,
  onPageChange,
  ariaLabel = 'Phân trang danh sách',
}: {
  page: number;
  totalPages?: number;
  hasMore?: boolean;
  busy?: boolean;
  onPageChange: (page: number) => void;
  ariaLabel?: string;
}) {
  const canNext = totalPages === undefined ? Boolean(hasMore) : page < totalPages;
  return (
    <nav className={styles.pagination} aria-label={ariaLabel}>
      <button type="button" disabled={page <= 1 || busy} onClick={() => onPageChange(page - 1)}>
        <ArrowLeft size={15} aria-hidden="true" />
        Trang trước
      </button>
      <span aria-current="page" aria-live="polite">
        Trang {page}
        {totalPages === undefined ? '' : ` / ${totalPages}`}
      </span>
      <button type="button" disabled={!canNext || busy} onClick={() => onPageChange(page + 1)}>
        Trang sau
        <ArrowRight size={15} aria-hidden="true" />
      </button>
    </nav>
  );
}
