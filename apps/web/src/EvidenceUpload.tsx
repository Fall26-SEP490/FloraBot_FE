/**
 * Compatibility shim for EvidenceUpload.
 * Consumers awaiting subsequent migration waves:
 * - Wave 8: StaffEvidence.tsx
 * - Wave 9: ReportFault.tsx
 * - Wave 10: AdminRefunds.tsx, AdminWithdrawals.tsx
 * - Wave 5 callers: ReturnFlowers.tsx, ReceiptComplaint.tsx
 */
export { default } from './features/installations/components/EvidenceUpload';
