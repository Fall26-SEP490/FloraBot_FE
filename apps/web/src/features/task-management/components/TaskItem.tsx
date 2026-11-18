import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { Button, ChevronDown, MapPin, Store } from '@florabot/ui';
import { ApiError, queryClient, request } from '@/shared/lib/api';
import StaffIncidentResolution from '../../incidents/StaffIncidentResolution';
import StaffStock, { staffStockQuery, walkInBlocker } from '../../inventory/StaffStock';
import StaffInventoryMaintenance, {
  useStaffInventoryMaintenance,
} from '../../inventory/StaffInventoryMaintenance';
import { TASK_DETAIL_STATES, TASK_STATUS_LABELS } from '../task-management.constants';
import type { ActiveTaskRole, Task } from '../task-management.types';
import StaffEvidence from './StaffEvidence';
import QualityComplaintDetails from '../../complaints/QualityComplaintDetails';
import type { QualityComplaint } from '../../complaints/quality-complaints.api';
import StaffReassignment from './StaffReassignment';
import StaffTaskDetails, { staffTaskDetailsQuery } from './StaffTaskDetails';
import TechnicianRepairAccess from './TechnicianRepairAccess';
import StaffPreorderFulfillment, {
  preorderBlocker,
  staffPreordersQuery,
} from './StaffPreorderFulfillment';

export function TaskItem({
  task,
  mode,
  actorRole: role,
  actorId,
  sellerId,
  apiBase,
  directoryEndpoint,
  canReassign,
  readOnly,
  staffOpen = false,
  onToggleStaff,
  onTransition,
  focused = false,
  hidden = false,
}: {
  task: Task;
  focused?: boolean;
  hidden?: boolean;
  mode: 'worker' | 'manager' | 'oversight';
  actorRole: ActiveTaskRole;
  actorId?: string;
  sellerId?: string | null;
  apiBase: string;
  directoryEndpoint?: string;
  canReassign: boolean;
  readOnly: boolean;
  staffOpen?: boolean;
  onToggleStaff?: () => void;
  onTransition?: (result: { id: string; kioskName: string; status: string }) => void;
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
  const qualityTask = task.workType === 'FLOWER_QUALITY';
  const [qualityEvidencePage, setQualityEvidencePage] = useState(1);
  const staffDelivery =
    isWorker && role === 'SELLER_STAFF' && !!actorId && task.kind === 'DELIVERY';
  const compactStaff = isWorker && role === 'SELLER_STAFF';
  const CardTitle = compactStaff ? 'h4' : 'h3';
  const startingDelivery = staffDelivery && task.status === 'ASSIGNED';
  const canWorkOnInventory = staffDelivery && task.status === 'IN_PROGRESS';
  const cardRef = useRef<HTMLElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  useEffect(() => {
    if (focused) cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focused]);
  useEffect(() => {
    if (!canWorkOnInventory || !cardRef.current || typeof IntersectionObserver === 'undefined')
      return;
    const observer = new IntersectionObserver(([entry]) => setNearViewport(entry.isIntersecting), {
      rootMargin: '160px',
    });
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [canWorkOnInventory]);
  const checkInventory =
    canWorkOnInventory &&
    (staffOpen || nearViewport || typeof IntersectionObserver === 'undefined');
  const quality = useQuery({
    queryKey: ['staff-quality', actorId, task.id, task.version, qualityEvidencePage],
    enabled: qualityTask && staffDelivery && staffOpen,
    queryFn: () =>
      request<QualityComplaint>(
        `/staff/tasks/${task.id}/quality?evidencePage=${qualityEvidencePage}`,
      ),
    refetchInterval: staffOpen && task.status === 'IN_PROGRESS' ? 8000 : false,
  });
  const qualityReplacement = quality.data?.replacement;
  const assignedReplacement =
    qualityReplacement && ['PLANNED', 'LOADED'].includes(qualityReplacement.state);
  const inventory = useStaffInventoryMaintenance(
    task.id,
    actorId,
    checkInventory && (!qualityTask || Boolean(assignedReplacement)),
    staffOpen,
    qualityTask && qualityReplacement
      ? `${qualityReplacement.taskId}:${qualityReplacement.state}`
      : undefined,
  );
  const checkGeneralOptions =
    !qualityTask && checkInventory && inventory.isSuccess && inventory.data === null;
  const stockPreview = useQuery({
    ...staffStockQuery(task.id, actorId, sellerId ? `seller:${sellerId}` : apiBase, apiBase),
    enabled: checkGeneralOptions,
  });
  const preorderPreview = useQuery({
    ...staffPreordersQuery(task.id, actorId),
    enabled: checkGeneralOptions,
  });
  const whyStock = stockPreview.isSuccess ? walkInBlocker(stockPreview.data) : null;
  const whyPreorder = preorderPreview.isSuccess ? preorderBlocker(preorderPreview.data) : null;
  const blocker =
    !canWorkOnInventory || staffOpen
      ? null
      : inventory.isSuccess && inventory.data?.sessionStage === 'Recovered'
        ? 'Phiên lỗi đã kết thúc. Nhờ chủ shop giao lại công việc.'
        : inventory.isSuccess && inventory.data?.sessionStage === 'NeedsInspection'
          ? `Ô ${inventory.data.slotCode} cần kiểm tra trước khi làm tiếp.`
          : inventory.isSuccess && inventory.data === null && whyStock && whyPreorder
            ? `${whyStock} ${whyPreorder}`
            : null;
  const needsRepairContext =
    isTechnician && task.kind === 'INCIDENT' && task.status === 'IN_PROGRESS';
  const showIncidentOutcome =
    task.kind === 'INCIDENT' &&
    task.status === 'COMPLETED' &&
    (role === 'OPERATIONS_MANAGER' || role === 'TECHNICIAN');
  const repairDetails = useQuery({
    ...staffTaskDetailsQuery(
      task.id,
      apiBase,
      sellerId ? `seller:${sellerId}` : apiBase,
      actorId,
      task.version,
    ),
    enabled: (needsRepairContext && taskOpen) || showIncidentOutcome,
    refetchInterval: needsRepairContext && taskOpen ? 15_000 : false,
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
    (!qualityTask || Boolean(assignedReplacement)) &&
    (inventory.isPending ||
      inventory.isError ||
      (!!inventory.data && inventory.data.sessionStage !== 'Completed'));
  const waitingForQuality =
    qualityTask &&
    staffDelivery &&
    (!quality.isSuccess ||
      (quality.data.replacement?.state === 'PLANNED' &&
        inventory.data?.sessionStage !== 'Completed'));
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
  const reviewingRemoval =
    isManager &&
    role === 'OPERATIONS_MANAGER' &&
    task.kind === 'KIOSK_REMOVAL' &&
    task.status === 'SUBMITTED';
  const choices =
    readOnly || (canCancelOpenTask && !showCancellation)
      ? []
      : isManager
        ? task.status === 'SUBMITTED'
          ? qualityTask
            ? []
            : task.kind === 'KIOSK_REMOVAL'
              ? ['IN_PROGRESS', 'CANCELLED']
              : ['COMPLETED', 'IN_PROGRESS', 'CANCELLED']
          : ['ASSIGNED', 'IN_PROGRESS'].includes(task.status)
            ? ['CANCELLED']
            : []
        : isWorker
          ? task.status === 'ASSIGNED'
            ? ['IN_PROGRESS']
            : task.status === 'IN_PROGRESS' &&
                !(isTechnician && task.kind === 'INCIDENT') &&
                !waitingForInventory &&
                !waitingForQuality
              ? ['SUBMITTED']
              : []
          : [];
  const selectedTransition = useWatch({
    control: form.control,
    name: 'status',
    defaultValue: choices[0] ?? '',
  });
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
      setNotice(
        values.status === 'COMPLETED'
          ? 'Đã xác nhận hoàn thành công việc.'
          : 'Đã cập nhật công việc.',
      );
      onTransition?.({ id: task.id, kioskName: task.kioskName, status: values.status });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['staff-tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['staff-inventory-maintenance', task.id] }),
        queryClient.invalidateQueries({ queryKey: ['assignment-incidents'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-incidents'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-incident'] }),
        queryClient.invalidateQueries({ queryKey: ['staff-detail', task.id] }),
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
    ? task.kind === 'KIOSK_REMOVAL'
      ? task.status === 'ASSIGNED'
        ? ['Đã nhận việc tháo dỡ kiosk', 'Đã có mặt tại điểm đặt để tháo dỡ kiosk'].map(
            (value) => ({ label: value, value }),
          )
        : task.status === 'IN_PROGRESS'
          ? [
              'Đã tháo dỡ, kiểm kê thiết bị và thu hồi kiosk đầy đủ',
              'Đã ngắt nguồn, tháo dỡ và bàn giao mặt bằng',
            ].map((value) => ({ label: value, value }))
          : []
      : task.status === 'ASSIGNED'
        ? ['Đã nhận việc kiểm tra sự cố tại tủ', 'Đã có mặt tại kiosk để kiểm tra sự cố'].map(
            (value) => ({ label: value, value }),
          )
        : []
    : !staffDelivery || qualityTask
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

  const transitionForm = (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) =>
        submit(compactStaff ? { ...values, status: choices[0] } : values),
      )}
      className="staff-transition-form"
    >
      {!compactStaff && (
        <>
          <div className="staff-transition-header">
            <h4>
              {canCancelOpenTask
                ? 'Hủy công việc'
                : startingDelivery
                  ? 'Bắt đầu công việc'
                  : reviewingIncident
                    ? 'Duyệt báo cáo sự cố'
                    : 'Cập nhật tiến độ & Báo cáo'}
            </h4>
            <p>
              {canCancelOpenTask
                ? 'Nhập lý do hủy để nhân viên biết.'
                : isTechnician
                  ? task.kind === 'KIOSK_REMOVAL'
                    ? 'Chọn bước tiếp theo và nhập báo cáo tháo dỡ (hoặc đính kèm ảnh minh chứng) để quản lý xác nhận bàn giao.'
                    : 'Chọn bước tiếp theo và nhập nội dung để quản lý theo dõi xử lý sự cố.'
                  : 'Chọn bước tiếp theo và nhập nội dung cập nhật.'}
            </p>
          </div>
          <div className="staff-form-group">
            <label htmlFor={`action-${task.id}`}>
              {reviewingIncident ? 'Kết quả xét duyệt' : 'Bước tiếp theo'}
            </label>
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
        </>
      )}
      <div className="staff-form-group">
        <label htmlFor={`report-${task.id}`}>
          {compactStaff
            ? startingDelivery
              ? 'Ghi chú khi bắt đầu'
              : 'Kết quả công việc'
            : canCancelOpenTask
              ? 'Lý do hủy'
              : 'Nội dung cập nhật'}
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
                  onClick={() => form.setValue('report', template.value, { shouldValidate: true })}
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
                  : reviewingIncident
                    ? selectedTransition === 'COMPLETED'
                      ? 'Xác nhận hoàn thành'
                      : selectedTransition === 'IN_PROGRESS'
                        ? 'Yêu cầu kiểm tra lại'
                        : 'Xác nhận hủy'
                    : 'Xác nhận cập nhật'}
      </Button>
    </form>
  );

  const assignmentAdjustments = (
    <>
      {canReassign &&
        task.kind !== 'KIOSK_REMOVAL' &&
        ['ASSIGNED', 'IN_PROGRESS'].includes(task.status) && (
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
          {isManager && role === 'OPERATIONS_MANAGER' && (
            <p>
              Bổ sung yêu cầu kiểm tra cho kỹ thuật viên đang phụ trách; không tạo công việc mới.
            </p>
          )}
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
    </>
  );
  const taskContent = (
    <>
      {qualityTask && staffDelivery && (
        <div className="staff-stocking-section">
          <h4>Xử lý chất lượng hoa</h4>
          {quality.isPending ? (
            <p role="status">Đang tải phản ánh liên quan…</p>
          ) : quality.isError ? (
            <>
              <p role="alert">Chưa tải được phản ánh của công việc.</p>
              <Button variant="outline" onClick={() => void quality.refetch()}>
                Tải lại phản ánh
              </Button>
            </>
          ) : (
            <QualityComplaintDetails
              detail={quality.data}
              scope="staff"
              onPage={setQualityEvidencePage}
            />
          )}
        </div>
      )}
      {qualityTask && role === 'SELLER' && (
        <p>
          Duyệt hoặc trả báo cáo ở <a href="/seller/complaints">Phản ánh chất lượng</a>.
        </p>
      )}
      {canWorkOnInventory && actorId && (!qualityTask || inventory.data || inventory.isError) && (
        <div className="staff-stocking-section">
          <div className="staff-stocking-header">
            <h4>Thao tác tại tủ</h4>
          </div>
          {inventory.isPending && <p role="status">Đang tải thao tác được giao…</p>}
          {inventory.data && (
            <StaffInventoryMaintenance
              taskId={task.id}
              scope={inventory.data}
              useKioskCode={qualityTask}
            />
          )}
          {inventory.isError && (
            <p role="alert">
              Chưa tải được thao tác được giao
              {inventory.error instanceof ApiError ? ` (HTTP ${inventory.error.status})` : ''}.{' '}
              <Button type="button" variant="outline" onClick={() => void inventory.refetch()}>
                Tải lại
              </Button>
            </p>
          )}
          {!qualityTask && inventory.data === null && (
            <StaffStock
              taskId={task.id}
              actorId={actorId}
              sellerId={sellerId}
              role={role}
              active={task.status === 'IN_PROGRESS'}
              apiBase={apiBase}
            />
          )}
          {!qualityTask && inventory.data === null && (
            <StaffPreorderFulfillment taskId={task.id} actorId={actorId} active />
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
      {choices.length > 0 &&
        !needsRepairContext &&
        (compactStaff && canWorkOnInventory ? (
          <details className="staff-report-disclosure">
            <summary>
              Viết báo cáo <ChevronDown size={16} aria-hidden="true" />
            </summary>
            {transitionForm}
          </details>
        ) : (
          transitionForm
        ))}
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
          taskStatus={task.status}
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
        {isManager && role === 'OPERATIONS_MANAGER'
          ? (canEditInstructions ||
              (canReassign &&
                task.kind !== 'KIOSK_REMOVAL' &&
                ['ASSIGNED', 'IN_PROGRESS'].includes(task.status))) && (
              <details className="manager-task-adjustments">
                <summary>Điều chỉnh phân công</summary>
                <p className="manager-adjustments-hint">
                  Chỉ dùng khi cần đổi kỹ thuật viên hoặc bổ sung hướng dẫn cho công việc này.
                </p>
                {assignmentAdjustments}
              </details>
            )
          : assignmentAdjustments}
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
            blockedReason={
              slotRepair &&
              repairDetails.data?.slotStatus &&
              repairDetails.data.slotStatus !== 'FAULT'
                ? repairDetails.data.slotStatus === 'LOCKED'
                  ? `Ô ${repairDetails.data.slotCode || ''} đang khóa và chưa đủ điều kiện cấp quyền mở sửa. Nhờ Quản lý vận hành kiểm tra phiên thao tác và lệnh mở trước khi tiếp tục. Bạn có thể bổ sung ảnh hiện trường; không cần tạo phiếu trùng hoặc chờ thêm chỉ để gửi báo cáo.`
                  : `Ô ${repairDetails.data.slotCode || ''} hiện ở trạng thái ${repairDetails.data.slotStatus === 'RENTED_EMPTY' ? 'ô trống' : repairDetails.data.slotStatus}. Phiếu sự cố vẫn đang xử lý nên công việc chưa đủ điều kiện nộp báo cáo hoàn tất theo luồng sửa ô. Nhờ Quản lý vận hành xác minh kết quả khôi phục và phối hợp bộ phận hỗ trợ để khép phiếu phù hợp. Trạng thái ô không tự chứng minh sự cố đã được sửa.`
                : undefined
            }
            onRefresh={refreshTask}
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
      {reviewingRemoval && (
        <p>
          Kỹ thuật viên đã gửi báo cáo tháo dỡ. Để xác nhận hoàn tất bàn giao và giải phóng hợp đồng
          thuê, hãy thực hiện tại <a href="/operations/terminations">Hồ sơ chấm dứt thuê kiosk</a>{' '}
          (hoặc chọn Yêu cầu kiểm tra lại ở trên nếu cần làm lại).
        </p>
      )}
    </>
  );
  const taskDestination = (
    <div className={`staff-task-destination-card${isTechnician ? 'technician-destination' : ''}`}>
      <p className="staff-destination-address">
        <MapPin size={15} aria-hidden="true" />
        <span className="staff-destination-text">
          <span>{task.address}</span>
          {isTechnician && task.address && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(task.address)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Chỉ đường Google Maps
            </a>
          )}
          {task.shopName && !compactStaff ? (
            <span className="staff-destination-shop">{task.shopName}</span>
          ) : null}
        </span>
      </p>
      {task.instructions && (
        <div
          className="staff-instructions-callout"
          data-preview={compactStaff && !staffOpen ? 'true' : undefined}
        >
          <div className="staff-instructions-head">
            <Store size={14} aria-hidden="true" />
            <strong>
              {task.kind === 'INCIDENT' || task.kind === 'KIOSK_REMOVAL'
                ? 'Hướng dẫn từ quản lý:'
                : 'Ghi chú từ shop:'}
            </strong>
          </div>
          <p>{task.instructions}</p>
        </div>
      )}
      {blocker && (
        <p className="staff-task-blocker">
          <strong>Chưa thể thao tác:</strong> {blocker}
        </p>
      )}
    </div>
  );
  const taskDetails = (
    <>
      {!isTechnician && taskDestination}
      {compactStaff ? (
        <>
          <Button
            type="button"
            variant={
              !staffOpen && (task.status === 'ASSIGNED' || task.status === 'IN_PROGRESS')
                ? 'default'
                : 'outline'
            }
            className="staff-task-open"
            aria-expanded={staffOpen}
            aria-controls={`staff-body-${task.id}`}
            onClick={onToggleStaff}
          >
            {staffOpen ? 'Thu gọn' : startingDelivery ? 'Mở công việc' : nextLabel}
            <ChevronDown size={16} aria-hidden="true" />
          </Button>
          <div id={`staff-body-${task.id}`} className="staff-task-body" hidden={!staffOpen}>
            {taskContent}
          </div>
        </>
      ) : isTechnician ? (
        <details
          className="technician-task-body"
          onToggle={(event) => setTaskOpen(event.currentTarget.open)}
        >
          <summary>
            {nextLabel}
            <span className="sr-only"> · {task.kioskName}</span>
          </summary>
          <p className="technician-next-step">
            {task.status === 'ASSIGNED'
              ? 'Bắt đầu xử lý để cập nhật tiến độ và gửi minh chứng.'
              : task.status === 'IN_PROGRESS'
                ? 'Kiểm tra tại tủ, lưu minh chứng rồi gửi báo cáo.'
                : task.status === 'SUBMITTED'
                  ? 'Đã gửi báo cáo. Chờ Manager kiểm tra kết quả.'
                  : task.status === 'COMPLETED'
                    ? 'Manager đã xác nhận hoàn thành công việc.'
                    : 'Công việc đã được hủy.'}
          </p>
          {taskDestination}
          {taskContent}
        </details>
      ) : (
        <div className="staff-task-body">{taskContent}</div>
      )}
    </>
  );
  return (
    <article
      ref={cardRef}
      hidden={hidden}
      className={
        compactStaff ? 'staff-task-card staff-task-compact' : 'staff-task-card member-empty'
      }
      aria-labelledby={`task-${task.id}`}
      data-focused={focused || undefined}
    >
      <div className="staff-task-heading">
        <div>
          <CardTitle id={`task-${task.id}`}>
            {task.kind === 'INCIDENT'
              ? 'Kiểm tra sự cố'
              : task.kind === 'KIOSK_REMOVAL'
                ? 'Tháo dỡ kiosk'
                : qualityTask
                  ? 'Xử lý chất lượng hoa'
                  : 'Giao hoa'}{' '}
            · {task.kioskName}
          </CardTitle>
          {!isTechnician && !compactStaff && (
            <p className="staff-assignee-text">Người thực hiện: {task.assigneeName}</p>
          )}
        </div>
        <span className="staff-task-label" data-status={task.status}>
          {TASK_STATUS_LABELS[task.status] || task.status}
        </span>
      </div>
      {showIncidentOutcome && (
        <p className="manager-incident-outcome" role="status">
          {repairDetails.data?.incident
            ? `Sự cố: ${TASK_DETAIL_STATES[repairDetails.data.incident.status] || repairDetails.data.incident.status}`
            : repairDetails.isError
              ? 'Chưa tải được trạng thái sự cố.'
              : repairDetails.isPending
                ? 'Đang kiểm tra trạng thái sự cố…'
                : 'Chưa có thông tin trạng thái sự cố.'}
        </p>
      )}
      {(isManager && role === 'OPERATIONS_MANAGER') || (role === 'ADMIN' && readOnly) ? (
        <details className="manager-task-details" open={focused || undefined}>
          <summary>
            {role === 'ADMIN'
              ? 'Xem báo cáo & tiến độ'
              : task.status === 'SUBMITTED'
                ? 'Kiểm tra báo cáo'
                : 'Xem chi tiết công việc'}
            <ChevronDown size={16} aria-hidden="true" />
          </summary>
          {taskDetails}
        </details>
      ) : (
        taskDetails
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
