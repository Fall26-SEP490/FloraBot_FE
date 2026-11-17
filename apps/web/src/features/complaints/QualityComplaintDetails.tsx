import { useEffect, useState } from 'react';
import { Button } from '@florabot/ui';
import {
  qualityDate,
  qualityLabels,
  type QualityComplaint,
  type QualitySchema,
  type ReceiptCapability,
} from './quality-complaints.api';
import styles from './quality-complaints.module.css';

const prefixes = {
  customer: '/api/receipts/complaints',
  seller: '/api/me/complaints',
  staff: '/api/staff/quality-complaints',
  admin: '/api/admin/quality-complaints',
} as const;
type Scope = keyof typeof prefixes;
const idPattern = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function EvidencePhoto({
  photo,
  complaintId,
  scope,
  capability,
}: {
  photo: QualitySchema['QualityPhoto'];
  complaintId: string;
  scope: Scope;
  capability?: ReceiptCapability;
}) {
  const [attempt, setAttempt] = useState(0);
  const [src, setSrc] = useState('');
  const [failed, setFailed] = useState(false);
  const { orderId, trackingToken } = capability ?? {};
  useEffect(() => {
    if (!attempt) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    async function load() {
      try {
        const path = `${prefixes[scope]}/${complaintId}/evidence/${photo.id}`;
        if (!idPattern.test(complaintId) || !idPattern.test(photo.id) || photo.url !== path)
          throw new Error();
        if (scope === 'customer' && (!orderId || !trackingToken)) throw new Error();
        const response = await fetch(path, {
          method: scope === 'customer' ? 'POST' : 'GET',
          credentials: scope === 'customer' ? 'omit' : 'same-origin',
          cache: 'no-store',
          redirect: 'error',
          referrerPolicy: 'no-referrer',
          ...(scope === 'customer' && {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId, trackingToken }),
          }),
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
        });
        if (
          !response.ok ||
          !/^image\/(jpeg|png|webp)$/i.test(
            response.headers.get('content-type')?.split(';')[0] ?? '',
          )
        )
          throw new Error();
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    }
    void load();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attempt, complaintId, photo.id, photo.url, scope, orderId, trackingToken]);
  const label = photo.source === 'STAFF_TASK' ? 'Ảnh xử lý của nhân viên' : 'Ảnh khách gửi';
  return (
    <li>
      <p>
        {label} · {qualityDate(photo.createdAt)}
      </p>
      {src ? (
        <img className={styles.photo} src={src} alt={label} />
      ) : (
        <>
          {failed && <p role="alert">Chưa tải được ảnh minh chứng.</p>}
          <Button
            type="button"
            variant="outline"
            disabled={attempt > 0 && !failed}
            onClick={() => {
              setFailed(false);
              setAttempt((value) => value + 1);
            }}
          >
            {failed ? 'Thử tải lại ảnh' : attempt ? 'Đang tải ảnh…' : 'Xem ảnh'}
          </Button>
        </>
      )}
    </li>
  );
}

export default function QualityComplaintDetails({
  detail,
  scope,
  capability,
  onPage,
}: {
  detail: QualityComplaint;
  scope: Scope;
  capability?: ReceiptCapability;
  onPage: (page: number) => void;
}) {
  const { evidence, replacement, task } = detail;
  return (
    <div className={styles.flow}>
      <p>
        <strong>{qualityLabels[detail.handlingState] || detail.handlingState}</strong>
      </p>
      <p className={styles.text}>{detail.reason}</p>
      {detail.resolution && (
        <p className={styles.text}>
          <strong>Kết quả: </strong>
          {detail.resolution}
        </p>
      )}
      {detail.outcome === 'REFUND_REVIEW' && detail.status === 'OPEN' && (
        <p>Hồ sơ đã chuyển sang xét duyệt. Khoản hoàn chưa được chi.</p>
      )}
      {detail.items.length > 0 && (
        <div>
          <strong>Hoa trong đơn gốc</strong>
          <ul>
            {detail.items.map((item) => (
              <li key={item.orderItemId}>
                {item.name}
                {item.slotCode && ` · Ô ${item.slotCode}`}
              </li>
            ))}
          </ul>
        </div>
      )}
      {scope !== 'customer' && task && (
        <div className={styles.flow}>
          <p className={styles.text}>
            <strong>Việc được giao: </strong>
            {task.instructions}
          </p>
          {task.report && (
            <p className={styles.text}>
              <strong>Báo cáo nhân viên: </strong>
              {task.report}
            </p>
          )}
        </div>
      )}
      {replacement && (
        <div className={styles.flow}>
          <strong>{qualityLabels[replacement.state] || replacement.state}</strong>
          {scope !== 'customer' && <p>Ô {replacement.slotCode}</p>}
          {scope === 'staff' && (
            <p className={styles.text}>Mã mẫu hoa đã giao: {replacement.productId}</p>
          )}
          {replacement.state === 'READY' && (
            <p>
              Đến đúng kiosk của đơn gốc, chọn “Nhận hoa thay” và dùng biên nhận gốc. Không cần
              thanh toán thêm.
            </p>
          )}
          {replacement.expiresAt && ['READY', 'LOADED'].includes(replacement.state) && (
            <p>Hạn giữ hoa: {qualityDate(replacement.expiresAt)}</p>
          )}
        </div>
      )}
      <details>
        <summary>Ảnh minh chứng</summary>
        {!evidence.items.length && <p>Không có ảnh ở trang này.</p>}
        <ul>
          {evidence.items.map((photo) => (
            <EvidencePhoto
              key={photo.id}
              photo={photo}
              complaintId={detail.id}
              scope={scope}
              capability={capability}
            />
          ))}
        </ul>
        {(Number(evidence.page) > 1 || evidence.hasMore) && (
          <div className={styles.actions}>
            <Button
              type="button"
              variant="outline"
              disabled={Number(evidence.page) <= 1}
              onClick={() => onPage(Number(evidence.page) - 1)}
            >
              Trang ảnh trước
            </Button>
            <span>Trang {evidence.page}</span>
            <Button
              type="button"
              variant="outline"
              disabled={!evidence.hasMore}
              onClick={() => onPage(Number(evidence.page) + 1)}
            >
              Trang ảnh tiếp
            </Button>
          </div>
        )}
      </details>
    </div>
  );
}
