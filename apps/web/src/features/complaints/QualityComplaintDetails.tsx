import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Button,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Eye,
  ImageIcon,
  Package,
  X,
} from '@florabot/ui';
import {
  qualityDate,
  qualityLabels,
  type QualityComplaint,
  type QualitySchema,
  type ReceiptCapability,
} from './quality-complaints.api';
import styles from './quality-complaints.module.css';
import sellerStyles from './seller-quality-complaints.module.css';
import { displayVietnamDate, vietnamDateTime } from '@/shared/lib/vietnam-date';

const sellerDate = (value: string) => displayVietnamDate(vietnamDateTime(value), true);

const prefixes = {
  customer: '/api/receipts/complaints',
  seller: '/api/me/complaints',
  staff: '/api/staff/quality-complaints',
  admin: '/api/admin/quality-complaints',
} as const;
type Scope = keyof typeof prefixes;
const idPattern = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function customerComplaintStage(state: string): number {
  switch (state) {
    case 'REPORTED':
      return 0;
    case 'ACCEPTED':
      return 1;
    case 'IN_PROGRESS':
    case 'REVIEW_REQUIRED':
    case 'ATTENTION_REQUIRED':
    case 'REPLACEMENT_READY':
    case 'REFUND_REVIEW':
      return 2;
    case 'RESOLVED':
      return 3;
    default:
      return 1;
  }
}

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
  const preview = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = preview.current;
    const contain = (event: Event) => event.stopPropagation();
    dialog?.addEventListener('keydown', contain);
    dialog?.addEventListener('cancel', contain);
    return () => {
      dialog?.removeEventListener('keydown', contain);
      dialog?.removeEventListener('cancel', contain);
    };
  }, []);
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
  const visual = scope === 'seller' || scope === 'staff';
  const customer = scope === 'customer';
  return (
    <li
      className={
        visual ? sellerStyles.evidenceCard : customer ? styles.customerEvidenceCard : undefined
      }
    >
      {customer ? (
        <div className={styles.customerEvidenceMeta}>
          <strong>{label}</strong>
          <time dateTime={photo.createdAt}>{qualityDate(photo.createdAt)}</time>
        </div>
      ) : (
        <p>
          {visual ? (
            <>
              <strong>{label}</strong>
              <time dateTime={photo.createdAt}>{sellerDate(photo.createdAt)}</time>
            </>
          ) : (
            <>
              {label} · {qualityDate(photo.createdAt)}
            </>
          )}
        </p>
      )}
      {src ? (
        visual || customer ? (
          <button
            type="button"
            className={visual ? sellerStyles.imageButton : styles.customerImageButton}
            onClick={() => preview.current?.showModal()}
            aria-label={`Phóng to ${label.toLocaleLowerCase('vi')}`}
          >
            <img className={customer ? styles.customerPhoto : styles.photo} src={src} alt={label} />
            <span>
              {customer && <Eye size={14} aria-hidden="true" />}
              Phóng to ảnh
            </span>
          </button>
        ) : (
          <img className={styles.photo} src={src} alt={label} />
        )
      ) : (
        <div className={customer ? styles.customerEvidenceAction : undefined}>
          {failed && (
            <p role="alert" className={customer ? styles.evidenceError : undefined}>
              Chưa tải được ảnh minh chứng.
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            aria-label={
              visual
                ? `${failed ? 'Thử tải lại' : 'Xem'} ${label.toLocaleLowerCase('vi')}`
                : undefined
            }
            disabled={attempt > 0 && !failed}
            onClick={() => {
              setFailed(false);
              setAttempt((value) => value + 1);
            }}
          >
            {failed ? 'Thử tải lại ảnh' : attempt ? 'Đang tải ảnh…' : 'Xem ảnh'}
          </Button>
        </div>
      )}
      {(visual || customer) && (
        <dialog ref={preview} className={sellerStyles.photoDialog} aria-label={label}>
          <header>
            <strong>{label}</strong>
            <button type="button" aria-label="Đóng ảnh" onClick={() => preview.current?.close()}>
              <X size={20} aria-hidden="true" />
            </button>
          </header>
          {src && <img src={src} alt={label} />}
        </dialog>
      )}
    </li>
  );
}

export default function QualityComplaintDetails({
  detail,
  scope,
  capability,
  onPage,
  actions,
  hideTaskContext = false,
}: {
  detail: QualityComplaint;
  scope: Scope;
  hideTaskContext?: boolean;
  capability?: ReceiptCapability;
  onPage: (page: number) => void;
  actions?: ReactNode;
}) {
  const { evidence, replacement, task } = detail;
  if (scope === 'customer') {
    const stage = customerComplaintStage(detail.handlingState);
    const resolved = detail.handlingState === 'RESOLVED';
    const steps = ['Đã gửi', 'Tiếp nhận', 'Đang kiểm tra', 'Đã xử lý'];
    return (
      <div className={styles.customerBody}>
        <ol className={styles.customerStepper} aria-label="Các bước xử lý phản ánh">
          {steps.map((label, index) => {
            const done = resolved || index < stage;
            const current = !resolved && index === stage;
            return (
              <li
                key={label}
                className={styles.customerStep}
                data-complete={done || undefined}
                aria-current={current ? 'step' : undefined}
              >
                <span className={styles.customerStepDot} aria-hidden="true">
                  {done ? <Check size={12} /> : index + 1}
                </span>
                <span className={styles.customerStepLabel}>{label}</span>
              </li>
            );
          })}
        </ol>

        {detail.resolution && (
          <div className={styles.customerOutcome}>
            <div className={styles.customerOutcomeHead}>
              <CheckCircle2 size={16} aria-hidden="true" />
              <strong>Kết quả xử lý</strong>
              {detail.resolvedAt && (
                <time dateTime={detail.resolvedAt}>{qualityDate(detail.resolvedAt)}</time>
              )}
            </div>
            <p className={styles.text}>{detail.resolution}</p>
          </div>
        )}

        {detail.outcome === 'REFUND_REVIEW' && detail.status === 'OPEN' && (
          <div className={styles.customerNotice}>
            <Clock size={16} aria-hidden="true" />
            <p>Hồ sơ đã chuyển sang xét duyệt. Khoản hoàn chưa được chi.</p>
          </div>
        )}

        {replacement && (
          <div className={styles.customerReplacement}>
            <div className={styles.customerReplacementHead}>
              <Package size={16} aria-hidden="true" />
              <strong>Hoa thay thế</strong>
              <span className={styles.statusPill} data-state={replacement.state}>
                {qualityLabels[replacement.state] || replacement.state}
              </span>
            </div>
            {replacement.state === 'READY' && (
              <p>
                Đến đúng kiosk của đơn gốc, chọn “Nhận hoa thay” và dùng biên nhận gốc. Không cần
                thanh toán thêm.
              </p>
            )}
            {replacement.expiresAt && ['READY', 'LOADED'].includes(replacement.state) && (
              <p className={styles.customerMetaTime}>
                <Clock size={14} aria-hidden="true" />
                <span>Hạn giữ hoa: {qualityDate(replacement.expiresAt)}</span>
              </p>
            )}
          </div>
        )}

        <div className={styles.customerBlock}>
          <span className={styles.customerBlockLabel}>Nội dung bạn đã gửi</span>
          <p className={`${styles.customerReasonBox} ${styles.text}`}>{detail.reason}</p>
        </div>

        {detail.items.length > 0 && (
          <div className={styles.customerBlock}>
            <span className={styles.customerBlockLabel}>Hoa trong đơn gốc</span>
            <ul className={styles.customerItemsList}>
              {detail.items.map((item) => (
                <li key={item.orderItemId}>
                  <span>{item.name}</span>
                  {item.slotCode && <span className={styles.slotChip}>Ô {item.slotCode}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <details className={styles.customerEvidence}>
          <summary>
            <ImageIcon size={16} aria-hidden="true" />
            <span>Ảnh minh chứng</span>
            {evidence.items.length > 0 && (
              <span className={styles.evidenceCount}>
                {evidence.items.length}
                {evidence.hasMore ? '+' : ''}
              </span>
            )}
            <ChevronDown size={16} aria-hidden="true" className={styles.chevron} />
          </summary>
          <div className={styles.customerEvidenceBody}>
            {!evidence.items.length ? (
              <p className={styles.emptyEvidence}>Không có ảnh ở trang này.</p>
            ) : (
              <ul className={styles.customerEvidenceGrid}>
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
            )}
            {(Number(evidence.page) > 1 || evidence.hasMore) && (
              <div className={styles.customerEvidencePages}>
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
          </div>
        </details>
      </div>
    );
  }
  if (scope === 'seller')
    return (
      <>
        <section className={sellerStyles.detailSection} aria-label="Phản ánh của khách">
          <h3>Phản ánh của khách</h3>
          <p className={sellerStyles.customerReason}>{detail.reason}</p>
          {detail.items.length > 0 && (
            <dl className={`${sellerStyles.facts} ${sellerStyles.orderFacts}`}>
              <div>
                <dt>Hoa trong đơn</dt>
                <dd>
                  <ul>
                    {detail.items.map((item) => (
                      <li key={item.orderItemId}>
                        {item.name}
                        {item.slotCode && <span>Ô {item.slotCode}</span>}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            </dl>
          )}
        </section>
        {(detail.resolution || task || detail.outcome === 'REFUND_REVIEW') && (
          <section className={sellerStyles.detailSection} aria-label="Quá trình xử lý">
            <div className={sellerStyles.sectionHeading}>
              <h3>Xử lý phản ánh</h3>
              {detail.resolvedAt && <span>Hoàn tất {sellerDate(detail.resolvedAt)}</span>}
            </div>
            {detail.resolution && (
              <div className={sellerStyles.result}>
                <strong>Kết quả xử lý</strong>
                <p>{detail.resolution}</p>
              </div>
            )}
            <dl className={`${sellerStyles.facts} ${sellerStyles.processingFacts}`}>
              {task && (
                <div>
                  <dt>Việc được giao</dt>
                  <dd>{task.instructions}</dd>
                </div>
              )}
              {task?.report && (
                <div>
                  <dt>Báo cáo nhân viên</dt>
                  <dd>{task.report}</dd>
                </div>
              )}
            </dl>
            {detail.outcome === 'REFUND_REVIEW' && detail.status === 'OPEN' && (
              <p className={sellerStyles.quiet}>
                Hồ sơ đã chuyển sang xét duyệt. Khoản hoàn chưa được chi.
              </p>
            )}
          </section>
        )}
        {replacement && (
          <section className={sellerStyles.detailSection} aria-label="Hoa thay thế">
            <h3>Hoa thay thế</h3>
            <div className={sellerStyles.replacement}>
              <span className={sellerStyles.badge}>
                {qualityLabels[replacement.state] || replacement.state}
              </span>
              <span>Ô {replacement.slotCode}</span>
            </div>
            {replacement.state === 'READY' && (
              <p className={sellerStyles.quiet}>
                Khách nhận hoa tại kiosk của đơn gốc, không thanh toán thêm.
              </p>
            )}
            {replacement.expiresAt && ['READY', 'LOADED'].includes(replacement.state) && (
              <p className={sellerStyles.quiet}>Hạn giữ hoa: {sellerDate(replacement.expiresAt)}</p>
            )}
          </section>
        )}
        {actions && (
          <section
            className={`${sellerStyles.detailSection} ${sellerStyles.actionsSection}`}
            aria-label="Thao tác xử lý"
          >
            {actions}
          </section>
        )}
        <section className={sellerStyles.detailSection} aria-label="Ảnh minh chứng">
          <h3>
            Ảnh minh chứng
            {evidence.items.length > 0 && (
              <span>
                {evidence.items.length}
                {evidence.hasMore ? '+' : ''}
              </span>
            )}
          </h3>
          {!evidence.items.length && <p className={sellerStyles.quiet}>Chưa có ảnh minh chứng.</p>}
          <ul className={sellerStyles.evidenceGrid}>
            {evidence.items.map((photo) => (
              <EvidencePhoto key={photo.id} photo={photo} complaintId={detail.id} scope={scope} />
            ))}
          </ul>
          {(Number(evidence.page) > 1 || evidence.hasMore) && (
            <nav className={sellerStyles.evidencePages} aria-label="Phân trang ảnh minh chứng">
              <Button
                type="button"
                variant="outline"
                disabled={Number(evidence.page) <= 1}
                onClick={() => onPage(Number(evidence.page) - 1)}
              >
                Trang trước
              </Button>
              <span>Trang {evidence.page}</span>
              <Button
                type="button"
                variant="outline"
                disabled={!evidence.hasMore}
                onClick={() => onPage(Number(evidence.page) + 1)}
              >
                Trang sau
              </Button>
            </nav>
          )}
        </section>
      </>
    );
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
      {task && !hideTaskContext && (
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
          <p>Ô {replacement.slotCode}</p>
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
      {(scope !== 'staff' ||
        evidence.items.length > 0 ||
        evidence.hasMore ||
        Number(evidence.page) > 1) && (
        <details className={scope === 'staff' ? 'staff-quality-evidence' : undefined}>
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
      )}
    </div>
  );
}
