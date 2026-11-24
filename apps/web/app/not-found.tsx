import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '@/shared/components/page-states.module.css';

export const metadata: Metadata = { title: 'Không tìm thấy trang | FloraBot' };

export default function NotFound() {
  return (
    <main id="main" className={styles.missing} tabIndex={-1}>
      <div className={styles.missingContent}>
        <p className={styles.errorCode}>404</p>
        <h1>Không tìm thấy trang</h1>
        <p>Đường dẫn có thể đã thay đổi. Bạn có thể về trang chủ hoặc tiếp tục xem các mẫu hoa.</p>
        <div className={styles.actions}>
          <Link className="button button-primary" href="/">
            Về trang chủ
          </Link>
          <Link className="button button-outline" href="/dat-hoa">
            Xem mẫu hoa
          </Link>
        </div>
      </div>
    </main>
  );
}
