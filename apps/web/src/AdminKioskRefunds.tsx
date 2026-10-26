'use client';

import { useId, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, CircleAlert, Check, RefreshCw, Banknote, Plus, Eye, EyeOff } from '@florabot/ui';
import { ApiError, queryClient, request, type Session } from './api';
import type {
  AdminKioskRefundSummary,
  KioskRefundBankResponse,
  ConfirmKioskRefundRequest,
  EvidenceUploadResponse,
} from './kioskApplicationTypes';
import './kiosk-shared.css';
import './admin-kiosk-refunds.css';

interface AdminKioskRefundsProps {
  session: Session;
}

function RefundDetailCard({
  refund: selectedRefund,
  sessionId,
  onInvalidate,
  onCompleted,
}: {
  refund: AdminKioskRefundSummary;
  sessionId: string;
  onInvalidate: () => void;
  onCompleted: (message: string) => void;
}) {
  const [transferRef, setTransferRef] = useState('');
  const [evidenceReference, setEvidenceReference] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofStatus, setProofStatus] = useState('');
  const [revealedBank, setRevealedBank] = useState<KioskRefundBankResponse | null>(null);
  const [revealingBank, setRevealingBank] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const transferRefInputId = useId();

  // Mutation: Step 1 - Approve
  const approveMutation = useMutation({
    mutationFn: (id: string) => request(`/admin/kiosk-applications/${id}/refund/approve`, {}),
    onSuccess: () => {
      setActionSuccess(
        'Đã phê duyệt hoàn tiền (Bước 1). Quản trị viên khác sẽ thực hiện chi trả (Bước 2).',
      );
      setActionError(null);
      onInvalidate();
    },
    onError: (err) => {
      setActionError(err instanceof ApiError ? err.message : 'Chưa duyệt được yêu cầu hoàn tiền.');
    },
  });

  // Reveal full bank details for payout
  const handleRevealBank = async () => {
    setRevealingBank(true);
    setActionError(null);
    try {
      const res = await request<KioskRefundBankResponse>(
        `/admin/kiosk-applications/${selectedRefund.id}/refund/bank-details`,
        {},
      );
      setRevealedBank(res);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Chưa lấy được thông tin tài khoản.');
    } finally {
      setRevealingBank(false);
    }
  };

  // Upload proof image
  const handleUploadProof = async () => {
    if (!proofFile || uploadingProof) return;

    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(proofFile.type) ||
      proofFile.size === 0 ||
      proofFile.size > 5 * 1024 * 1024
    ) {
      setProofStatus('Vui lòng chọn ảnh PNG, JPEG hoặc WebP dưới 5 MB.');
      return;
    }

    setUploadingProof(true);
    setProofStatus('Đang tải ảnh chứng từ chuyển tiền...');
    setActionError(null);

    try {
      const res = await fetch(
        `/api/admin/kiosk-applications/${selectedRefund.id}/refund/evidence/upload`,
        {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
          referrerPolicy: 'no-referrer',
          headers: { 'Content-Type': proofFile.type },
          body: proofFile,
          signal: AbortSignal.timeout(30000),
        },
      );

      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as {
          detail?: string;
          message?: string;
        };
        throw new Error(
          errJson.detail || errJson.message || 'Lỗi khi tải ảnh chứng từ lên máy chủ.',
        );
      }

      const uploadData = (await res.json()) as EvidenceUploadResponse;
      if (
        !uploadData.reference ||
        typeof uploadData.reference !== 'string' ||
        !uploadData.reference.startsWith('evidence:v1:')
      ) {
        throw new Error('Máy chủ không trả về mã chứng từ hợp lệ (yêu cầu prefix evidence:v1:).');
      }

      setEvidenceReference(uploadData.reference);
      setProofStatus(`Đã tải ảnh chứng từ thành công: ${proofFile.name}`);
      setProofFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setProofStatus(err instanceof Error ? err.message : 'Chưa tải được chứng từ.');
    } finally {
      setUploadingProof(false);
    }
  };

  // Mutation: Step 2 - Confirm payout
  const confirmMutation = useMutation({
    mutationFn: ({
      id,
      reference,
      evidenceReference,
    }: { id: string } & ConfirmKioskRefundRequest) =>
      request(`/admin/kiosk-applications/${id}/refund/confirm`, { reference, evidenceReference }),
    onSuccess: () => {
      setActionError(null);
      setTransferRef('');
      setEvidenceReference('');
      setRevealedBank(null);
      onCompleted('Đã ghi nhận chuyển khoản hoàn tiền thành công. Hồ sơ đã rời hàng chờ chi trả.');
      onInvalidate();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        const msg = err.message.toLowerCase();
        if (
          msg.includes('người duyệt') ||
          msg.includes('approver') ||
          msg.includes('trách nhiệm')
        ) {
          setActionError(
            'Quy định đối soát hai bước: Người duyệt lệnh không được đồng thời là người xác nhận chi trả.',
          );
        } else {
          setActionError(err.message);
        }
      } else {
        setActionError(
          err instanceof ApiError ? err.message : 'Chưa xác nhận được chi trả hoàn tiền.',
        );
      }
    },
  });

  const isApproved = !!selectedRefund.refundApprovedBy;
  const isApprover = selectedRefund.refundApprovedBy === sessionId;

  return (
    <section className="operations-detail-panel" aria-labelledby="refund-action-heading">
      <div className="detail-panel-header">
        <div>
          <span className="kiosk-status-pill" data-status={selectedRefund.status}>
            {selectedRefund.status}
          </span>
          <h2 id="refund-action-heading">Xử lý hoàn tiền: {selectedRefund.shopName}</h2>
          <p className="status-meta">
            Số tiền hoàn: <strong>{Number(selectedRefund.amount).toLocaleString('vi-VN')} đ</strong>{' '}
            · Lý do: {selectedRefund.refundReason}
          </p>
        </div>
      </div>

      {actionSuccess && (
        <div role="status" className="status-notice notice-success">
          <Check size={18} aria-hidden="true" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div role="alert" className="kiosk-field-error-banner">
          <CircleAlert size={18} aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      )}

      <div className="detail-panel-content">
        <div className="refund-actions-split">
          {/* Step 1: Approve */}
          <div className="refund-step-card">
            <h3>Bước 1: Phê duyệt hoàn tiền</h3>
            <p>Quản trị viên kiểm tra lý do hủy và xác nhận tính hợp lệ của yêu cầu hoàn tiền.</p>

            {isApproved ? (
              <div className="status-notice notice-success">
                <Check size={16} aria-hidden="true" />
                <span>
                  Đã được phê duyệt bởi Quản trị viên{' '}
                  <code>{selectedRefund.refundApprovedBy?.slice(0, 8)}</code>
                </span>
              </div>
            ) : (
              <Button
                onClick={() => approveMutation.mutate(selectedRefund.id)}
                disabled={approveMutation.isPending}
              >
                <Check size={18} aria-hidden="true" />
                {approveMutation.isPending ? 'Đang duyệt...' : 'Phê duyệt hoàn tiền (Bước 1)'}
              </Button>
            )}
          </div>

          {/* Step 2: Confirm Payout */}
          <div className="refund-step-card">
            <h3>Bước 2: Chuyển khoản thực tế & Xác nhận</h3>
            <p>
              Quản trị viên thứ hai (khác người đã duyệt ở Bước 1) thực hiện chuyển tiền qua ngân
              hàng, tải ảnh ủy nhiệm chi và ghi nhận mã giao dịch.
            </p>

            {selectedRefund.status === 'REFUNDED' ? (
              <div className="status-notice notice-success">
                <Check size={16} aria-hidden="true" />
                <span>Khoản tiền đã được chi trả hoàn tất.</span>
              </div>
            ) : !isApproved ? (
              <p className="kiosk-help-text">
                Cần hoàn thành Bước 1 (Phê duyệt) trước khi có thể thực hiện chi trả.
              </p>
            ) : isApprover ? (
              <div role="alert" className="kiosk-field-error-banner">
                <CircleAlert size={18} aria-hidden="true" />
                <span>
                  Bạn là người đã phê duyệt ở Bước 1. Theo quy trình đối soát hai bước, một Quản trị
                  viên khác cần thực hiện chi trả và ghi nhận chứng từ.
                </span>
              </div>
            ) : (
              <div className="confirm-payout-form">
                {/* Bank Account Reveal Section */}
                <div className="bank-reveal-section">
                  <strong>Thông tin tài khoản nhận tiền:</strong>
                  {revealedBank ? (
                    <div className="revealed-bank-box" role="status">
                      <div>
                        <p>
                          <strong>Ngân hàng:</strong> {revealedBank.bankName}
                        </p>
                        <p>
                          <strong>Số tài khoản:</strong>{' '}
                          <code className="bank-number-revealed">{revealedBank.accountNumber}</code>
                        </p>
                        <p>
                          <strong>Chủ tài khoản:</strong> {revealedBank.holder}
                        </p>
                      </div>
                      <Button variant="outline" onClick={() => setRevealedBank(null)}>
                        <EyeOff size={16} aria-hidden="true" /> Ẩn số tài khoản
                      </Button>
                    </div>
                  ) : (
                    <div className="masked-bank-box">
                      <p>
                        {selectedRefund.bankName} - ****{selectedRefund.bankAccountSuffix} (
                        {selectedRefund.bankHolder})
                      </p>
                      <Button variant="outline" onClick={handleRevealBank} disabled={revealingBank}>
                        <Eye size={16} aria-hidden="true" />
                        {revealingBank
                          ? 'Đang truy xuất...'
                          : 'Xem số tài khoản đầy đủ để chuyển tiền'}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Upload proof receipt */}
                <div className="kiosk-form-field">
                  <label htmlFor="proof-file-input">
                    Ảnh chứng từ chuyển khoản ngân hàng (bắt buộc):
                  </label>
                  <div className="file-input-row">
                    <input
                      id="proof-file-input"
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setProofFile(file);
                        setProofStatus('');
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleUploadProof}
                      disabled={!proofFile || uploadingProof}
                    >
                      <Plus size={16} aria-hidden="true" />
                      {uploadingProof ? 'Đang tải...' : 'Tải chứng từ'}
                    </Button>
                  </div>
                  {proofStatus && <small className="kiosk-field-hint">{proofStatus}</small>}
                  {evidenceReference && (
                    <small className="kiosk-field-hint" style={{ color: '#237804' }}>
                      ✓ Đã có mã chứng từ: <code>{evidenceReference.slice(0, 24)}...</code>
                    </small>
                  )}
                </div>

                {/* Transfer Reference input */}
                <div className="kiosk-form-field">
                  <label htmlFor={transferRefInputId}>
                    Mã giao dịch ngân hàng / Mã chuẩn chi *
                  </label>
                  <input
                    id={transferRefInputId}
                    type="text"
                    value={transferRef}
                    onChange={(e) => setTransferRef(e.target.value)}
                    placeholder="Ví dụ: VCB-FT-991288319"
                    required
                  />
                </div>

                <Button
                  onClick={() => {
                    if (!transferRef.trim()) {
                      setActionError('Vui lòng nhập mã giao dịch ngân hàng.');
                      return;
                    }
                    if (!evidenceReference.trim()) {
                      setActionError(
                        'Vui lòng tải lên ảnh chứng từ chuyển tiền trước khi xác nhận.',
                      );
                      return;
                    }
                    confirmMutation.mutate({
                      id: selectedRefund.id,
                      reference: transferRef.trim(),
                      evidenceReference: evidenceReference.trim(),
                    });
                  }}
                  disabled={confirmMutation.isPending || !evidenceReference}
                >
                  <Banknote size={18} aria-hidden="true" />
                  {confirmMutation.isPending
                    ? 'Đang ghi nhận...'
                    : 'Xác nhận đã chuyển khoản (REFUNDED)'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function AdminKioskRefunds({ session }: AdminKioskRefundsProps) {
  const [selectedRefundId, setSelectedRefundId] = useState<string | null>(null);
  const [completion, setCompletion] = useState<{ actor: string; message: string } | null>(null);

  // Query: Refund queue scoped by identity
  const refundsQuery = useQuery({
    queryKey: ['admin-kiosk-refunds', session.id],
    queryFn: () => request<AdminKioskRefundSummary[]>('/admin/kiosk-applications/refunds'),
  });

  const refunds = refundsQuery.data || [];
  const selectedRefund = refunds.find((r) => r.id === selectedRefundId) || null;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-kiosk-refunds', session.id] });
  };

  return (
    <div className="admin-kiosk-refunds-view">
      <div className="dashboard-page-heading">
        <div>
          <h1>Xử lý hoàn tiền thuê Kiosk</h1>
          <p>
            Hoàn tiền cho các hồ sơ thuê kiosk bị từ chối hoặc khách hủy trước khi xác nhận. Tuân
            thủ quy trình đối soát hai bước giữa người phê duyệt và người chi trả.
          </p>
        </div>
        <span className="dashboard-context">Quản trị viên</span>
      </div>

      {completion?.actor === session.id && (
        <div role="status" className="status-notice notice-success">
          <Check size={18} aria-hidden="true" />
          <span>{completion.message}</span>
        </div>
      )}

      {/* Info Notice about Privacy & Two-Step Verification */}
      <div role="status" className="status-notice notice-info">
        <CircleAlert size={18} aria-hidden="true" />
        <div>
          <strong>Quy tắc nghiệp vụ hoàn tiền:</strong>
          <ul style={{ margin: '0.35rem 0 0 1.25rem', padding: 0 }}>
            <li>
              <strong>Bảo mật thông tin tài khoản:</strong> Số tài khoản được che, chỉ hiện phần
              đuôi để bảo vệ dữ liệu khách hàng.
            </li>
            <li>
              <strong>Quy trình đối soát hai bước:</strong> Người phê duyệt hoàn tiền và người xác
              nhận chi trả chuyển khoản phải là hai quản trị viên khác nhau.
            </li>
          </ul>
        </div>
      </div>

      <div className="queue-filter-bar">
        <span>
          Tổng số yêu cầu hoàn tiền: <strong>{refunds.length}</strong>
        </span>
        <Button
          variant="outline"
          className="refresh-btn"
          onClick={() => void refundsQuery.refetch()}
          disabled={refundsQuery.isFetching}
        >
          <RefreshCw
            className={refundsQuery.isFetching ? 'spin' : ''}
            size={16}
            aria-hidden="true"
          />
          Làm mới
        </Button>
      </div>

      {refundsQuery.isLoading && (
        <p role="status" className="kiosk-status-loading">
          <RefreshCw className="spin" size={16} aria-hidden="true" /> Đang tải danh sách hoàn
          tiền...
        </p>
      )}

      {refundsQuery.isError && (
        <div role="alert" className="kiosk-field-error-banner">
          <CircleAlert size={18} aria-hidden="true" />
          <span>Không thể tải danh sách hoàn tiền. Vui lòng thử lại.</span>
        </div>
      )}

      {refunds.length === 0 && !refundsQuery.isLoading && !refundsQuery.isError && (
        <div className="kiosk-empty-state">
          <Check size={32} aria-hidden="true" />
          <h3>Không có yêu cầu hoàn tiền nào đang chờ</h3>
          <p>Hiện không có hồ sơ thuê kiosk nào cần hoàn trả tiền.</p>
        </div>
      )}

      {refunds.length > 0 && (
        <div className="table-responsive">
          <table className="kiosk-data-table" aria-label="Danh sách hoàn tiền kiosk">
            <thead>
              <tr>
                <th scope="col">Shop & Ngày tạo</th>
                <th scope="col">Số tiền hoàn</th>
                <th scope="col">Tài khoản nhận (Masked)</th>
                <th scope="col">Lý do hoàn</th>
                <th scope="col">Tiến độ phê duyệt</th>
                <th scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {refunds.map((item) => {
                const isApproved = !!item.refundApprovedBy;
                const isSelected = selectedRefundId === item.id;

                return (
                  <tr key={item.id} className={isSelected ? 'is-selected-row' : ''}>
                    <td>
                      <strong>{item.shopName}</strong>
                      <div className="table-sub-text">
                        {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                      </div>
                    </td>
                    <td>
                      <strong className="refund-amount-text">
                        {Number(item.amount).toLocaleString('vi-VN')} đ
                      </strong>
                    </td>
                    <td>
                      <div>{item.bankName}</div>
                      <div className="table-sub-text">
                        ****{item.bankAccountSuffix} ({item.bankHolder})
                      </div>
                    </td>
                    <td>
                      <span className="refund-reason-cell" title={item.refundReason ?? undefined}>
                        {item.refundReason || '—'}
                      </span>
                    </td>
                    <td>
                      {item.status === 'REFUNDED' ? (
                        <span className="kiosk-status-pill" data-status="REFUNDED">
                          Đã chi trả
                        </span>
                      ) : isApproved ? (
                        <span className="kiosk-status-pill" data-status="APPROVED">
                          Đã duyệt (Chờ chi)
                        </span>
                      ) : (
                        <span className="kiosk-status-pill" data-status="REFUND_PENDING">
                          Chờ duyệt (Bước 1)
                        </span>
                      )}
                    </td>
                    <td>
                      <Button
                        variant={isSelected ? 'default' : 'outline'}
                        onClick={() => {
                          setSelectedRefundId(isSelected ? null : item.id);
                        }}
                      >
                        {isSelected ? 'Đóng' : 'Xử lý'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Selected Refund Action Panel with stable key */}
      {selectedRefund && (
        <RefundDetailCard
          key={`${session.id}-${selectedRefund.id}`}
          refund={selectedRefund}
          sessionId={session.id}
          onInvalidate={invalidate}
          onCompleted={(message) => {
            setCompletion({ actor: session.id, message });
            setSelectedRefundId(null);
          }}
        />
      )}
    </div>
  );
}
