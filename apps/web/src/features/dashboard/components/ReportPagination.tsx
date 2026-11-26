import type { ComponentProps } from 'react';
import SellerPagination from '@/shared/components/SellerPagination';
import styles from './report-pagination.module.css';

export default function ReportPagination(props: ComponentProps<typeof SellerPagination>) {
  return (
    <div className={styles.footer}>
      <SellerPagination {...props} />
    </div>
  );
}
