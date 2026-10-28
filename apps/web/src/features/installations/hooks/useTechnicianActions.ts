import { useState, type RefObject } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ApiError, queryClient, request, type Session } from '@/shared/lib/api';
import type { EvidenceUploadResponse, TechnicianInstallationDetail } from '../installations.types';
import { validateEvidenceFile } from '../installations.utils';

interface UseTechnicianActionsOptions {
  session: Session;
  jobId: string;
  onInvalidate: () => void;
  fileInputRef?: RefObject<HTMLInputElement | null>;
}

export function useTechnicianActions({
  session,
  jobId,
  onInvalidate,
  fileInputRef,
}: UseTechnicianActionsOptions) {
  const [reportText, setReportText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [currentAttachmentId, setCurrentAttachmentId] = useState<string>(() => crypto.randomUUID());
  const [uploadStatus, setUploadStatus] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Start visit mutation
  const startMutation = useMutation({
    mutationFn: (targetJobId: string) =>
      request<TechnicianInstallationDetail>(`/staff/kiosk-installations/${targetJobId}/start`, {}),
    onSuccess: (updated) => {
      setActionSuccess(`Đã bắt đầu công việc tại điểm: ${updated.shopName}`);
      setActionError(null);
      onInvalidate();
    },
    onError: (err) => {
      setActionError(err instanceof ApiError ? err.message : 'Chưa bắt đầu được công việc.');
    },
  });

  // Upload & attach photo evidence
  const handleUploadPhoto = async () => {
    if (!selectedFile || uploading) return;

    const validation = validateEvidenceFile(selectedFile);
    if (!validation.valid) {
      setUploadStatus(
        validation.error || 'Vui lòng chọn file ảnh PNG, JPEG hoặc WebP với dung lượng dưới 5 MB.',
      );
      return;
    }

    setUploading(true);
    setUploadStatus('Đang tải ảnh minh chứng...');
    setActionError(null);

    try {
      // Step 1: Upload binary photo using secure patterns (no-store, no-referrer, abort timeout)
      const uploadRes = await fetch(`/api/staff/kiosk-installations/${jobId}/evidence/upload`, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': selectedFile.type },
        body: selectedFile,
        signal: AbortSignal.timeout(30000),
      });

      if (!uploadRes.ok) {
        const errJson = (await uploadRes.json().catch(() => ({}))) as {
          detail?: string;
          message?: string;
        };
        throw new Error(errJson.detail || errJson.message || 'Lỗi khi tải ảnh lên máy chủ.');
      }

      const uploadData = (await uploadRes.json()) as EvidenceUploadResponse;
      if (
        !uploadData.reference ||
        typeof uploadData.reference !== 'string' ||
        !uploadData.reference.startsWith('evidence:v1:')
      ) {
        throw new Error(
          'Máy chủ không trả về mã vé minh chứng hợp lệ (yêu cầu prefix evidence:v1:).',
        );
      }

      const evidenceTicket = uploadData.reference;

      // Step 2: Attach ticket to installation using stable attachment ID (retry preserves ID)
      await request(`/staff/kiosk-installations/${jobId}/evidence`, {
        id: currentAttachmentId,
        reference: evidenceTicket,
      });

      // Clear ticket and generate a NEW UUID only after successful attachment!
      setUploadStatus(`Đã tải lên và đính kèm ảnh ${selectedFile.name} thành công.`);
      setSelectedFile(null);
      setCurrentAttachmentId(crypto.randomUUID());
      if (fileInputRef?.current) fileInputRef.current.value = '';
      void queryClient.invalidateQueries({
        queryKey: ['technician-installation-evidence', session.id, jobId],
      });
    } catch (err) {
      setUploadStatus(err instanceof Error ? err.message : 'Chưa tải được ảnh minh chứng.');
    } finally {
      setUploading(false);
    }
  };

  // Submit report mutation
  const submitReportMutation = useMutation({
    mutationFn: ({ jobId: targetJobId, report }: { jobId: string; report: string }) =>
      request<TechnicianInstallationDetail>(`/staff/kiosk-installations/${targetJobId}/submit`, {
        report,
      }),
    onSuccess: (updated) => {
      setActionSuccess(
        `Đã nộp báo cáo lắp đặt cho ${updated.shopName}. Hồ sơ chuyển sang Chờ nghiệm thu.`,
      );
      setActionError(null);
      setReportText('');
      onInvalidate();
    },
    onError: (err) => {
      setActionError(
        err instanceof ApiError
          ? err.message
          : 'Chưa nộp được báo cáo. Bạn cần tải lên ít nhất 1 ảnh minh chứng trước khi nộp.',
      );
    },
  });

  return {
    reportText,
    setReportText,
    selectedFile,
    setSelectedFile,
    uploadStatus,
    setUploadStatus,
    actionError,
    setActionError,
    actionSuccess,
    setActionSuccess,
    uploading,
    startMutation,
    handleUploadPhoto,
    submitReportMutation,
  };
}
