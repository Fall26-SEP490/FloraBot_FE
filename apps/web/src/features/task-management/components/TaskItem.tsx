import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { Button, MapPin, Store } from '@florabot/ui';
import { ApiError, queryClient, request } from '@/shared/lib/api';
import StaffIncidentResolution from '../../incidents/StaffIncidentResolution';
import StaffStock from '../../inventory/StaffStock';
import StaffInventoryMaintenance, {
  useStaffInventoryMaintenance,
} from '../../inventory/StaffInventoryMaintenance';
import { TASK_STATUS_LABELS } from '../task-management.constants';
import type { ActiveTaskRole, Task } from '../task-management.types';
import StaffEvidence from './StaffEvidence';
import StaffReassignment from './StaffReassignment';
import StaffTaskDetails, { staffTaskDetailsQuery } from './StaffTaskDetails';
import TechnicianRepairAccess from './TechnicianRepairAccess';
import StaffPreorderFulfillment from './StaffPreorderFulfillment';

export function TaskItem({
  task,
  mode,
  role,
  actorId,
  sellerId,
  apiBase,
  directoryEndpoint,
  canReassign,
  readOnly,
}: {
  task: Task;
  mode: 'worker' | 'manager' | 'oversight';
  role: ActiveTaskRole;
  actorId?: string;
  sellerId?: string | null;
  apiBase: string;
  directoryEndpoint?: string;
  canReassign: boolean;
  readOnly: boolean;
}) {
  const isWorker = mode === 'worker';
  const isTechnician = isWorker && role === 'TECHNICIAN';
  const nextLabel =
    task.status === 'ASSIGNED'
      ? 'Bắt đầu xử lý'
      : task.status === 'IN_PROGRESS'
        ? 'Tiếp tục xử lý'
        : task.status === 'SUBMITTED' || task.status === 'COMPLETED'
          ? 'Xem báo cáo'
          : 'Xem chi tiết';
  const isManager = mode === 'manager';
  const [taskOpen, setTaskOpen] = useState(false);
  const [showCancellation, setShowCancellation] = useState(false);
  const staffDelivery =
    isWorker && role === 'SELLER_STAFF' && !!actorId && task.kind === 'DELIVERY';
  const startingDelivery = staffDelivery && task.status === 'ASSIGNED';
  const canWorkOnInventory = staffDelivery && task.status === 'IN_PROGRESS';
  const inventory = useStaffInventoryMaintenance(task.id, actorId, canWorkOnInventory);
  const needsRepairContext =
    isTechnician && task.kind === 'INCIDENT' && task.status === 'IN_PROGRESS';
  const repairDetails = useQuery({
    ...staffTaskDetailsQuery(
      task.id,
      apiBase,
      sellerId ? `seller:${sellerId}` : apiBase,
      actorId,
      task.version,
    ),
    enabled: needsRepairContext && taskOpen,
  });
  const slotRepair =
    needsRepairContext &&
    repairDetails.isSuccess &&
    Boolean(repairDetails.data.incident?.slotId || repairDetails.data.slotCode);
  const reviewingIncident =
    isManager &&
    role === 'OPERATIONS_MANAGER' &&
    task.kind === 'INCIDENT' &&
    task.status === 'SUBMITTED';

  const form = useForm<{ report: string; status: string }>();
  const reportError = form.formState.errors.report?.message;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [conflictVersion, setConflictVersion] = useState<number | null>(null);
  const needsLatestVersion = conflictVersion === task.version;
  const [notice, setNotice] = useState('');
  const [instructionsDraft, setInstructionsDraft] = useState(task.instructions);
  const [editingInstructions, setEditingInstructions] = useState(false);
  const waitingForInventory =
    canWorkOnInventory &&
    (inventory.isPending ||
      inventory.isError ||
      (!!inventory.data && inventory.data.sessionStage !== 'Completed'));
  const canEditInstructions =
    !readOnly &&
    !isWorker &&
    ['ASSIGNED', 'IN_PROGRESS'].includes(task.status) &&
    (role === 'ADMIN' ||
      (role === 'OPERATIONS_MANAGER' && task.kind === 'INCIDENT') ||
      (role === 'SELLER' && task.kind === 'DELIVERY'));

  async function saveInstructions(event: React.FormEvent) {
    event.preventDefault();
    if (!canEditInstructions || busy || uncertain || needsLatestVersion) return;
    const trimmed = instructionsDraft.trim();
    if (trimmed.length < 10 || trimmed.length > 2000) {
      setError('Hướng dẫn công việc cần từ 10 đến 2.000 ký tự.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await request(
        `${apiBase}/${task.id}`,
        { version: task.version, instructions: trimmed },
        true,
        'PATCH',
      );
      setNotice('Đã cập nhật hướng dẫn công việc.');
      setEditingInstructions(false);
      await queryClient.invalidateQueries({ queryKey: ['staff-tasks'] });
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        setConflictVersion(task.version);
        return;
      }
      setError(
        cause instanceof ApiError ? cause.message : 'Chưa cập nhật được hướng dẫn công việc.',
      );
    } finally {
      setBusy(false);
    }
  }
  const canCancelOpenTask =
    !readOnly &&
    isManager &&
    (role === 'SELLER' || role === 'OPERATIONS_MANAGER') &&
    ['ASSIGNED', 'IN_PROGRESS'].includes(task.status);
  const choices =
    readOnly || (canCancelOpenTask && !showCancellation)
      ? []
      : isManager
        ? task.status === 'SUBMITTED'
          ? ['COMPLETED', 'IN_PROGRESS', 'CANCELLED']
          : ['ASSIGNED', 'IN_PROGRESS'].includes(task.status)
            ? ['CANCELLED']
            : []
        : isWorker
          ? task.status === 'ASSIGNED'
            ? ['IN_PROGRESS']
            : task.status === 'IN_PROGRESS' && !waitingForInventory
              ? ['SUBMITTED']
              : []
          : [];
  async function refreshTask() {
    setBusy(true);
    setError('');
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['staff-tasks'] }, { throwOnError: true }),
        queryClient.invalidateQueries({ queryKey: ['staff-inventory-maintenance', task.id] }),
        queryClient.invalidateQueries(
          { queryKey: ['staff-detail', task.id] },
          { throwOnError: true },
        ),
      ]);
      setUncertain(false);
      setConflictVersion(null);
      setNotice('Đã tải lại công việc. Kiểm tra trạng thái và hướng dẫn trước khi tiếp tục.');
    } catch {
      setError('Chưa tải được công việc. Kiểm tra kết nối rồi thử lại.');
    } finally {
      setBusy(false);
    }
  }

  async function submit(values: { report: string; status: string }) {
    if (busy || uncertain || needsLatestVersion || !choices.includes(values.status)) return;
    setBusy(true);
    setError('');
    setNotice('');
    setConflictVersion(null);
    try {
      await request(`${apiBase}/${task.id}/transition`, { ...values, version: task.version });
      form.reset();
      setNotice('Đã cập nhật công việc.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['staff-tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['staff-inventory-maintenance', task.id] }),
      ]);
    } catch (cause) {
      if (isTechnician && cause instanceof ApiError && cause.status === 409) {
        setConflictVersion(task.version);
        return;
      }
      if (
        reviewingIncident &&
        values.status === 'COMPLETED' &&
        cause instanceof ApiError &&
        cause.status === 409
      ) {
        setUncertain(true);
        setError(
          'Chưa duyệt được báo cáo. Tải lại công việc và kiểm tra kết quả xác minh tại tủ trước khi duyệt lại.',
        );
        return;
      }
      const ambiguous = !(cause instanceof ApiError) || cause.status >= 500 || cause.status === 409;
      setUncertain(ambiguous);
      setError(
        ambiguous
          ? cause instanceof ApiError && cause.status >= 500
            ? `Máy chủ trả lỗi HTTP ${cause.status}. Chưa xác nhận được trạng thái mới; tải lại công việc trước khi thao tác tiếp.`
            : 'Chưa xác nhận được trạng thái mới. Tải lại danh sách để kiểm tra trước khi thao tác tiếp.'
          : cause.message,
      );
    } finally {
      setBusy(false);
    }
  }
  const quickTemplates = isTechnician
    ? task.status === 'ASSIGNED'
      ? [
          {
            label: 'Đã nhận việc kiểm tra sự cố tại tủ',
            value: 'Đã nhận việc kiểm tra sự cố tại tủ',
          },
          {
            label: 'Đã có mặt tại kiosk để kiểm tra sự cố',
            value: 'Đã có mặt tại kiosk để kiểm tra sự cố',
          },
        ]
      : []
    : !staffDelivery
      ? []
      : task.status === 'ASSIGNED'
        ? [
            { label: 'Bắt đầu giao hoa đến tủ', value: 'Bắt đầu giao hoa đến tủ' },
            { label: 'Đã có mặt tại kiosk', value: 'Đã có mặt tại kiosk' },
          ]
        : task.status === 'IN_PROGRESS'
          ? [
              { label: 'Đã nạp hoa đủ', value: 'Đã nạp hoa và kiểm tra đầy đủ' },
              {
                label: 'Các ô hoạt động tốt',
                value: 'Đã nạp hoa xong, các ô hoạt động tốt',
              },
            ]
          : [];

  const taskContent = (
    <>
      {canWorkOnInventory && actorId && (
        <div className="staff-stocking-section">
          <div className="staff-stocking-header">
            <h4>Thao tác tại tủ</h4>
          </div>
          {inventory.isPending && <p role="status">Đang tải thao tác được giao…</p>}
          {inventory.data && <StaffInventoryMaintenance taskId={task.id} scope={inventory.data} />}
          {inventory.isError && (
            <p role="alert">
              Chưa tải được thao tác được giao
              {inventory.error instanceof ApiError ? ` (HTTP ${inventory.error.status})` : ''}.{' '}
              <Button type="button" variant="outline" onClick={() => void inventory.refetch()}>
                Tải lại
              </Button>
            </p>
          )}
          {inventory.data === null && (
            <StaffStock
              taskId={task.id}
              actorId={actorId}
              sellerId={sellerId}
              role={role}
              active={task.status === 'IN_PROGRESS'}
              apiBase={apiBase}
            />
          )}
          {inventory.data === null && (
            <StaffPreorderFulfillment taskId={task.id} active={task.status === 'IN_PROGRESS'} />
          )}
        </div>
      )}
      {canCancelOpenTask && (
        <div>
          <p>
            {task.status === 'ASSIGNED'
              ? role === 'OPERATIONS_MANAGER'
                ? 'Đang chờ kỹ thuật viên bắt đầu công việc.'
                : 'Đang chờ nhân viên bắt đầu công việc.'
              : 'Nhân viên đang thực hiện. Bạn có thể duyệt khi nhận được báo cáo.'}
          </p>
          <Button
            type="button"
            variant="outline"
            aria-expanded={showCancellation}
            disabled={busy || uncertain || needsLatestVersion}
            onClick={() => {
              setShowCancellation(!showCancellation);
              form.reset();
            }}
          >
            {showCancellation ? 'Đóng form hủy' : 'Hủy công việc'}
          </Button>
        </div>
      )}
      {choices.length > 0 && (!needsRepairContext || (repairDetails.isSuccess && !slotRepair)) && (
        <form noValidate onSubmit={form.handleSubmit(submit)} className="staff-transition-form">
          <div className="staff-transition-header">
            <h4>
              {canCancelOpenTask
                ? 'Hủy công việc'
                : startingDelivery
                  ? 'Bắt đầu công việc'
                  : 'Cập nhật tiến độ & Báo cáo'}
            </h4>
            <p>
              {canCancelOpenTask
                ? 'Nhập lý do hủy để nhân viên biết.'
                : isTechnician
                  ? 'Chọn bước tiếp theo và nhập nội dung để quản lý theo dõi xử lý sự cố.'
                  : startingDelivery
                    ? 'Nhập ghi chú hoặc chọn gợi ý, rồi bấm Bắt đầu. Thao tác tại tủ sẽ hiện khi công việc chuyển sang Đang thực hiện.'
                    : canWorkOnInventory
                      ? 'Sau khi thực hiện và ghi nhận thao tác tại tủ, gửi kết quả để chủ shop duyệt.'
                      : 'Chọn bước tiếp theo và nhập nội dung cập nhật.'}
            </p>
          </div>
          <div className="staff-form-group">
            <label htmlFor={`action-${task.id}`}>Bước tiếp theo</label>
            <select
              id={`action-${task.id}`}
              {...form.register('status', { required: true })}
              disabled={busy || uncertain}
            >
              {choices.map((choice) => (
                <option key={choice} value={choice}>
                  {choice === 'IN_PROGRESS' && isManager
                    ? 'Yêu cầu kiểm tra lại'
                    : choice === 'CANCELLED'
                      ? 'Hủy công việc'
                      : TASK_STATUS_LABELS[choice]}
                </option>
              ))}
            </select>
          </div>
          <div className="staff-form-group">
            <label htmlFor={`report-${task.id}`}>
              {canCancelOpenTask ? 'Lý do hủy' : 'Nội dung cập nhật'}
            </label>
            {quickTemplates.length > 0 && (
              <div className="staff-quick-templates" aria-label="Gợi ý nội dung">
                <span className="staff-quick-label">Gợi ý nhanh:</span>
                <div className="staff-quick-chips">
                  {quickTemplates.map((template) => (
                    <button
                      key={template.value}
                      type="button"
                      className="staff-chip-btn"
                      onClick={() =>
                        form.setValue('report', template.value, { shouldValidate: true })
                      }
                    >
                      {template.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <textarea
              id={`report-${task.id}`}
              maxLength={2000}
              rows={3}
              placeholder={
                canCancelOpenTask
                  ? 'Nhập lý do hủy (ít nhất 10 ký tự)…'
                  : 'Nhập nội dung (ít nhất 10 ký tự)…'
              }
              {...form.register('report', {
                validate: (value) => (value?.trim().length ?? 0) >= 10 || 'Mô tả ít nhất 10 ký tự.',
              })}
              aria-invalid={Boolean(reportError)}
              aria-describedby={reportError ? `report-error-${task.id}` : undefined}
              disabled={busy}
            />
            {reportError && (
              <p id={`report-error-${task.id}`} className="error" role="alert">
                {reportError}
              </p>
            )}
          </div>
          <Button
            type="submit"
            disabled={busy || uncertain || needsLatestVersion}
            className="staff-submit-btn"
          >
            {busy
              ? 'Đang cập nhật…'
              : canCancelOpenTask
                ? 'Xác nhận hủy'
                : isTechnician
                  ? task.status === 'ASSIGNED'
                    ? 'Bắt đầu xử lý'
                    : 'Gửi báo cáo'
                  : startingDelivery
                    ? 'Bắt đầu'
                    : canWorkOnInventory
                      ? 'Gửi báo cáo'
                      : 'Xác nhận cập nhật'}
          </Button>
        </form>
      )}
      {task.report && (
        <div className="staff-latest-report">
          <strong>
            {task.status === 'IN_PROGRESS' ? 'Cập nhật gần nhất:' : 'Báo cáo gần nhất:'}
          </strong>{' '}
          <p>{task.report}</p>
        </div>
      )}
      <div className="staff-secondary-details">
        <StaffEvidence
          key={`${task.id}:${task.version}:${actorId}`}
          taskId={task.id}
          version={task.version}
          apiBase={apiBase}
          actorId={actorId}
          sellerId={sellerId}
          role={role}
          mode={mode}
          admin={!isWorker}
          active={isWorker && task.status === 'IN_PROGRESS'}
        />
        <StaffTaskDetails
          taskId={task.id}
          version={task.version}
          apiBase={apiBase}
          admin={!isWorker}
          readOnly={readOnly}
          actorId={actorId}
          sellerId={sellerId}
          role={role}
        />
        {canReassign && ['ASSIGNED', 'IN_PROGRESS'].includes(task.status) && (
          <StaffReassignment
            taskId={task.id}
            version={task.version}
            assigneeId={task.assigneeId}
            assigneeName={task.assigneeName}
            apiBase={apiBase}
            directoryEndpoint={directoryEndpoint}
            actorId={actorId}
            sellerId={sellerId}
            role={role}
          />
        )}
        {canEditInstructions && (
          <details
            open={editingInstructions}
            onToggle={(e) => setEditingInstructions(e.currentTarget.open)}
          >
            <summary>Sửa hướng dẫn công việc</summary>
            {editingInstructions && (
              <form onSubmit={(e) => void saveInstructions(e)} noValidate>
                <label htmlFor={`edit-instructions-${task.id}`}>
                  Hướng dẫn công việc (10–2.000 ký tự)
                </label>
                <textarea
                  id={`edit-instructions-${task.id}`}
                  rows={3}
                  minLength={10}
                  maxLength={2000}
                  disabled={busy}
                  value={instructionsDraft}
                  onChange={(e) => setInstructionsDraft(e.target.value)}
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={
                    busy || uncertain || needsLatestVersion || instructionsDraft.trim().length < 10
                  }
                >
                  {busy ? 'Đang lưu…' : 'Lưu hướng dẫn'}
                </Button>
              </form>
            )}
          </details>
        )}
      </div>
      {needsRepairContext && taskOpen && repairDetails.isPending && (
        <p role="status">Đang kiểm tra ô tủ của công việc…</p>
      )}
      {needsRepairContext && taskOpen && repairDetails.isError && (
        <div>
          <p role="alert">Chưa kiểm tra được ô tủ. Tải lại trước khi gửi báo cáo.</p>
          <Button type="button" variant="outline" onClick={() => void repairDetails.refetch()}>
            Tải lại thông tin ô tủ
          </Button>
        </div>
      )}
      {slotRepair && taskOpen && repairDetails.data.slotStatus === 'FAULT' && (
        <TechnicianRepairAccess taskId={task.id} slotCode={repairDetails.data.slotCode} />
      )}
      {isTechnician &&
        actorId &&
        task.kind === 'INCIDENT' &&
        (!needsRepairContext || repairDetails.isSuccess) && (
          <StaffIncidentResolution
            taskId={task.id}
            actorId={actorId}
            sellerId={sellerId}
            role={role}
            version={task.version}
            active={task.status === 'IN_PROGRESS'}
            slotRepair={slotRepair}
            apiBase={apiBase}
          />
        )}
      {conflictVersion !== null &&
        (needsLatestVersion ? (
          <div>
            <p role="alert">Công việc đã thay đổi. Tải lại để xem hướng dẫn và trạng thái mới.</p>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void refreshTask()}
            >
              {busy ? 'Đang tải…' : 'Tải hướng dẫn mới'}
            </Button>
          </div>
        ) : (
          <p role="status">Đã tải công việc mới nhất. Kiểm tra hướng dẫn trước khi gửi lại.</p>
        ))}
      {reviewingIncident && (
        <p>
          Đối chiếu báo cáo và bằng chứng của kỹ thuật viên trước khi duyệt. Với sự cố gắn ô tủ, hệ
          thống sẽ kiểm tra lại tín hiệu cửa và cảm biến trước khi đóng sự cố.
        </p>
      )}
    </>
  );
  return (
    <article
      className={role === 'SELLER_STAFF' ? 'staff-task-card' : 'staff-task-card member-empty'}
      aria-labelledby={`task-${task.id}`}
    >
      <div className="staff-task-heading">
        <div>
          <h3 id={`task-${task.id}`}>
            {task.kind === 'INCIDENT' ? 'Kiểm tra sự cố' : 'Giao hoa'} · {task.kioskName}
          </h3>
          {!isTechnician && (
            <p className="staff-assignee-text">Người thực hiện: {task.assigneeName}</p>
          )}
        </div>
        <span className="staff-task-label" data-status={task.status}>
          {TASK_STATUS_LABELS[task.status] || task.status}
        </span>
      </div>
      <div className="staff-task-destination-card">
        <p className="staff-destination-address">
          <MapPin size={15} aria-hidden="true" />
          <span className="staff-destination-text">
            <span>{task.address}</span>
            {task.shopName ? <span className="staff-destination-shop">{task.shopName}</span> : null}
          </span>
        </p>
        {task.instructions && (
          <div className="staff-instructions-callout">
            <div className="staff-instructions-head">
              <Store size={14} aria-hidden="true" />
              <strong>
                {task.kind === 'INCIDENT' ? 'Hướng dẫn từ quản lý:' : 'Ghi chú từ shop:'}
              </strong>
            </div>
            <p>{task.instructions}</p>
          </div>
        )}
      </div>
      {isTechnician ? (
        <details
          className="technician-task-body"
          onToggle={(event) => setTaskOpen(event.currentTarget.open)}
        >
          <summary>
            {nextLabel}
            <span className="sr-only"> · {task.kioskName}</span>
          </summary>
          {taskContent}
        </details>
      ) : (
        <div className="staff-task-body">{taskContent}</div>
      )}
      {error && <p role="alert">{error}</p>}
      {uncertain && (
        <Button type="button" variant="outline" disabled={busy} onClick={() => void refreshTask()}>
          {busy ? 'Đang kiểm tra trạng thái…' : 'Kiểm tra lại trạng thái công việc'}
        </Button>
      )}
      {notice && <p role="status">{notice}</p>}
    </article>
  );
}
