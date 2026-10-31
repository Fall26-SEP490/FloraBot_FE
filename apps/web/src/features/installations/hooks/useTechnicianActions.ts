import { useRef, useState, type RefObject } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ApiError, queryClient, request, type Session } from '@/shared/lib/api';
import type {
  EvidenceUploadResponse,
  StaffEvidenceItem,
  TechnicianInstallationDetail,
} from '../installations.types';
import { validateEvidenceFile } from '../installations.utils';
import { technicianErrorMessage } from '../technician-errors';

interface UseTechnicianActionsOptions {
  session: Session;
  jobId: string;
  onInvalidate: () => void;
  fileInputRef?: RefObject<HTMLInputElement | null>;
}

interface UploadedPhoto {
  file: File;
  attachmentId: string;
  reference: string;
  expiresAt: number;
}

export function useTechnicianActions({
  session,
  jobId,
  onInvalidate,
  fileInputRef,
}: UseTechnicianActionsOptions) {
  const [reportText, setReportText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const uploadBusy = useRef(false);
  // Retain the ticket and attachment ID when upload succeeds but attachment is interrupted.
  const uploadedPhoto = useRef<UploadedPhoto | null>(null);
  const evidencePath = `/staff/kiosk-installations/${jobId}/evidence`;

  const startMutation = useMutation({
    mutationFn: (targetJobId: string) =>
      request<TechnicianInstallationDetail>(`/staff/kiosk-installations/${targetJobId}/start`, {}),
    onSuccess: (updated) => {
      setActionSuccess(`Đã bắt đầu công việc tại điểm: ${updated.shopName}`);
      setActionError(null);
      onInvalidate();
    },
    onError: (err) => {
      setActionError(technicianErrorMessage(err, 'Chưa bắt đầu được công việc.'));
      onInvalidate();
    },
  });

  const refreshEvidence = () =>
    queryClient.invalidateQueries({
      queryKey: ['technician-installation-evidence', session.id, jobId],
    });

  const isAttached = async (id: string) => {
    const evidence = await request<StaffEvidenceItem[]>(evidencePath);
    return evidence.some((item) => item.id === id);
  };

  const handleUploadPhoto = async () => {
    if (!selectedFile || uploadBusy.current) return;
    const file = selectedFile;
    const validation = validateEvidenceFile(file);
    if (!validation.valid) {
      setUploadStatus(validation.error || 'Ảnh minh chứng không hợp lệ.');
      return;
    }

    uploadBusy.current = true;
    setUploading(true);
    setUploadStatus('Đang tải ảnh minh chứng...');
    setActionError(null);

    const complete = () => {
      setUploadStatus(`Đã tải lên và đính kèm ảnh ${file.name} thành công.`);
      setSelectedFile(null);
      uploadedPhoto.current = null;
      if (fileInputRef?.current) fileInputRef.current.value = '';
      void refreshEvidence();
    };

    try {
      let photo = uploadedPhoto.current?.file === file ? uploadedPhoto.current : null;
      // A lost POST response can still mean the photo was attached: read before retrying.
      if (photo && (await isAttached(photo.attachmentId))) {
        complete();
        return;
      }

      if (!photo || photo.expiresAt <= Date.now()) {
        const upload = () =>
          fetch(`/api${evidencePath}/upload`, {
            method: 'POST',
            credentials: 'include',
            cache: 'no-store',
            referrerPolicy: 'no-referrer',
            headers: { 'Content-Type': file.type },
            body: file,
            signal: AbortSignal.timeout(30000),
          });
        let response = await upload();
        if (response.status === 401) {
          // Reuse the shared session refresh flow before retrying the rejected binary upload.
          await request<Session>('/auth/me');
          response = await upload();
        }
        if (!response.ok) {
          const problem = (await response.json().catch(() => ({}))) as {
            detail?: string;
            message?: string;
          };
          throw new ApiError(
            response.status,
            problem.detail || problem.message || 'Chưa tải được ảnh lên máy chủ.',
          );
        }
        const ticket = (await response.json()) as EvidenceUploadResponse;
        if (typeof ticket.reference !== 'string' || !ticket.reference.startsWith('evidence:v1:')) {
          throw new Error('Máy chủ không trả về vé ảnh nghiệm thu hợp lệ. Hãy thử lại.');
        }
        photo = {
          file,
          attachmentId: crypto.randomUUID(),
          reference: ticket.reference,
          expiresAt: Date.parse(ticket.expiresAt) || 0,
        };
        uploadedPhoto.current = photo;
      }

      setUploadStatus('Đang đính kèm ảnh vào hồ sơ...');
      try {
        await request(evidencePath, { id: photo.attachmentId, reference: photo.reference });
      } catch (error) {
        // Check whether BE committed the attachment before a timeout/409/5xx response.
        const uncertain =
          !(error instanceof ApiError) || error.status === 409 || error.status >= 500;
        if (!uncertain || !(await isAttached(photo.attachmentId))) throw error;
      }
      complete();
    } catch (err) {
      setUploadStatus(technicianErrorMessage(err, 'Chưa tải được ảnh minh chứng.'));
      void refreshEvidence();
    } finally {
      uploadBusy.current = false;
      setUploading(false);
    }
  };

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
        technicianErrorMessage(
          err,
          'Chưa nộp được báo cáo. Hãy kiểm tra ảnh nghiệm thu và thử lại.',
        ),
      );
      onInvalidate();
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
