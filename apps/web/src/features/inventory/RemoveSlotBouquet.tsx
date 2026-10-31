import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { ApiError, queryClient, request } from '@/shared/lib/api';
import type { SellerSlot } from './slot-state';

export default function RemoveSlotBouquet({
  kioskId,
  slot,
}: {
  kioskId: string;
  slot: SellerSlot;
}) {
  const [physicallyRemoved, setPhysicallyRemoved] = useState(false);
  const [reason, setReason] = useState('');
  const sending = useRef(false);
  const mutation = useMutation({
    mutationFn: () => {
      if (!slot.bouquetId) {
        throw new Error('Ô hiện không có mã bó hoa để thu hồi. Hãy tải lại dữ liệu.');
      }
      return request<void>(
        `/me/kiosks/${kioskId}/slots/${slot.id}/bouquet`,
        { bouquetId: slot.bouquetId, reason: reason.trim(), confirmedRemoved: physicallyRemoved },
        true,
        'DELETE',
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['seller-kiosk-slots'] }),
  });

  const eligible = !!slot.bouquetId && ['STOCKED', 'PENDING_REMOVAL'].includes(slot.status);
  const orderHold = slot.bouquetStatus === 'HELD' || slot.orderStatus === 'AWAITING_PAYMENT';
  let errorMessage = '';
  if (mutation.error instanceof ApiError && mutation.error.status === 404) {
    errorMessage =
      'API thu hồi chưa được triển khai trên máy chủ này. Cần cập nhật BE có endpoint mới.';
  } else if (mutation.error instanceof ApiError && mutation.error.status === 400) {
    errorMessage = 'Máy chủ từ chối thông tin thu hồi. Tải lại dữ liệu ô rồi thử lại.';
  } else if (mutation.error instanceof Error) {
    errorMessage = mutation.error.message;
  }

  if (!eligible && !mutation.isSuccess) return null;

  if (mutation.isSuccess) {
    return (
      <p role="status">Đã ghi nhận thu hồi hoa. Ô đã được làm trống và giữ nguyên hình thức bán.</p>
    );
  }

  return (
    <section className="stock-remove-bouquet" aria-labelledby={`remove-bouquet-${slot.id}`}>
      <h4 id={`remove-bouquet-${slot.id}`}>Thu hồi hoa khỏi ô {slot.slotCode}</h4>
      <p>
        Chỉ xác nhận sau khi đã lấy bó hoa thực tế khỏi ô. Hệ thống sẽ ghi lịch sử thu hồi và giữ
        nguyên vùng bán của ô. Đơn hàng và thông tin hoàn tiền liên quan vẫn được bảo toàn.
      </p>
      {orderHold ? (
        <p role="status">Không thể thu hồi lúc này vì bó hoa đang được giữ cho một đơn hàng.</p>
      ) : (
        <>
          <label>
            <input
              type="checkbox"
              checked={physicallyRemoved}
              onChange={(event) => setPhysicallyRemoved(event.target.checked)}
              disabled={mutation.isPending}
            />{' '}
            Tôi đã lấy hoa thực tế khỏi ô này.
          </label>
          <label htmlFor={`remove-reason-${slot.id}`}>Lý do thu hồi</label>
          <textarea
            id={`remove-reason-${slot.id}`}
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Nhập lý do, tối thiểu 5 ký tự"
            disabled={mutation.isPending}
          />
          {errorMessage && <p role="alert">{errorMessage}</p>}
          <Button
            type="button"
            variant="outline"
            disabled={!physicallyRemoved || reason.trim().length < 5 || mutation.isPending}
            onClick={() => {
              if (sending.current || !physicallyRemoved) return;
              sending.current = true;
              mutation.mutate(undefined, {
                onSettled: () => {
                  sending.current = false;
                },
              });
            }}
          >
            {mutation.isPending ? 'Đang ghi nhận…' : 'Xác nhận đã lấy hoa khỏi ô'}
          </Button>
          {mutation.error instanceof ApiError && mutation.error.status === 409 && (
            <p role="note">
              Ô đang được sử dụng hoặc có thao tác tủ chưa hoàn tất. Hãy tải lại trạng thái ô.
            </p>
          )}
        </>
      )}
    </section>
  );
}
