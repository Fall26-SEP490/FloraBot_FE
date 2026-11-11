import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { ApiError, queryClient, request } from '@/shared/lib/api';

export default function AssignPreorderStock({
  sellerId,
  orderId,
  slotId,
  onAssigned,
}: {
  sellerId: string;
  orderId: string;
  slotId: string;
  onAssigned: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [assigneeId, setAssigneeId] = useState('');
  const [instructions, setInstructions] = useState('Nạp bó hoa của đơn này vào ô đã chọn.');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<{
    id: string;
    assigneeId: string;
    instructions: string;
    slotId: string;
  } | null>(null);
  const staff = useQuery({
    queryKey: ['preorder-assignment-staff', sellerId],
    queryFn: () => request<{ id: string; name: string }[]>(`/sellers/${sellerId}/staff`),
    enabled: expanded,
  });

  async function assign() {
    if (!assigneeId || instructions.trim().length < 10 || busy) return;
    const payload = pending ?? {
      id: crypto.randomUUID(),
      assigneeId,
      instructions: instructions.trim(),
      slotId,
    };
    setPending(payload);
    setBusy(true);
    setError('');
    try {
      await request(`/sellers/${sellerId}/preorders/${orderId}/assignment`, payload);
      setPending(null);
      await queryClient.invalidateQueries({ queryKey: ['staff-tasks'] });
      onAssigned();
    } catch (cause) {
      if (cause instanceof ApiError && [400, 403, 404, 409].includes(cause.status)) {
        setPending(null);
      }
      setError(cause instanceof Error ? cause.message : 'Chưa xác nhận được kết quả phân công.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <details onToggle={(event) => setExpanded(event.currentTarget.open)}>
      <summary>Giao nhân viên nạp vào ô này</summary>
      <label htmlFor={`preorder-assignee-${orderId}`}>Nhân viên của shop</label>
      <select
        id={`preorder-assignee-${orderId}`}
        value={assigneeId}
        onChange={(event) => setAssigneeId(event.target.value)}
        disabled={busy || pending !== null || !staff.data}
      >
        <option value="">Chọn nhân viên</option>
        {staff.data?.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </select>
      <label htmlFor={`preorder-instructions-${orderId}`}>Hướng dẫn nạp hoa</label>
      <textarea
        id={`preorder-instructions-${orderId}`}
        value={instructions}
        maxLength={2000}
        disabled={busy || pending !== null}
        onChange={(event) => setInstructions(event.target.value)}
      />
      {staff.isError && <p role="alert">Chưa tải được nhân viên của shop.</p>}
      {error && <p role="alert">{error}</p>}
      <Button
        type="button"
        disabled={busy || !assigneeId || instructions.trim().length < 10}
        onClick={() => void assign()}
      >
        {busy ? 'Đang giao…' : 'Xác nhận giao nhân viên'}
      </Button>
    </details>
  );
}
