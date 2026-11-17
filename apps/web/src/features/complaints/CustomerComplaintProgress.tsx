import { useCallback, useEffect, useState } from 'react';
import { Button } from '@florabot/ui';
import QualityComplaintDetails from './QualityComplaintDetails';
import { lookupQuality, type QualityComplaint } from './quality-complaints.api';
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
  return (
    <div className={styles.flow}>
      <div className={styles.actions}>
        <Button type="button" variant="outline" disabled={pending} onClick={reload}>
          Cập nhật tiến độ phản ánh
        </Button>
      </div>
      {pending ? (
        <p role="status">Đang tải tiến độ phản ánh…</p>
      ) : result.detail ? (
        <QualityComplaintDetails
          detail={result.detail}
          scope="customer"
          capability={{ orderId, trackingToken }}
          onPage={setEvidencePage}
        />
      ) : (
        <p role="alert">Chưa tải được tiến độ. Phản ánh đã gửi vẫn được ghi nhận.</p>
      )}
    </div>
  );
}
