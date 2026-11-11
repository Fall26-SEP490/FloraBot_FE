import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { ApiError, queryClient, request } from '@/shared/lib/api';
import type { MaintenanceAction } from './SlotMaintenance';
import type { SellerSlot } from './slot-state';

type Assignment = {
  id: string;
  assigneeId: string;
  kioskId: string;
  slotId: string;
  action: MaintenanceAction;
  expectedBouquetId: string | null;
  productId: string | null;
  instructions: string;
};

export default function AssignInventoryTask({
  sellerId,
  kioskId,
  slot,
  products,
}: {
  sellerId: string;
  kioskId: string;
  slot: SellerSlot;
  products: { id: string; name: string }[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [assigneeId, setAssigneeId] = useState('');
  const [action, setAction] = useState<MaintenanceAction>(slot.bouquetId ? 'REMOVE' : 'LOAD');
  const [productId, setProductId] = useState('');
  const [instructions, setInstructions] = useState('');
  const [pending, setPending] = useState<Assignment | null>(null);
  const staff = useQuery({
    queryKey: ['preorder-assignment-staff', sellerId],
    queryFn: () => request<{ id: string; name: string }[]>(`/sellers/${sellerId}/staff`),
    enabled: expanded,
  });
  const assign = useMutation({
    mutationFn: (payload: Assignment) => request('/me/inventory-tasks', payload),
    onSuccess: () => {
      setPending(null);
      void queryClient.invalidateQueries({ queryKey: ['staff-tasks'] });
    },
    onError: (error) => {
      if (error instanceof ApiError && [400, 403, 404, 409].includes(error.status)) {
        setPending(null);
      }
    },
  });
  const locked = !!pending || assign.isSuccess;
  const prefix = `inventory-assign-${slot.id}`;
  function assignTask() {
    if (assign.isPending) return;
    const payload = pending ?? {
      id: crypto.randomUUID(),
      assigneeId,
      kioskId,
      slotId: slot.id,
      action,
      expectedBouquetId: slot.bouquetId || null,
      productId: action === 'REMOVE' ? null : productId,
      instructions: instructions.trim(),
    };
    setPending(payload);
    assign.mutate(payload);
  }
  return (
    <details
      className="stock-maintenance"
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>Giao nhân viên thao tác ô {slot.slotCode}</summary>
      <div className="stock-maintenance-start">
        <label htmlFor={`${prefix}-staff`}>Nhân viên</label>
        <select
          id={`${prefix}-staff`}
          value={assigneeId}
          disabled={locked || !staff.data}
          onChange={(event) => setAssigneeId(event.target.value)}
        >
          <option value="">Chọn nhân viên</option>
          {staff.data?.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
        <label htmlFor={`${prefix}-action`}>Thao tác</label>
        <select
          id={`${prefix}-action`}
          value={action}
          disabled={locked}
          onChange={(event) => setAction(event.target.value as MaintenanceAction)}
        >
          {slot.bouquetId ? (
            <>
              <option value="REMOVE">Thu hồi hoa</option>
              <option value="REPLACE">Thay hoa</option>
            </>
          ) : (
            <option value="LOAD">Nạp hoa</option>
          )}
        </select>
        {action !== 'REMOVE' && (
          <>
            <label htmlFor={`${prefix}-product`}>Mẫu hoa</label>
            <select
              id={`${prefix}-product`}
              value={productId}
              disabled={locked}
              onChange={(event) => setProductId(event.target.value)}
            >
              <option value="">Chọn mẫu hoa</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </>
        )}
        <label htmlFor={`${prefix}-instructions`}>Hướng dẫn (ít nhất 10 ký tự)</label>
        <textarea
          id={`${prefix}-instructions`}
          maxLength={500}
          value={instructions}
          disabled={locked}
          onChange={(event) => setInstructions(event.target.value)}
        />
        {staff.isError && <p role="alert">Chưa tải được danh sách nhân viên.</p>}
        {assign.error && <p role="alert">{assign.error.message}</p>}
        {assign.isSuccess ? (
          <p role="status">Đã giao công việc cho nhân viên.</p>
        ) : (
          <Button
            type="button"
            disabled={
              assign.isPending ||
              !assigneeId ||
              instructions.trim().length < 10 ||
              (action !== 'REMOVE' && !productId)
            }
            onClick={assignTask}
          >
            {assign.isPending ? 'Đang giao…' : 'Xác nhận giao nhân viên'}
          </Button>
        )}
      </div>
    </details>
  );
}
