import { useCallback, useEffect, useState } from 'react';
import { Button, RefreshCw } from '@florabot/ui';
import QualityComplaintDetails from './QualityComplaintDetails';
import { lookupQuality, qualityLabels, type QualityComplaint } from './quality-complaints.api';
import styles from './quality-complaints.module.css';

export default function CustomerComplaintProgress({
  orderId,
  trackingToken,
}: {
  orderId: string;
  trackingToken: string;
}) {
  const [evidencePage, setEvidencePage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ key: string; detail?: QualityComplaint } | null>(null);
  const key = `${evidencePage}:${revision}`;
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const active = new AbortController();
    void lookupQuality({ orderId, trackingToken }, evidencePage, active.signal)
      .then((detail) => {
        if (!active.signal.aborted) setResult({ key, detail });
      })
      .catch(() => {
        if (!active.signal.aborted) setResult({ key });
      });
    return () => active.abort();
  }, [orderId, trackingToken, key, evidencePage]);
  const pending = result?.key !== key;
  const detail = !pending ? result?.detail : undefined;
  return (
    <section className={styles.customerProgress} aria-label="Tiến độ xử lý phản ánh">
      <div className={styles.customerHeader}>
        <div className={styles.customerHeading}>
          <h4>Tiến độ xử lý</h4>
          {detail && (
            <span className={styles.statusPill} data-state={detail.handlingState}>
              {qualityLabels[detail.handlingState] || detail.handlingState}
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          className={styles.refreshBtn}
          disabled={pending}
          onClick={reload}
        >
          <RefreshCw size={14} aria-hidden="true" className={pending ? styles.spin : undefined} />
          Cập nhật tiến độ phản ánh
        </Button>
      </div>
      {pending ? (
        <p role="status" className={styles.loadingNote}>
          Đang tải tiến độ phản ánh…
        </p>
      ) : detail ? (
        <QualityComplaintDetails
          detail={detail}
          scope="customer"
          capability={{ orderId, trackingToken }}
          onPage={setEvidencePage}
        />
      ) : (
        <p role="alert" className={styles.errorNotice}>
          Chưa tải được tiến độ. Phản ánh đã gửi vẫn được ghi nhận.
        </p>
      )}
    </section>
  );
}
