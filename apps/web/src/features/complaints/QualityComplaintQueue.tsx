'use client';

import IconActionButton from '@/shared/components/IconActionButton';
import Select from '@/shared/components/Select';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { ApiError, request } from '@/shared/lib/api';
import { fetchProducts } from '../product-management/product.api';
import QualityComplaintDetails from './QualityComplaintDetails';
import {
  qualityDate,
  qualityLabels,
  type QualityComplaint,
  type QualitySchema,
} from './quality-complaints.api';
import styles from './quality-complaints.module.css';
import SellerQualityComplaints from './SellerQualityComplaints';

const reviewOptions = {
  RETURN: 'Trả việc để bổ sung',
  EXPLANATION: 'Gửi giải thích cho khách',
  REPLACEMENT: 'Cho khách nhận hoa thay',
  REFUND_REVIEW: 'Chuyển admin xét hoàn tiền',
} as const;

type Action = 'accept' | 'assignment' | 'replacement-plan' | 'review' | 'replacement/cancel';

function SellerActions({
  detail,
  sellerId,
  reload,
  stale,
  onBusy,
}: {
  detail: QualityComplaint;
  sellerId: string;
  reload: () => Promise<unknown>;
  stale: boolean;
  onBusy?: (busy: boolean) => void;
}) {
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    onBusy?.(busy);
  }, [busy, onBusy]);
  const [message, setMessage] = useState('');
  const [blocked, setBlocked] = useState(false);
  const sending = useRef(false);
  const assignment = useRef<{ key: string; id: string } | null>(null);
  const task = detail.task;
  const replacement = detail.replacement;
  const activeReplacement =
    !!replacement && ['PLANNED', 'LOADED', 'READY'].includes(replacement.state);
  const staff = useQuery({
    queryKey: ['quality-staff', sellerId],
    enabled: action === 'assignment',
    queryFn: () => request<{ id: string; name: string }[]>(`/sellers/${sellerId}/staff`),
  });
  const products = useQuery({
    queryKey: ['quality-products', sellerId],
    enabled: action === 'replacement-plan',
    queryFn: fetchProducts,
  });
  const slots = useQuery({
    queryKey: ['quality-slots', sellerId, detail.kioskId],
    enabled: action === 'replacement-plan',
    queryFn: () =>
      request<QualitySchema['SellerSlotResponse'][]>(`/me/kiosks/${detail.kioskId}/slots`),
  });
  const eligibleProducts = (products.data ?? []).filter(
    (item) => item.status === 'ACTIVE' && Number(item.quantity) > 0,
  );
  const eligibleSlots = (slots.data ?? []).filter(
    (item) =>
      item.kioskId === detail.kioskId &&
      item.zone === 'WALK_IN' &&
      item.status === 'RENTED_EMPTY' &&
      !item.bouquetId &&
      item.sensorReady,
  );
  const allowed: Action[] = [];
  if (detail.status === 'OPEN') {
    if (detail.handlingState === 'REPORTED') allowed.push('accept');
    if (
      detail.acceptedAt &&
      ['ACCEPTED', 'IN_PROGRESS', 'ATTENTION_REQUIRED'].includes(detail.handlingState) &&
      !activeReplacement &&
      (!task || !['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED'].includes(task.status)) &&
      detail.items.length
    )
      allowed.push('assignment');
    if (
      task &&
      ['ASSIGNED', 'IN_PROGRESS'].includes(task.status) &&
      !replacement &&
      ['IN_PROGRESS', 'ACCEPTED', 'ATTENTION_REQUIRED'].includes(detail.handlingState)
    )
      allowed.push('replacement-plan');
    if (task?.status === 'SUBMITTED') allowed.push('review');
    if (activeReplacement) allowed.push('replacement/cancel');
  }
  const activeAction = action && allowed.includes(action) ? action : null;
  const fieldsReady =
    activeAction === 'assignment'
      ? staff.isSuccess && Boolean(staff.data.length)
      : activeAction === 'replacement-plan'
        ? slots.isSuccess &&
          products.isSuccess &&
          !!eligibleProducts.length &&
          !!eligibleSlots.length
        : true;
  const text = {
    accept: 'Tiếp nhận phản ánh',
    assignment: 'Giao nhân viên',
    'replacement-plan': 'Chọn hoa thay và ô tủ',
    review: 'Duyệt báo cáo',
    'replacement/cancel': 'Hủy phương án hoa thay',
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeAction || !fieldsReady || sending.current || blocked || stale) return;
    const fields = new FormData(event.currentTarget);
    const value = (name: string) => String(fields.get(name) ?? '').trim();
    const version = Number(detail.version);
    const taskVersion = Number(task?.version);
    let payload:
      | QualitySchema['QualityVersion']
      | QualitySchema['AssignQualityTask']
      | QualitySchema['QualityReplacementPlan']
      | QualitySchema['ReviewQualityComplaint']
      | QualitySchema['CancelQualityReplacement'] = { version };
    if (activeAction === 'assignment') {
      const assigneeId = value('assigneeId'),
        orderItemId = value('orderItemId'),
        instructions = value('notes');
      if (
        !staff.data?.some((item) => item.id === assigneeId) ||
        !detail.items.some((item) => item.orderItemId === orderItemId) ||
        instructions.length < 10
      )
        return;
      const signature = JSON.stringify([assigneeId, orderItemId, instructions]);
      if (assignment.current?.key !== signature)
        assignment.current = { key: signature, id: crypto.randomUUID() };
      payload = { version, taskId: assignment.current.id, assigneeId, orderItemId, instructions };
    } else if (activeAction === 'replacement-plan') {
      const productId = value('productId'),
        slotId = value('slotId');
      if (
        !eligibleProducts.some((item) => item.id === productId) ||
        !eligibleSlots.some((item) => item.id === slotId)
      )
        return;
      payload = { version, taskVersion, productId, slotId };
    } else if (activeAction === 'review') {
      const outcome = value('outcome'),
        resolution = value('notes');
      if (!Object.hasOwn(reviewOptions, outcome) || resolution.length < 10) return;
      if (
        outcome === 'REPLACEMENT'
          ? replacement?.state !== 'LOADED'
          : outcome !== 'RETURN' && activeReplacement
      )
        return;
      payload = { version, taskVersion, outcome, resolution };
    } else if (activeAction === 'replacement/cancel') {
      const reason = value('notes');
      if (reason.length < 10) return;
      payload = { version, reason };
    }
    sending.current = true;
    setBusy(true);
    setMessage('');
    try {
      await request<QualitySchema['QualityVersion']>(
        `/me/complaints/${detail.id}/${activeAction}`,
        payload,
        false,
      );
      setAction(null);
      await reload();
      setMessage('Đã ghi nhận thao tác.');
    } catch (error) {
      const uncertain = !(error instanceof ApiError) || error.status >= 500 || error.status === 409;
      setBlocked(uncertain);
      setMessage(
        uncertain ? 'Hãy tải lại hồ sơ để kiểm tra trạng thái trước khi gửi tiếp.' : error.message,
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <div className={`${styles.flow} ${styles.sellerActions}`}>
      {detail.status === 'OPEN' && detail.acceptedAt && !task && !detail.items.length && (
        <p role="alert">
          Hồ sơ chưa có dòng bó hoa gốc để giao việc. Cần đối chiếu đơn trước khi xử lý.
        </p>
      )}
      {detail.handlingState === 'ATTENTION_REQUIRED' && (
        <p>Kiểm tra ô tủ và thu hồi hoa đã nạp qua mục Hoa tại tủ trước khi chốt phương án khác.</p>
      )}
      <div className={styles.actions}>
        {allowed.map((item) => (
          <Button
            key={item}
            type="button"
            variant={item === 'replacement/cancel' ? 'outline' : 'default'}
            disabled={busy || blocked || stale}
            aria-expanded={activeAction === item}
            onClick={() => setAction(activeAction === item ? null : item)}
          >
            {text[item]}
          </Button>
        ))}
        {task && ['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED'].includes(task.status) && (
          <a href="/seller/tasks">Xem công việc nhân viên</a>
        )}
      </div>
      {activeAction && (
        <form key={activeAction} className={styles.form} onSubmit={submit}>
          <strong>{text[activeAction]}</strong>
          {activeAction === 'assignment' && (
            <>
              <label>
                Nhân viên
                <Select name="assigneeId" required defaultValue="">
                  <option value="" disabled>
                    Chọn nhân viên
                  </option>
                  {staff.data?.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label>
                Bó hoa trong đơn
                <Select
                  name="orderItemId"
                  required
                  defaultValue={detail.items.length === 1 ? detail.items[0].orderItemId : ''}
                >
                  <option value="" disabled>
                    Chọn bó hoa
                  </option>
                  {detail.items.map((item) => (
                    <option key={item.orderItemId} value={item.orderItemId}>
                      {item.name}
                      {item.slotCode && ` · Ô ${item.slotCode}`}
                    </option>
                  ))}
                </Select>
              </label>
              {staff.isPending && <p role="status">Đang tải nhân viên…</p>}
              {staff.isError && (
                <IconActionButton
                  type="button"
                  variant="outline"
                  onClick={() => void staff.refetch()}
                  action="reload"
                  label="Tải lại danh sách nhân viên"
                />
              )}
              {staff.isSuccess && !staff.data.length && <p>Chưa có nhân viên để giao việc.</p>}
            </>
          )}
          {activeAction === 'replacement-plan' && (
            <>
              <label>
                Mẫu hoa còn tồn
                <Select required name="productId" defaultValue="">
                  <option value="" disabled>
                    Chọn mẫu hoa
                  </option>
                  {eligibleProducts.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · Còn {item.quantity}
                    </option>
                  ))}
                </Select>
              </label>
              <label>
                Ô trống tại kiosk gốc
                <Select required name="slotId" defaultValue="">
                  <option value="" disabled>
                    Chọn ô bán sẵn
                  </option>
                  {eligibleSlots.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.slotCode}
                    </option>
                  ))}
                </Select>
              </label>
              {(products.isPending || slots.isPending) && (
                <p role="status">Đang kiểm tra mẫu hoa và ô tủ…</p>
              )}
              {(products.isError || slots.isError) && (
                <IconActionButton
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void products.refetch();
                    void slots.refetch();
                  }}
                  action="reload"
                  label="Tải lại mẫu hoa và ô tủ"
                />
              )}
              {products.isSuccess && slots.isSuccess && !fieldsReady && (
                <p>Chưa có mẫu còn tồn hoặc ô trống có cảm biến sẵn sàng tại kiosk gốc.</p>
              )}
            </>
          )}
          {activeAction === 'review' && (
            <label>
              Kết quả xử lý
              <Select required name="outcome" defaultValue="">
                <option value="" disabled>
                  Chọn kết quả
                </option>
                {Object.entries(reviewOptions).map(([key, label]) => (
                  <option
                    key={key}
                    value={key}
                    disabled={
                      key === 'REPLACEMENT'
                        ? replacement?.state !== 'LOADED'
                        : key !== 'RETURN' && activeReplacement
                    }
                  >
                    {label}
                  </option>
                ))}
              </Select>
            </label>
          )}
          {activeAction === 'replacement/cancel' && (
            <p>
              Khách sẽ mất quyền nhận hoa thay. Nếu đã nạp hoa, dùng luồng thu hồi có giám sát để
              kiểm tra và lấy hoa ra.
            </p>
          )}
          {(['assignment', 'review', 'replacement/cancel'] as Action[]).includes(activeAction) && (
            <label>
              {activeAction === 'assignment'
                ? 'Hướng dẫn nhân viên'
                : activeAction === 'review'
                  ? 'Nội dung phản hồi'
                  : 'Lý do hủy'}
              <textarea
                name="notes"
                required
                minLength={10}
                maxLength={activeAction === 'assignment' ? 500 : 2000}
              />
            </label>
          )}
          <div className={styles.actions}>
            <Button type="submit" disabled={busy || blocked || stale || !fieldsReady}>
              {busy ? 'Đang lưu…' : 'Xác nhận'}
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setAction(null)}>
              Đóng
            </Button>
          </div>
        </form>
      )}
      {message && <p role={blocked ? 'alert' : 'status'}>{message}</p>}
      {blocked && (
        <div>
          <IconActionButton
            type="button"
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await reload();
                setBlocked(false);
                setMessage('Đã cập nhật hồ sơ.');
              } catch {
                setMessage('Chưa tải được hồ sơ. Thao tác vẫn đang khóa.');
              } finally {
                setBusy(false);
              }
            }}
            action="reload"
            label="Tải lại hồ sơ"
          />
        </div>
      )}
    </div>
  );
}

function QualityRow({
  row,
  root,
  onAdminDetail,
}: {
  row: QualityComplaint;
  root: string;
  onAdminDetail?: (row: QualityComplaint) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [evidencePage, setEvidencePage] = useState(1);
  const detail = useQuery({
    queryKey: ['quality-complaint', root, undefined, row.id, evidencePage],
    enabled: open,
    queryFn: () => request<QualityComplaint>(`${root}/${row.id}?evidencePage=${evidencePage}`),
  });
  const data = detail.data;
  return (
    <details className={styles.row} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>
        Đơn {row.orderCode} ·{' '}
        {qualityLabels[data?.handlingState ?? row.handlingState] || row.handlingState}
      </summary>
      {open && (
        <div className={styles.flow}>
          <p>Gửi lúc {qualityDate(row.createdAt)}</p>
          {detail.isPending ? (
            <p role="status">Đang tải hồ sơ…</p>
          ) : !data ? (
            <>
              {detail.isError && (
                <p role="alert">Chưa cập nhật được hồ sơ. Tải lại trước khi thao tác.</p>
              )}
              <p role="alert">Chưa tải được hồ sơ phản ánh.</p>
              <div>
                <Button variant="outline" onClick={() => void detail.refetch()}>
                  Thử lại
                </Button>
              </div>
            </>
          ) : (
            <>
              <div>
                <Button
                  variant="outline"
                  disabled={detail.isFetching}
                  onClick={() => void detail.refetch()}
                >
                  Cập nhật hồ sơ
                </Button>
              </div>
              <QualityComplaintDetails detail={data} scope="admin" onPage={setEvidencePage} />
              {!detail.isError &&
                data.status === 'OPEN' &&
                data.handlingState === 'REFUND_REVIEW' &&
                onAdminDetail?.(data)}
            </>
          )}
        </div>
      )}
    </details>
  );
}

function QualityComplaintList({
  onAdminDetail,
}: {
  onAdminDetail?: (row: QualityComplaint) => ReactNode;
}) {
  const root = '/admin/quality-complaints';
  const [page, setPage] = useState(1);
  const [state, setState] = useState('REFUND_REVIEW');
  const queue = useQuery({
    queryKey: ['quality-queue', root, undefined, state, page],
    queryFn: () =>
      request<QualitySchema['QualityComplaintPage']>(
        `${root}?${new URLSearchParams({ page: String(page), ...(state && { state }) })}`,
      ),
  });
  return (
    <section className={styles.queue} aria-label="Hồ sơ chất lượng hoa">
      <div className={styles.actions}>
        <label>
          Trạng thái
          <Select
            value={state}
            onChange={(event) => {
              setState(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả</option>
            {[
              'REPORTED',
              'ACCEPTED',
              'IN_PROGRESS',
              'REVIEW_REQUIRED',
              'REPLACEMENT_READY',
              'ATTENTION_REQUIRED',
              'REFUND_REVIEW',
              'RESOLVED',
            ].map((key) => (
              <option key={key} value={key}>
                {qualityLabels[key]}
              </option>
            ))}
          </Select>
        </label>
        <IconActionButton
          type="button"
          variant="outline"
          disabled={queue.isFetching}
          onClick={() => void queue.refetch()}
          action="reload"
          label="Làm mới hồ sơ"
        />
      </div>
      {queue.isPending ? (
        <p role="status">Đang tải phản ánh…</p>
      ) : queue.isError ? (
        <p role="alert">Chưa tải được danh sách phản ánh. Chọn “Làm mới hồ sơ” để thử lại.</p>
      ) : (
        <>
          {!queue.data.items.length && <p>Chưa có phản ánh ở trạng thái này.</p>}
          {queue.data.items.map((row) => (
            <QualityRow key={row.id} row={row} root={root} onAdminDetail={onAdminDetail} />
          ))}
          {(page > 1 || queue.data.hasMore) && (
            <div className={styles.actions}>
              <Button
                type="button"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Trang trước
              </Button>
              <span>Trang {page}</span>
              <Button
                type="button"
                variant="outline"
                disabled={!queue.data.hasMore}
                onClick={() => setPage((value) => value + 1)}
              >
                Trang tiếp
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default function QualityComplaintQueue({
  sellerId,
  onAdminDetail,
}: {
  sellerId?: string;
  onAdminDetail?: (row: QualityComplaint) => ReactNode;
}) {
  return sellerId ? (
    <SellerQualityComplaints
      sellerId={sellerId}
      renderActions={(detail, reload, stale, onBusy) => (
        <SellerActions
          detail={detail}
          sellerId={sellerId}
          reload={reload}
          stale={stale}
          onBusy={onBusy}
        />
      )}
    />
  ) : (
    <QualityComplaintList onAdminDetail={onAdminDetail} />
  );
}
