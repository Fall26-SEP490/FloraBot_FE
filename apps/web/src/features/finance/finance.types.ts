import type { components } from '../../../../../packages/contracts/src/generated/api';

// Refunds
export type AdminRefundResponse = components['schemas']['AdminRefundResponse'];
export type AdminRefundDetail = components['schemas']['AdminRefundDetail'];
export type RefundBankResponse = components['schemas']['RefundBankResponse'];
export type AdminRefundPage = components['schemas']['AdminRefundPage'];
export type ApproveRefundRequest = components['schemas']['ApproveRefundRequest'];
export type ConfirmRefundRequest = components['schemas']['ConfirmRefundRequest'];
export type SubmitRefundInfoRequest = components['schemas']['SubmitRefundInfoRequest'];

// Withdrawals
export type AdminWithdrawalResponse = components['schemas']['AdminWithdrawalResponse'];
export type AdminWithdrawalDetail = components['schemas']['AdminWithdrawalDetail'];
export type WithdrawalBankResponse = components['schemas']['WithdrawalBankResponse'];
export type AdminWithdrawalPage = components['schemas']['AdminWithdrawalPage'];
export type WithdrawalAction = 'approve' | 'reject' | 'pay';
export type ApproveWithdrawalRequest = components['schemas']['ApproveWithdrawalRequest'];
export type RejectWithdrawalRequest = components['schemas']['RejectWithdrawalRequest'];
export type PayWithdrawalRequest = components['schemas']['PayWithdrawalRequest'];

// Common
export type FlowResult = components['schemas']['FlowResult'];

// Wallet & Seller Bank
export type WalletResponse = components['schemas']['WalletResponse'];
export type SellerBankResponse = components['schemas']['SellerBankResponse'];

// Reconciliation
export type DailyReconciliationResult = components['schemas']['DailyReconciliationResult'];
export type GatewayReconciliationResult = components['schemas']['GatewayReconciliationResult'];
export type StatementItem = { txn: string; amount: number };
export type Statement = StatementItem[];

// Evidence & Proofs
export type IncidentEvidenceResponse = components['schemas']['IncidentEvidenceResponse'];
export type EvidenceUploadResponse = components['schemas']['EvidenceUploadResponse'];

// Kiosk Refunds
export type AdminKioskRefundSummary = components['schemas']['AdminKioskRefundSummary'];
export type KioskRefundBankResponse = components['schemas']['KioskRefundBankResponse'];
export type ConfirmKioskRefundRequest = components['schemas']['ConfirmKioskRefundRequest'];
