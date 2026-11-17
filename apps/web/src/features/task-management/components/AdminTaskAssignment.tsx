import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Button, RefreshCw, Search, ArrowRight } from '@florabot/ui';
import { Modal } from '@/shared/components/Modal';
import { ApiError, queryClient, request } from '@/shared/lib/api';
import type {
  AdminTaskAssignmentProps,
  DeliveryScope,
  IncidentCandidate,
  TaskAssignmentPayload,
} from '../task-management.types';
import { TASK_STATUS_LABELS } from '../task-management.constants';
import { restoreAssignmentPayload } from '../task-management.utils';

export type { AdminTaskAssignmentProps };

type Fields = { assigneeId: string; target: string; instructions: string };

export default function AdminTaskAssignment({
  actorId: explicitActorId,
  adminId,
  apiBase = '/admin/staff-tasks',
  actorRole,
  role,
  allowedKinds = ['INCIDENT', 'DELIVERY'],
  directoryEndpoint = '/admin/staff',
  incidentsEndpoint = '/admin/incidents',
  deliveryScopesEndpoint = '/admin/staff-delivery-scopes',
  sellerId,
  linkedTasks = [],
  onOpenTask,
}: AdminTaskAssignmentProps) {
  const actorId = explicitActorId || adminId || 'actor';
  const effectiveRole = actorRole ?? role;
  const scopeKey = sellerId ? `seller:${sellerId}` : apiBase;
  const key = `florabot-task-assignment:${effectiveRole ?? 'none'}:${actorId}:${scopeKey}`;
  const [attempt, setAttempt] = useState<TaskAssignmentPayload | null>(() =>
    restoreAssignmentPayload(key),
  );
  const defaultKind = allowedKinds.includes('INCIDENT') ? 'INCIDENT' : 'DELIVERY';
  const [kind, setKind] = useState(defaultKind);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [assignmentOpen, setAssignmentOpen] = useState(
    effectiveRole === 'OPERATIONS_MANAGER' && Boolean(attempt),
  );
  const form = useForm<Fields>();
  const [incidentSearch, setIncidentSearch] = useState('');
  const [showAllIncidents, setShowAllIncidents] = useState(false);
  const [incidentOrder, setIncidentOrder] = useState('newest');
  const staff = useQuery({
    queryKey: ['staff-directory', actorId, directoryEndpoint, scopeKey],
    queryFn: () => request<{ id: string; name: string }[]>(directoryEndpoint),
  });
  const scopes = useQuery({
    queryKey: ['staff-delivery-scopes', actorId, deliveryScopesEndpoint, scopeKey],
    queryFn: () => request<DeliveryScope[]>(deliveryScopesEndpoint),
    enabled: kind === 'DELIVERY' && !attempt,
  });
  const incidents = useQuery({
    queryKey: ['assignment-incidents', actorId, incidentsEndpoint, scopeKey, page],
    queryFn: () =>
      request<{ items: IncidentCandidate[]; hasMore: boolean }>(
        `${incidentsEndpoint}?status=OPEN&page=${page}`,
      ),
    enabled: kind === 'INCIDENT' && !attempt,
    refetchInterval: effectiveRole === 'OPERATIONS_MANAGER' ? 30_000 : false,
  });
  const searchTerm = incidentSearch.trim().toLocaleLowerCase('vi');
  const matchingIncidents = (incidents.data?.items ?? []).filter((incident) =>
    [
      incident.reason,
      incident.id,
      incident.location?.kioskName,
      incident.location?.kioskCode,
      incident.slot?.slotCode,
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('vi')
      .includes(searchTerm),
  );
  matchingIncidents.sort((a, b) => {
    const first = a.createdAt ? Date.parse(a.createdAt) || 0 : 0;
    const second = b.createdAt ? Date.parse(b.createdAt) || 0 : 0;
    return incidentOrder === 'newest' ? second - first : first - second;
  });
  const visibleIncidents = showAllIncidents ? matchingIncidents : matchingIncidents.slice(0, 5);
  const targetQuery = kind === 'INCIDENT' ? incidents : scopes;
  async function send(payload: TaskAssignmentPayload) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    let saved = false;
    try {
      sessionStorage.setItem(key, JSON.stringify(payload));
      saved = true;
      setAttempt(payload);
      if (effectiveRole === 'SELLER') {
        await request(
          '/me/staff-tasks',
          {
            assigneeId: payload.assigneeId,
            kioskId: payload.kioskId,
            instructions: payload.instructions,
          },
          true,
          'POST',
          { 'Idempotency-Key': payload.id },
        );
      } else {
        await request(apiBase, payload);
      }
      sessionStorage.removeItem(key);
      setAttempt(null);
      form.reset();
      if (effectiveRole === 'OPERATIONS_MANAGER') setAssignmentOpen(false);
      setNotice('Đã phân công. Nhân viên sẽ thấy công việc trong tài khoản.');
      await queryClient.invalidateQueries({ queryKey: ['staff-tasks'] });
    } catch (cause) {
      if (cause instanceof ApiError && [400, 403, 404, 409].includes(cause.status)) {
        sessionStorage.removeItem(key);
        setAttempt(null);
      }
      setError(
        !saved
          ? 'Không lưu được yêu cầu trong phiên trình duyệt nên chưa gửi phân công. Cho phép lưu trữ phiên rồi thử lại.'
          : cause instanceof ApiError
            ? cause.message
            : 'Chưa xác nhận được kết quả. Thông tin được giữ để kiểm tra lại bằng cùng mã yêu cầu.',
      );
    } finally {
      setBusy(false);
    }
  }
  const assignedTask = (incidentId: string) =>
    linkedTasks.find(
      (task) =>
        task.incidentId === incidentId &&
        ['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED'].includes(task.status),
    );
  function submit(values: Fields) {
    if (kind === 'INCIDENT' && assignedTask(values.target)) {
      setError(
        'Phiếu đã có công việc đang xử lý. Mở công việc đã giao để theo dõi hoặc đổi người phụ trách.',
      );
      return;
    }
    const incident = incidents.data?.items.find((item) => item.id === values.target);
    const scope = scopes.data?.find((item) => `${item.sellerId}:${item.kioskId}` === values.target);
    if (kind === 'INCIDENT' ? !incident : !scope) {
      setError('Chọn lại sự cố hoặc điểm giao đang có trong danh sách.');
      return;
    }
    void send({
      id: crypto.randomUUID(),
      assigneeId: values.assigneeId,
      kind,
      kioskId: kind === 'INCIDENT' ? incident!.kioskId : scope!.kioskId,
      sellerId: kind === 'DELIVERY' ? scope!.sellerId : null,
      incidentId: kind === 'INCIDENT' ? incident!.id : null,
      instructions: values.instructions.trim(),
    });
  }
  const assignmentContent = (
    <details
      open={assignmentOpen}
      onToggle={(event) => setAssignmentOpen(event.currentTarget.open)}
      className={
        effectiveRole === 'SELLER'
          ? 'member-empty seller-assignment'
          : effectiveRole === 'OPERATIONS_MANAGER'
            ? 'member-empty operations-assignment'
            : 'member-empty'
      }
    >
      <summary>Phân công công việc mới</summary>
      {attempt ? (
        <>
          <p>
            Yêu cầu đang chờ xác nhận: {attempt.kind === 'INCIDENT' ? 'Kiểm tra sự cố' : 'Giao hoa'}
            .
          </p>
          <p>{attempt.instructions}</p>
          <Button disabled={busy} onClick={() => void send(attempt)}>
            {busy ? 'Đang kiểm tra…' : 'Kiểm tra lại yêu cầu'}
          </Button>
        </>
      ) : (
        <>
          {effectiveRole === 'SELLER' && (
            <p className="assignment-help">
              Chọn người phụ trách, tủ cần giao và hướng dẫn cụ thể. Đây là phân công giao hoa; việc
              nạp hoa được nhân viên ghi nhận khi thực hiện công việc.
            </p>
          )}
          <div className={effectiveRole === 'SELLER' ? 'assignment-kind-note' : undefined}>
            <label htmlFor="assignment-kind">Loại công việc</label>
            <select
              id="assignment-kind"
              value={kind}
              disabled={busy || allowedKinds.length <= 1}
              onChange={(event) => {
                setKind(event.target.value);
                form.resetField('target');
              }}
            >
              {allowedKinds.includes('INCIDENT') && (
                <option value="INCIDENT">Kiểm tra sự cố</option>
              )}
              {allowedKinds.includes('DELIVERY') && (
                <option value="DELIVERY">Giao hoa cho shop</option>
              )}
            </select>
          </div>
          {staff.isPending || targetQuery.isPending ? (
            <p role="status">Đang tải thông tin phân công…</p>
          ) : staff.isError || targetQuery.isError ? (
            <>
              <p role="alert">Chưa tải được dữ liệu phân công.</p>
              <Button
                onClick={() => {
                  void staff.refetch();
                  void targetQuery.refetch();
                }}
              >
                Tải lại thông tin phân công
              </Button>
            </>
          ) : !Array.isArray(staff.data) || staff.data.length === 0 ? (
            <div role="status">
              <p>Chưa có tài khoản nhân viên đang hoạt động để phân công.</p>
              {effectiveRole === 'SELLER' && (
                <Link href="/seller/staff">Thêm hoặc mở lại nhân viên shop</Link>
              )}
            </div>
          ) : effectiveRole === 'SELLER' && scopes.data?.length === 0 ? (
            <div role="status">
              <p>
                Chưa có tủ giao hoa đủ điều kiện trong shop. Kiểm tra tủ và quyền sử dụng trước khi
                phân công.
              </p>
              <Link href="/seller/kiosks">Kiểm tra kiosk của shop</Link>
            </div>
          ) : (
            <form
              className={effectiveRole === 'SELLER' ? 'assignment-form' : undefined}
              noValidate
              onSubmit={form.handleSubmit(submit)}
            >
              {(kind === 'INCIDENT'
                ? incidents.data?.items.length === 0
                : scopes.data?.length === 0) && (
                <p>
                  {kind === 'INCIDENT'
                    ? 'Không có sự cố đang mở ở trang này.'
                    : 'Chưa có shop đang hoạt động với ô tủ hợp lệ để giao hoa.'}
                </p>
              )}
              <div className="assignment-field">
                <label htmlFor="assignment-staff">Nhân viên phụ trách</label>
                <select
                  id="assignment-staff"
                  {...form.register('assigneeId', { required: 'Chọn nhân viên phụ trách.' })}
                  aria-invalid={!!form.formState.errors.assigneeId}
                  aria-describedby={
                    form.formState.errors.assigneeId ? 'assignment-staff-error' : undefined
                  }
                >
                  <option value="">Chọn nhân viên</option>
                  {staff.data.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                {form.formState.errors.assigneeId?.message && (
                  <p id="assignment-staff-error" className="error">
                    {form.formState.errors.assigneeId.message}
                  </p>
                )}
              </div>
              <div className="assignment-field">
                <label htmlFor="assignment-target">
                  {kind === 'INCIDENT' ? 'Sự cố cần kiểm tra' : 'Shop và tủ giao hoa'}
                </label>
                <select
                  id="assignment-target"
                  {...form.register('target', { required: 'Chọn nơi cần thực hiện công việc.' })}
                  aria-invalid={!!form.formState.errors.target}
                  aria-describedby={
                    form.formState.errors.target ? 'assignment-target-error' : undefined
                  }
                >
                  <option value="">
                    {kind === 'INCIDENT' ? 'Chọn sự cố cần kiểm tra' : 'Chọn tủ giao hoa'}
                  </option>
                  {kind === 'INCIDENT'
                    ? incidents.data?.items.map((item) => (
                        <option
                          key={item.id}
                          value={item.id}
                          disabled={Boolean(assignedTask(item.id))}
                        >
                          {item.location?.kioskName || 'Tủ hoa'} · {item.reason} ·{' '}
                          {item.id.slice(0, 8)}
                        </option>
                      ))
                    : scopes.data?.map((item) => (
                        <option
                          key={`${item.sellerId}:${item.kioskId}`}
                          value={`${item.sellerId}:${item.kioskId}`}
                        >
                          {item.shopName} · {item.kioskName} · {item.address}
                        </option>
                      ))}
                </select>
                {form.formState.errors.target?.message && (
                  <p id="assignment-target-error" className="error">
                    {form.formState.errors.target.message}
                  </p>
                )}
              </div>
              {effectiveRole !== 'OPERATIONS_MANAGER' &&
                kind === 'INCIDENT' &&
                (page > 1 || incidents.data?.hasMore) && (
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={page === 1}
                      onClick={() => {
                        setPage(page - 1);
                        form.resetField('target');
                      }}
                    >
                      Sự cố trang trước
                    </Button>
                    <span> Trang {page} </span>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!incidents.data?.hasMore}
                      onClick={() => {
                        setPage(page + 1);
                        form.resetField('target');
                      }}
                    >
                      Sự cố trang sau
                    </Button>
                  </div>
                )}
              <div className="assignment-field assignment-field-wide">
                <label htmlFor="assignment-instructions">Hướng dẫn công việc</label>
                <textarea
                  id="assignment-instructions"
                  rows={3}
                  maxLength={2000}
                  placeholder={
                    effectiveRole === 'SELLER'
                      ? 'Ghi mẫu hoa, số lượng và lưu ý khi giao tại tủ…'
                      : 'Mô tả việc cần kiểm tra và kết quả cần báo cáo (ít nhất 10 ký tự)…'
                  }
                  {...form.register('instructions', {
                    validate: (value) =>
                      value.trim().length >= 10 || 'Mô tả công việc ít nhất 10 ký tự.',
                  })}
                  aria-invalid={!!form.formState.errors.instructions}
                  aria-describedby={
                    form.formState.errors.instructions ? 'assignment-instructions-error' : undefined
                  }
                />
                {form.formState.errors.instructions?.message && (
                  <p id="assignment-instructions-error" className="error">
                    {form.formState.errors.instructions.message}
                  </p>
                )}
              </div>
              <Button type="submit" disabled={busy}>
                {busy ? 'Đang phân công…' : 'Giao công việc'}
              </Button>
            </form>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </details>
  );
  return (
    <>
      {effectiveRole === 'OPERATIONS_MANAGER' && (
        <section className="operations-incident-panel" aria-labelledby="operations-open-incidents">
          <div className="operations-section-heading">
            <div>
              <span className="operations-eyebrow">TIẾP NHẬN & PHÂN CÔNG</span>
              <h2 id="operations-open-incidents">Phiếu sự cố đang mở</h2>
              <p className="manager-panel-description">
                Chọn phiếu để phân công kỹ thuật viên kiểm tra.
              </p>
            </div>
            <div className="manager-inbox-actions">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setAssignmentOpen(true)}
              >
                {attempt ? 'Kiểm tra phân công' : 'Phân công mới'}
              </Button>
              <Button
                type="button"
                variant="outline"
                aria-label="Làm mới sự cố"
                title="Làm mới sự cố"
                disabled={incidents.isFetching || Boolean(attempt)}
                onClick={() => void incidents.refetch()}
              >
                <RefreshCw size={16} aria-hidden="true" />
              </Button>
            </div>
          </div>
          <div className="manager-inbox-tools">
            <div className="operations-incident-search">
              <Search size={18} aria-hidden="true" />
              <label className="sr-only" htmlFor="incident-search">
                Tìm sự cố trong trang
              </label>
              <input
                id="incident-search"
                type="search"
                placeholder="Tìm kiosk, ô tủ hoặc nội dung sự cố…"
                value={incidentSearch}
                onChange={(event) => {
                  setIncidentSearch(event.target.value);
                  setShowAllIncidents(false);
                }}
              />
            </div>
            <div className="manager-inbox-sort">
              <label className="sr-only" htmlFor="incident-order">
                Sắp xếp sự cố trong trang
              </label>
              <select
                id="incident-order"
                value={incidentOrder}
                onChange={(event) => setIncidentOrder(event.target.value)}
              >
                <option value="newest">Mới nhất</option>
                <option value="oldest">Cũ nhất</option>
              </select>
            </div>
          </div>
          {incidents.isPending ? (
            <p role="status">Đang tải sự cố…</p>
          ) : incidents.isError ? (
            <p role="alert">Chưa tải được sự cố. Dùng nút làm mới để thử lại.</p>
          ) : !incidents.data?.items.length ? (
            <p className="operations-incident-empty">Không có sự cố đang mở ở trang này.</p>
          ) : (
            <>
              <p className="operations-result-count">
                {matchingIncidents.length} phiếu trong trang {page}
              </p>
              {!matchingIncidents.length && (
                <p className="operations-incident-empty">
                  Không tìm thấy sự cố phù hợp trong trang này.
                </p>
              )}
              <div className="manager-inbox-columns" aria-hidden="true">
                <span>Kiosk / Ô tủ</span>
                <span>Nội dung sự cố</span>
                <span>Phân công</span>
              </div>
              <ul className="operations-incident-inbox">
                {visibleIncidents.map((incident) => (
                  <li key={incident.id}>
                    <div className="operations-incident-content">
                      <div className="operations-incident-meta">
                        <span className="operations-incident-reference">
                          SC-{incident.id.slice(-6).toUpperCase()}
                        </span>
                        {incident.slot?.slotCode && <span>Ô {incident.slot.slotCode}</span>}
                      </div>
                      <h3>
                        {incident.location?.kioskName || 'Tủ hoa'}
                        {incident.location?.kioskCode && (
                          <small>{incident.location.kioskCode}</small>
                        )}
                      </h3>
                      <details className="operations-incident-details">
                        <summary>Chi tiết phiếu</summary>
                        <p>Mã phiếu: {incident.id}</p>
                        {incident.createdAt && (
                          <p>
                            Ghi nhận:{' '}
                            {new Date(incident.createdAt).toLocaleString('vi-VN', {
                              timeZone: 'Asia/Ho_Chi_Minh',
                            })}
                          </p>
                        )}
                      </details>
                    </div>
                    <div className="manager-incident-reason">
                      <p>{incident.reason}</p>
                      <span
                        className={
                          assignedTask(incident.id) ? 'manager-assigned-tag' : 'manager-open-tag'
                        }
                      >
                        {assignedTask(incident.id)
                          ? `${TASK_STATUS_LABELS[assignedTask(incident.id)!.status]} · ${assignedTask(incident.id)!.assigneeName}`
                          : 'Đang mở'}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy || Boolean(attempt)}
                      aria-label={
                        assignedTask(incident.id)
                          ? `Xem công việc của sự cố ${incident.id}`
                          : `Chọn sự cố ${incident.id} để phân công`
                      }
                      onClick={() => {
                        const linked = assignedTask(incident.id);
                        if (linked && onOpenTask) {
                          onOpenTask(linked.id);
                          return;
                        }
                        setKind('INCIDENT');
                        form.setValue('target', incident.id, { shouldValidate: true });
                        setAssignmentOpen(true);
                      }}
                    >
                      {assignedTask(incident.id) ? 'Xem công việc' : 'Phân công'}{' '}
                      <ArrowRight size={15} aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
              {matchingIncidents.length > 5 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAllIncidents(!showAllIncidents)}
                >
                  {showAllIncidents
                    ? 'Thu gọn danh sách'
                    : `Xem thêm ${matchingIncidents.length - 5} phiếu`}
                </Button>
              )}
            </>
          )}
          {(page > 1 || incidents.data?.hasMore) && (
            <div>
              <Button
                type="button"
                variant="outline"
                disabled={page === 1 || Boolean(attempt)}
                onClick={() => {
                  setIncidentSearch('');
                  setShowAllIncidents(false);
                  setPage(page - 1);
                  form.resetField('target');
                }}
              >
                Sự cố trang trước
              </Button>
              <span> Trang {page} </span>
              <Button
                type="button"
                variant="outline"
                disabled={!incidents.data?.hasMore || Boolean(attempt)}
                onClick={() => {
                  setIncidentSearch('');
                  setShowAllIncidents(false);
                  setPage(page + 1);
                  form.resetField('target');
                }}
              >
                Sự cố trang sau
              </Button>
            </div>
          )}
          {notice && <p role="status">{notice}</p>}
        </section>
      )}
      {effectiveRole === 'OPERATIONS_MANAGER' ? (
        <Modal
          open={assignmentOpen}
          title="Phân công kỹ thuật viên"
          description="Chọn người phụ trách và hướng dẫn kiểm tra tại kiosk."
          onClose={() => setAssignmentOpen(false)}
          closeDisabled={busy}
          className="manager-assignment-modal"
        >
          {assignmentContent}
        </Modal>
      ) : (
        assignmentContent
      )}
    </>
  );
}
