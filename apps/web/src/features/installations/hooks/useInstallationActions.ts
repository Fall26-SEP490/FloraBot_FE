import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ApiError, request } from '../../../api';
import type {
  KioskApplicationResponse,
  ProvisionKioskKeyResponse,
  ProvisionedKeyInfo,
} from '../installations.types';
import {
  validateConfirmNote,
  validatePlatformFailureReason,
  validateRejectReason,
  validateReworkReason,
  validateTimeWindow,
} from '../installations.utils';

interface UseInstallationActionsOptions {
  invalidateSelf: () => void;
  onShowProvisionedKey: (info: ProvisionedKeyInfo) => void;
  assignedKioskCode?: string | null;
}

export function useInstallationActions({
  invalidateSelf,
  onShowProvisionedKey,
  assignedKioskCode,
}: UseInstallationActionsOptions) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const confirmMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      request<KioskApplicationResponse>(`/operations/kiosk-applications/${id}/confirm`, { note }),
    onSuccess: (res) => {
      setActionSuccess(`Đã xác nhận liên hệ cho shop ${res.shopName}. Trạng thái: CONFIRMED.`);
      setActionError(null);
      invalidateSelf();
    },
    onError: (err) => {
      setActionError(err instanceof ApiError ? err.message : 'Chưa xác nhận được liên hệ.');
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: ({
      id,
      technicianId,
      kioskId,
      scheduledDate,
      timeWindow,
    }: {
      id: string;
      technicianId: string;
      kioskId: string;
      scheduledDate: string;
      timeWindow: string;
    }) =>
      request<KioskApplicationResponse>(`/operations/kiosk-applications/${id}/schedule`, {
        technicianId,
        kioskId,
        scheduledDate,
        timeWindow,
      }),
    onSuccess: (res) => {
      setActionSuccess(`Đã phân công KTV và lên lịch cho shop ${res.shopName}.`);
      setActionError(null);
      invalidateSelf();
    },
    onError: (err) => {
      setActionError(err instanceof ApiError ? err.message : 'Chưa lưu được lịch lắp đặt.');
    },
  });

  const handoverMutation = useMutation({
    mutationFn: (id: string) =>
      request<KioskApplicationResponse>(`/operations/kiosk-applications/${id}/handover`, {}),
    onSuccess: (res) => {
      setActionSuccess(`Đã nghiệm thu bàn giao và kích hoạt Chủ shop cho ${res.shopName}!`);
      setActionError(null);
      invalidateSelf();
    },
    onError: (err) => {
      setActionError(
        err instanceof ApiError
          ? err.message
          : 'Chưa hoàn tất bàn giao. Cần có ít nhất 1 ảnh minh chứng hợp lệ.',
      );
    },
  });

  const reworkMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      request<KioskApplicationResponse>(`/operations/kiosk-applications/${id}/rework`, { reason }),
    onSuccess: () => {
      setActionSuccess('Đã yêu cầu kỹ thuật viên kiểm tra / sửa lại.');
      setActionError(null);
      invalidateSelf();
    },
    onError: (err) => {
      setActionError(err instanceof ApiError ? err.message : 'Chưa gửi được yêu cầu sửa lại.');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      request<KioskApplicationResponse>(`/operations/kiosk-applications/${id}/reject`, { reason }),
    onSuccess: () => {
      setActionSuccess('Đã từ chối hồ sơ. Khoản thanh toán (nếu có) đã chuyển sang hoàn tiền.');
      setActionError(null);
      invalidateSelf();
    },
    onError: (err) => {
      setActionError(err instanceof ApiError ? err.message : 'Chưa từ chối được hồ sơ.');
    },
  });

  const platformFailureMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      request<KioskApplicationResponse>(`/operations/kiosk-applications/${id}/platform-failure`, {
        reason,
      }),
    onSuccess: () => {
      setActionSuccess('Đã ghi nhận sự cố bất khả kháng. Hồ sơ chuyển sang hoàn tiền.');
      setActionError(null);
      invalidateSelf();
    },
    onError: (err) => {
      setActionError(
        err instanceof ApiError ? err.message : 'Chưa xử lý được sự cố bất khả kháng.',
      );
    },
  });

  const provisionKeyMutation = useMutation({
    mutationFn: (kioskId: string) =>
      request<ProvisionKioskKeyResponse>(`/operations/kiosks/${kioskId}/provision-key`, {}),
    onSuccess: (res) => {
      onShowProvisionedKey({
        kioskId: res.kioskId,
        code: assignedKioskCode || res.kioskId.slice(0, 8),
        apiKey: res.apiKey,
      });
    },
    onError: (err) => {
      setActionError(err instanceof ApiError ? err.message : 'Chưa cấp được khóa thiết bị.');
    },
  });

  const actionPending = [
    confirmMutation,
    scheduleMutation,
    handoverMutation,
    reworkMutation,
    rejectMutation,
    platformFailureMutation,
    provisionKeyMutation,
  ].some((mutation) => mutation.isPending);

  const submitConfirm = (id: string, note: string, onDone?: () => void) => {
    const validation = validateConfirmNote(note);
    if (!validation.valid) {
      setActionError(validation.error || 'Ghi chú không hợp lệ.');
      return;
    }
    confirmMutation.mutate({ id, note: note.trim() }, { onSuccess: onDone });
  };

  const submitReject = (id: string, reason: string, onDone?: () => void) => {
    const validation = validateRejectReason(reason);
    if (!validation.valid) {
      setActionError(validation.error || 'Lý do từ chối không hợp lệ.');
      return;
    }
    rejectMutation.mutate({ id, reason: reason.trim() }, { onSuccess: onDone });
  };

  const submitSchedule = (
    id: string,
    params: { techId: string; kioskId: string; date: string; window: string },
  ) => {
    if (!params.techId) {
      setActionError('Vui lòng chọn Kỹ thuật viên.');
      return;
    }
    if (!params.kioskId) {
      setActionError('Vui lòng chọn Tủ Kiosk cấp phát.');
      return;
    }
    if (!params.date) {
      setActionError('Vui lòng chọn ngày lắp đặt.');
      return;
    }
    const validation = validateTimeWindow(params.window);
    if (!validation.valid) {
      setActionError(validation.error || 'Khung giờ không hợp lệ.');
      return;
    }
    scheduleMutation.mutate({
      id,
      technicianId: params.techId,
      kioskId: params.kioskId,
      scheduledDate: params.date,
      timeWindow: params.window.trim(),
    });
  };

  const submitRework = (id: string, reason: string, onDone?: () => void) => {
    const validation = validateReworkReason(reason);
    if (!validation.valid) {
      setActionError(validation.error || 'Lý do yêu cầu sửa lại không hợp lệ.');
      return;
    }
    reworkMutation.mutate({ id, reason: reason.trim() }, { onSuccess: onDone });
  };

  const submitPlatformFailure = (id: string, reason: string, onDone?: () => void) => {
    const validation = validatePlatformFailureReason(reason);
    if (!validation.valid) {
      setActionError(validation.error || 'Lý do sự cố bất khả kháng không hợp lệ.');
      return;
    }
    platformFailureMutation.mutate({ id, reason: reason.trim() }, { onSuccess: onDone });
  };

  return {
    actionError,
    setActionError,
    actionSuccess,
    setActionSuccess,
    actionPending,
    confirmMutation,
    scheduleMutation,
    handoverMutation,
    reworkMutation,
    rejectMutation,
    platformFailureMutation,
    provisionKeyMutation,
    submitConfirm,
    submitReject,
    submitSchedule,
    submitRework,
    submitPlatformFailure,
  };
}
