import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button, CircleAlert } from '@florabot/ui';
import { ApiError, request, type Session } from '@/shared/lib/api';
import { Modal } from '../../../shared/components/Modal';
import type { EligibleKioskResponse } from '../installations.types';

interface DeleteKioskModalProps {
  kiosk: EligibleKioskResponse;
  session: Session;
  onCancel: () => void;
  onDeleted: (kiosk: EligibleKioskResponse) => Promise<void>;
  onMissing: (id: string) => Promise<void>;
}

export function DeleteKioskModal({
  kiosk,
  session,
  onCancel,
  onDeleted,
  onMissing,
}: DeleteKioskModalProps) {
  const deletion = useMutation({
    mutationFn: async () => {
      if (session.role !== 'OPERATIONS_MANAGER')
        throw new ApiError(403, 'Chỉ Quản lý vận hành được xóa kiosk.');
      await request<void>(
        `/operations/kiosks/${encodeURIComponent(kiosk.id)}`,
        undefined,
        true,
        'DELETE',
      );
    },
    onSuccess: () => onDeleted(kiosk),
    onError: (error) => {
      if (error instanceof ApiError && error.status === 404) void onMissing(kiosk.id);
    },
  });
  const close = useCallback(() => {
    if (!deletion.isPending) onCancel();
  }, [deletion.isPending, onCancel]);
  const missing = deletion.error instanceof ApiError && deletion.error.status === 404;
  const errorMessage =
    deletion.error instanceof ApiError
      ? deletion.error.status === 403
        ? 'Bạn không có quyền xóa kiosk. Thao tác này chỉ dành cho Quản lý vận hành.'
        : deletion.error.status === 401
          ? 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại trước khi xóa kiosk.'
          : missing
            ? 'Tủ không còn tồn tại. Danh sách kho đã được cập nhật; hãy quay lại kiểm tra.'
            : deletion.error.message
      : 'Chưa xác nhận được kết quả xóa. Hãy kiểm tra lại kho tủ trước khi thử lại.';

  if (session.role !== 'OPERATIONS_MANAGER') return null;
  return (
    <Modal
      open
      title="Xóa tủ khỏi kho?"
      onClose={close}
      closeDisabled={deletion.isPending}
      className="installation-modal installation-delete-modal"
      size="sm"
    >
      <div className="inventory-delete-warning">
        <CircleAlert size={23} aria-hidden="true" />
        <p>
          Tủ sẽ bị xóa khỏi hệ thống. <strong>Thao tác này không thể hoàn tác.</strong>
        </p>
      </div>
      <dl className="inventory-delete-summary">
        <div>
          <dt>Mã tủ</dt>
          <dd>{kiosk.code}</dd>
        </div>
        <div>
          <dt>Tên thiết bị</dt>
          <dd>{kiosk.name}</dd>
        </div>
        <div>
          <dt>Số ô</dt>
          <dd>{kiosk.slotCount} ô</dd>
        </div>
      </dl>
      <p className="inventory-delete-policy">
        Chỉ xóa tủ OFFLINE chưa từng kết nối, chưa được gán và chưa có dữ liệu sử dụng. Tủ có lịch
        sử sẽ được giữ lại.
      </p>
      {deletion.isError && (
        <p role="alert" className="inventory-delete-error">
          {errorMessage}
        </p>
      )}
      <div className="kiosk-modal-actions" aria-busy={deletion.isPending}>
        <Button variant="outline" onClick={close} disabled={deletion.isPending} data-autofocus>
          {missing ? 'Quay lại kho' : 'Hủy'}
        </Button>
        <Button
          className="inventory-delete-confirm"
          onClick={() => {
            if (!deletion.isPending) deletion.mutate();
          }}
          disabled={deletion.isPending || missing}
        >
          {deletion.isPending ? 'Đang xóa...' : 'Xác nhận xóa tủ'}
        </Button>
      </div>
    </Modal>
  );
}
