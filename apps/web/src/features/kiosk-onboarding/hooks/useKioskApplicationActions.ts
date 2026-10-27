import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { ApiError, queryClient, request, type Session } from '../../../api';
import type {
  CreateKioskApplicationRequest,
  KioskApplicationResponse,
  PaymentLinkResponse,
} from '../../installations/installations.types';
import { KIOSK_STATUS_LABELS } from '../../installations/installations.constants';
import { validatePayosCheckoutUrl } from '../../installations/installations.utils';

export function useKioskApplicationActions(sessionData: Session | undefined) {
  const router = useRouter();

  const [submitError, setSubmitError] = useState('');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');

  // Payment link state (fail-closed, no auto fallback navigation)
  const [validatedCheckoutUrl, setValidatedCheckoutUrl] = useState<string | null>(null);
  const [paymentLinkError, setPaymentLinkError] = useState('');
  const [reconcileNotice, setReconcileNotice] = useState('');
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshingSession, setRefreshingSession] = useState(false);

  const errorBannerRef = useRef<HTMLDivElement>(null);

  // Submit application mutation
  const applyMutation = useMutation({
    mutationFn: (data: CreateKioskApplicationRequest) =>
      request<KioskApplicationResponse>('/member/kiosk-applications', data),
    onSuccess: (created) => {
      setSubmitError('');
      queryClient.setQueryData(['current-kiosk-application', sessionData?.id], created);
      void queryClient.invalidateQueries({
        queryKey: ['current-kiosk-application', sessionData?.id],
      });
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setSubmitError(
            'Bạn đã có một hồ sơ thuê kiosk đang được xử lý hoặc tài khoản đã là Chủ shop.',
          );
        } else {
          setSubmitError(err.message);
        }
      } else {
        setSubmitError(
          'Không thể gửi hồ sơ lúc này. Dữ liệu đã nhập được giữ nguyên, vui lòng thử lại.',
        );
      }
      errorBannerRef.current?.focus();
    },
  });

  // Get payment link mutation (fail-closed security validation)
  const paymentLinkMutation = useMutation({
    mutationFn: (applicationId: string) =>
      request<PaymentLinkResponse>(`/member/kiosk-applications/${applicationId}/payment-link`, {}),
    onSuccess: (data) => {
      setPaymentLinkError('');
      const validation = validatePayosCheckoutUrl(data.checkoutUrl);
      if (validation.valid && validation.url) {
        setValidatedCheckoutUrl(validation.url);
      } else {
        setValidatedCheckoutUrl(null);
        setPaymentLinkError(
          validation.error || 'Địa chỉ thanh toán payOS không thuộc máy chủ được cấp phép.',
        );
      }
    },
    onError: (err) => {
      setValidatedCheckoutUrl(null);
      if (err instanceof ApiError) {
        if (err.status === 503) {
          setPaymentLinkError(
            'Cổng thanh toán payOS đang bảo trì hoặc chưa được cấu hình (mã 503). Vui lòng thử lại sau hoặc liên hệ hỗ trợ.',
          );
        } else if (err.status === 502) {
          setPaymentLinkError(
            'Không kết nối được với cổng thanh toán payOS (mã 502). Vui lòng thử lại sau ít phút.',
          );
        } else {
          setPaymentLinkError(err.message);
        }
      } else {
        setPaymentLinkError('Lỗi kết nối khi tạo liên kết thanh toán. Vui lòng thử lại.');
      }
    },
  });

  // Reconcile payment mutation (dynamic status message)
  const reconcileMutation = useMutation({
    mutationFn: (applicationId: string) =>
      request<KioskApplicationResponse>(
        `/member/kiosk-applications/${applicationId}/reconcile`,
        {},
      ),
    onSuccess: (updated) => {
      const status = updated.status;
      if (status === 'PAID_REVIEW') {
        setReconcileNotice(
          'Đã xác nhận thanh toán thành công qua cổng thanh toán! Hồ sơ đã chuyển sang Chờ xem xét.',
        );
      } else if (status === 'REFUND_PENDING') {
        setReconcileNotice(
          'Giao dịch thanh toán đến muộn sau khi hồ sơ đã hủy. Khoản phí đã được chuyển sang quy trình hoàn tiền.',
        );
      } else {
        setReconcileNotice(
          `Trạng thái hồ sơ sau đối soát: ${KIOSK_STATUS_LABELS[status] || status}.`,
        );
      }
      queryClient.setQueryData(['current-kiosk-application', sessionData?.id], updated);
      void queryClient.invalidateQueries({
        queryKey: ['current-kiosk-application', sessionData?.id],
      });
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setReconcileNotice(
            'Giao dịch chưa hoàn tất trên cổng thanh toán hoặc đã được xử lý trước đó.',
          );
        } else {
          setReconcileNotice(err.message);
        }
      } else {
        setReconcileNotice('Chưa đối soát được giao dịch máy chủ. Vui lòng thử lại.');
      }
    },
  });

  // Cancel application mutation
  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      request<KioskApplicationResponse>(`/member/kiosk-applications/${id}/cancel`, { reason }),
    onSuccess: (updated) => {
      setCancelDialogOpen(false);
      setCancelReason('');
      setCancelError('');
      queryClient.setQueryData(['current-kiosk-application', sessionData?.id], updated);
      void queryClient.invalidateQueries({
        queryKey: ['current-kiosk-application', sessionData?.id],
      });
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setCancelError(err.message);
      } else {
        setCancelError('Chưa hủy được hồ sơ. Vui lòng thử lại.');
      }
    },
  });

  // Handover refresh session: POST /auth/refresh then GET /auth/me, require SELLER + sellerId
  const handleActiveSessionRefresh = async () => {
    setRefreshingSession(true);
    setRefreshError(null);
    try {
      const refreshRes = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        signal: AbortSignal.timeout(15000),
      });
      if (!refreshRes.ok) {
        throw new Error('Không thể làm mới phiên làm việc.');
      }
      const me = await request<Session>('/auth/me');
      if (me.role === 'SELLER' && me.sellerId) {
        queryClient.clear();
        queryClient.setQueryData(['session'], me);
        router.push('/seller/products');
      } else {
        setRefreshError(
          'Hệ thống chưa ghi nhận quyền Chủ shop trên máy chủ. Bạn vui lòng đăng nhập lại để cập nhật phiên làm việc.',
        );
      }
    } catch {
      setRefreshError(
        'Không thể làm mới phiên đăng nhập tự động. Vui lòng đăng nhập lại để truy cập không gian Chủ shop.',
      );
    } finally {
      setRefreshingSession(false);
    }
  };

  return {
    submitError,
    errorBannerRef,
    cancelDialogOpen,
    setCancelDialogOpen,
    cancelReason,
    setCancelReason,
    cancelError,
    setCancelError,
    validatedCheckoutUrl,
    paymentLinkError,
    reconcileNotice,
    refreshError,
    refreshingSession,
    applyMutation,
    paymentLinkMutation,
    reconcileMutation,
    cancelMutation,
    handleActiveSessionRefresh,
  };
}
