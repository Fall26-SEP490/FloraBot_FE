import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Button } from '@florabot/ui';
import { ApiError, queryClient, request } from '@/shared/lib/api';
import type {
  AdminTaskAssignmentProps,
  DeliveryScope,
  IncidentCandidate,
  TaskAssignmentPayload,
} from '../task-management.types';
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
  const form = useForm<Fields>();
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
  });
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
    <details
      className={effectiveRole === 'SELLER' ? 'member-empty seller-assignment' : 'member-empty'}
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
              </div>
              <div className="assignment-field">
                <label htmlFor="assignment-target">
                  {kind === 'INCIDENT' ? 'Sự cố cần kiểm tra' : 'Shop và tủ giao hoa'}
                </label>
                <select
                  id="assignment-target"
                  {...form.register('target', { required: 'Chọn nơi cần thực hiện công việc.' })}
                  aria-invalid={!!form.formState.errors.target}
                  aria-describedby="assignment-target-error"
                >
                  <option value="">
                    {kind === 'INCIDENT' ? 'Chọn công việc' : 'Chọn tủ giao hoa'}
                  </option>
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
              </div>
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
              <div className="assignment-field assignment-field-wide">
                <label htmlFor="assignment-instructions">Hướng dẫn công việc</label>
                <textarea
                  id="assignment-instructions"
                  rows={3}
                  maxLength={2000}
                  placeholder={
                    effectiveRole === 'SELLER'
                      ? 'Ghi mẫu hoa, số lượng và lưu ý khi giao tại tủ…'
                      : undefined
                  }
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
}
