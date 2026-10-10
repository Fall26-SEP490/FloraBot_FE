import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Button } from '@florabot/ui';
import { ApiError, queryClient, request } from './api';

import type { ActiveTaskRole } from './StaffTasks';

type Scope = {
  sellerId: string;
  shopName: string;
  kioskId: string;
  kioskName: string;
  address: string;
};
type Incident = {
  id: string;
  kioskId: string;
  reason: string;
  location: { kioskName: string } | null;
};
type Payload = {
  id: string;
  assigneeId: string;
  kind: string;
  kioskId: string;
  sellerId: string | null;
  incidentId: string | null;
  instructions: string;
};
type Fields = { assigneeId: string; target: string; instructions: string };

export type AdminTaskAssignmentProps = {
  actorId?: string;
  adminId?: string;
  apiBase?: string;
  actorRole?: ActiveTaskRole;
  role?: ActiveTaskRole;
  allowedKinds?: ('INCIDENT' | 'DELIVERY')[];
  directoryEndpoint?: string;
  incidentsEndpoint?: string;
  deliveryScopesEndpoint?: string;
  sellerId?: string | null;
};

function restore(key: string): Payload | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || 'null') as Payload | null;
    return value &&
      typeof value.id === 'string' &&
      typeof value.assigneeId === 'string' &&
      typeof value.kioskId === 'string' &&
      typeof value.instructions === 'string' &&
      ['INCIDENT', 'DELIVERY'].includes(value.kind)
      ? value
      : null;
  } catch {
    return null;
  }
}

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
}: AdminTaskAssignmentProps) {
  const actorId = explicitActorId || adminId || 'actor';
  const effectiveRole = actorRole ?? role;
  const scopeKey = sellerId ? `seller:${sellerId}` : apiBase;
  const key = `florabot-task-assignment:${effectiveRole ?? 'none'}:${actorId}:${scopeKey}`;
  const [attempt, setAttempt] = useState<Payload | null>(() => restore(key));
  const defaultKind = allowedKinds.includes('INCIDENT') ? 'INCIDENT' : 'DELIVERY';
  const [kind, setKind] = useState(defaultKind);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const form = useForm<Fields>();
  const staff = useQuery({
    queryKey: ['staff-directory', actorId, directoryEndpoint, scopeKey],
    queryFn: () => request<{ id: string; name: string }[]>(directoryEndpoint),
  });
  const scopes = useQuery({
    queryKey: ['staff-delivery-scopes', actorId, deliveryScopesEndpoint, scopeKey],
    queryFn: () => request<Scope[]>(deliveryScopesEndpoint),
    enabled: kind === 'DELIVERY' && !attempt,
  });
  const incidents = useQuery({
    queryKey: ['assignment-incidents', actorId, incidentsEndpoint, scopeKey, page],
    queryFn: () =>
      request<{ items: Incident[]; hasMore: boolean }>(
        `${incidentsEndpoint}?status=OPEN&page=${page}`,
      ),
    enabled: kind === 'INCIDENT' && !attempt,
  });
  const targetQuery = kind === 'INCIDENT' ? incidents : scopes;
  async function send(payload: Payload) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    let saved = false;
    try {
      sessionStorage.setItem(key, JSON.stringify(payload));
      saved = true;
      setAttempt(payload);
      await request(apiBase, payload);
      sessionStorage.removeItem(key);
      setAttempt(null);
      form.reset();
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
  function submit(values: Fields) {
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
  return (
    <details className="member-empty">
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
            {allowedKinds.includes('INCIDENT') && <option value="INCIDENT">Kiểm tra sự cố</option>}
            {allowedKinds.includes('DELIVERY') && (
              <option value="DELIVERY">Giao hoa cho shop</option>
            )}
          </select>
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
            <p>Chưa có tài khoản nhân viên đang hoạt động để phân công.</p>
          ) : (
            <form noValidate onSubmit={form.handleSubmit(submit)}>
              {(kind === 'INCIDENT'
                ? incidents.data?.items.length === 0
                : scopes.data?.length === 0) && (
                <p>
                  {kind === 'INCIDENT'
                    ? 'Không có sự cố đang mở ở trang này.'
                    : 'Chưa có shop đang hoạt động với ô tủ hợp lệ để giao hoa.'}
                </p>
              )}
              <label htmlFor="assignment-staff">Nhân viên phụ trách</label>
              <select
                id="assignment-staff"
                {...form.register('assigneeId', { required: 'Chọn nhân viên phụ trách.' })}
                aria-invalid={!!form.formState.errors.assigneeId}
                aria-describedby="assignment-staff-error"
              >
                <option value="">Chọn nhân viên</option>
                {staff.data.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <p id="assignment-staff-error" className="error">
                {form.formState.errors.assigneeId?.message}
              </p>
              <label htmlFor="assignment-target">
                {kind === 'INCIDENT' ? 'Sự cố cần kiểm tra' : 'Shop và tủ giao hoa'}
              </label>
              <select
                id="assignment-target"
                {...form.register('target', { required: 'Chọn nơi cần thực hiện công việc.' })}
                aria-invalid={!!form.formState.errors.target}
                aria-describedby="assignment-target-error"
              >
                <option value="">Chọn công việc</option>
                {kind === 'INCIDENT'
                  ? incidents.data?.items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.location?.kioskName || 'Tủ hoa'} · {item.reason}
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
              <p id="assignment-target-error" className="error">
                {form.formState.errors.target?.message}
              </p>
              {kind === 'INCIDENT' && (
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
              <label htmlFor="assignment-instructions">Hướng dẫn công việc</label>
              <textarea
                id="assignment-instructions"
                rows={3}
                maxLength={2000}
                {...form.register('instructions', {
                  validate: (value) =>
                    value.trim().length >= 10 || 'Mô tả công việc ít nhất 10 ký tự.',
                })}
                aria-invalid={!!form.formState.errors.instructions}
                aria-describedby="assignment-instructions-error"
              />
              <p id="assignment-instructions-error" className="error">
                {form.formState.errors.instructions?.message}
              </p>
              <Button type="submit" disabled={busy}>
                Giao công việc
              </Button>
            </form>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </details>
  );
}
