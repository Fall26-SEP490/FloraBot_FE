import styles from './page-states.module.css';

export function FlowerGridSkeleton({
  gridClassName,
  count = 8,
  label = 'Đang tải danh mục hoa',
}: {
  gridClassName: string;
  count?: number;
  label?: string;
}) {
  return (
    <div role="status" aria-label={label}>
      <ul className={gridClassName} aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <li className={styles.flowerCard} key={index}>
            <span className={styles.photo} />
            <span className={styles.line} />
            <span className={styles.shortLine} />
            <span className={styles.shopLine} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FlowerDetailSkeleton() {
  return (
    <div className={styles.detail} role="status" aria-label="Đang tải thông tin mẫu hoa">
      <span className={styles.detailPhoto} aria-hidden="true" />
      <div className={styles.detailText} aria-hidden="true">
        <span className={styles.shortLine} />
        <span className={styles.heading} />
        <span className={styles.line} />
        <span className={styles.shortLine} />
        <span className={styles.line} />
      </div>
    </div>
  );
}

export function PageSkeleton({ catalog = false }: { catalog?: boolean }) {
  return (
    <main id="main" className={styles.pageLoading} tabIndex={-1}>
      <div className={styles.loadingHeading} role="status" aria-label="Đang tải FloraBot">
        <span className={styles.heading} aria-hidden="true" />
        <span className={styles.line} aria-hidden="true" />
      </div>
      {catalog ? (
        <FlowerGridSkeleton gridClassName={styles.routeGrid} />
      ) : (
        <div className={styles.loadingPanel} aria-hidden="true">
          <span className={styles.shortLine} />
          <span className={styles.line} />
          <span className={styles.shopLine} />
        </div>
      )}
    </main>
  );
}
