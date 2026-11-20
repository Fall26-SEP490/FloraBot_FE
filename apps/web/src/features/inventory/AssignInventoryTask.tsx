import { useEffect, useState } from 'react';
import { CustomSelect } from '@/shared/components/CustomSelect';
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
  visible,
  onBusy,
}: {
  sellerId: string;
  kioskId: string;
  slot: SellerSlot;
  products: { id: string; name: string }[];
  visible: boolean;
  onBusy: (busy: boolean) => void;
}) {
  const [assigneeId, setAssigneeId] = useState('');
  const [action, setAction] = useState<MaintenanceAction>(slot.bouquetId ? 'REMOVE' : 'LOAD');
  const [productId, setProductId] = useState('');
  const [instructions, setInstructions] = useState('');
  const [pending, setPending] = useState<Assignment | null>(null);
  const staff = useQuery({
    queryKey: ['preorder-assignment-staff', sellerId],
    queryFn: () => request<{ id: string; name: string }[]>(`/sellers/${sellerId}/staff`),
    enabled: visible,
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
  useEffect(() => {
    onBusy(assign.isPending);
    return () => onBusy(false);
  }, [assign.isPending, onBusy]);
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
    <section className="stock-assignment" aria-label="Giao nhân viên">
      <p className="stock-operation-note">
        Nhân viên sẽ đến tủ để thực hiện. Giao việc không mở cửa tủ ngay.
      </p>
      <div className="stock-maintenance-start">
        <div className="stock-assignment-field">
          <label htmlFor={`${prefix}-staff`}>Nhân viên</label>
          <CustomSelect
            id={`${prefix}-staff`}
            value={assigneeId}
            disabled={locked || !staff.data}
            onValueChange={setAssigneeId}
            options={[
              { value: '', label: 'Chọn nhân viên' },
              ...(staff.data ?? []).map((member) => ({ value: member.id, label: member.name })),
            ]}
          />
        </div>
        <div className="stock-assignment-field">
          <label htmlFor={`${prefix}-action`}>Thao tác</label>
          <CustomSelect
            id={`${prefix}-action`}
            value={action}
            disabled={locked}
            onValueChange={(value) => setAction(value as MaintenanceAction)}
            options={
              slot.bouquetId
                ? [
                    { value: 'REMOVE', label: 'Thu hồi hoa' },
                    { value: 'REPLACE', label: 'Thay hoa' },
                  ]
                : [{ value: 'LOAD', label: 'Nạp hoa' }]
            }
          />
        </div>
        {action !== 'REMOVE' && (
          <>
            <label htmlFor={`${prefix}-product`}>Mẫu hoa</label>
            <CustomSelect
              id={`${prefix}-product`}
              value={productId}
              disabled={locked}
              onValueChange={setProductId}
              options={[
                { value: '', label: 'Chọn mẫu hoa' },
                ...products.map((product) => ({ value: product.id, label: product.name })),
              ]}
            />
          </>
        )}
        <label htmlFor={`${prefix}-instructions`}>Hướng dẫn nhân viên</label>
        <textarea
          id={`${prefix}-instructions`}
          maxLength={500}
          placeholder="Ghi rõ việc cần làm tại ô này (từ 10 ký tự)"
          value={instructions}
          disabled={locked}
          onChange={(event) => setInstructions(event.target.value)}
        />
        {staff.isError && (
          <p role="alert">
            Chưa tải được danh sách nhân viên.{' '}
            <button type="button" onClick={() => void staff.refetch()}>
              Thử lại
            </button>
          </p>
        )}
        {staff.isSuccess && !staff.data.length && (
          <p role="status">Shop chưa có nhân viên để giao việc.</p>
        )}
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
            {assign.isPending ? 'Đang giao…' : 'Giao việc'}
          </Button>
        )}
      </div>
    </section>
  );
}
