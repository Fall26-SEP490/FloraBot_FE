import { request } from '../../api';
import type {
  AdminKioskRefundSummary,
  AdminRefundDetail,
  AdminRefundPage,
  AdminWithdrawalDetail,
  AdminWithdrawalPage,
  ConfirmKioskRefundRequest,
  DailyReconciliationResult,
  GatewayReconciliationResult,
  IncidentEvidenceResponse,
  KioskRefundBankResponse,
  RefundBankResponse,
  SellerBankResponse,
  Statement,
  WalletResponse,
  WithdrawalBankResponse,
} from './finance.types';

// Admin Refunds
export async function fetchAdminRefunds(status: string, page: number): Promise<AdminRefundPage> {
  return request<AdminRefundPage>(`/admin/refunds?status=${status}&page=${page}`);
}

export async function fetchAdminRefundDetail(id: string): Promise<AdminRefundDetail> {
  return request<AdminRefundDetail>(`/admin/refunds/${id}`);
}

export async function revealRefundBank(id: string): Promise<RefundBankResponse> {
  return request<RefundBankResponse>(`/admin/refunds/${id}/bank`);
}

export async function approveRefund(id: string): Promise<void> {
  return request(`/admin/refunds/${id}/approve`, {});
}

export async function confirmRefundPayout(id: string, payload: { proof: string }): Promise<void> {
  return request(`/admin/refunds/${id}/pay`, payload);
}

// Admin Withdrawals
export async function fetchAdminWithdrawals(
  status: string,
  page: number,
): Promise<AdminWithdrawalPage> {
  return request<AdminWithdrawalPage>(`/admin/withdrawals?status=${status}&page=${page}`);
}

export async function fetchAdminWithdrawalDetail(id: string): Promise<AdminWithdrawalDetail> {
  return request<AdminWithdrawalDetail>(`/admin/withdrawals/${id}`);
}

export async function revealWithdrawalBank(id: string): Promise<WithdrawalBankResponse> {
  return request<WithdrawalBankResponse>(`/admin/withdrawals/${id}/bank`);
}

export async function approveWithdrawal(id: string): Promise<void> {
  return request(`/admin/withdrawals/${id}/approve`, {});
}

export async function rejectWithdrawal(id: string, reason: string): Promise<void> {
  return request(`/admin/withdrawals/${id}/reject`, { reason });
}

export async function confirmWithdrawalPayout(
  id: string,
  payload: { proof: string },
): Promise<void> {
  return request(`/admin/withdrawals/${id}/pay`, payload);
}

// Wallet & Bank Details
export async function fetchWalletOverview(sellerId: string): Promise<WalletResponse> {
  return request<WalletResponse>(`/sellers/${sellerId}/wallet`);
}

export async function requestWithdrawal(sellerId: string, amount: number): Promise<void> {
  return request(`/sellers/${sellerId}/withdrawals`, { amount });
}

export async function fetchSellerBank(sellerId: string): Promise<SellerBankResponse> {
  return request<SellerBankResponse>(`/sellers/${sellerId}/bank`);
}

export async function updateSellerBank(
  sellerId: string,
  data: { bank: string; holder: string; account: string },
): Promise<void> {
  return request(`/sellers/${sellerId}/bank`, data);
}

// Reconciliation
export async function reconcileDaily(date: string): Promise<DailyReconciliationResult> {
  return request<DailyReconciliationResult>('/admin/flows/reconcile_daily', { p_date: date });
}

export async function reconcileGateway(
  date: string,
  statement: Statement,
): Promise<GatewayReconciliationResult> {
  return request<GatewayReconciliationResult>('/admin/flows/reconcile_gateway', {
    p_date: date,
    p_statement: statement,
  });
}

// Financial Proofs
export async function fetchFinancialProofs(
  purpose: string,
  resourceId: string,
): Promise<IncidentEvidenceResponse> {
  return request<IncidentEvidenceResponse>(`/admin/evidence/${purpose}/${resourceId}`);
}

// Admin Kiosk Refunds
export async function fetchAdminKioskRefunds(): Promise<AdminKioskRefundSummary[]> {
  return request<AdminKioskRefundSummary[]>('/admin/kiosk-applications/refund-queue');
}

export async function revealKioskRefundBank(
  applicationId: string,
): Promise<KioskRefundBankResponse> {
  return request<KioskRefundBankResponse>(`/admin/kiosk-applications/${applicationId}/refund/bank`);
}

export async function approveKioskRefund(applicationId: string): Promise<void> {
  return request(`/admin/kiosk-applications/${applicationId}/refund/approve`, {});
}

export async function confirmKioskRefund(
  applicationId: string,
  payload: ConfirmKioskRefundRequest,
): Promise<void> {
  return request(`/admin/kiosk-applications/${applicationId}/refund/confirm`, payload);
}
