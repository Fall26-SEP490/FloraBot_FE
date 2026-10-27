export const INCIDENT_STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Đang mở · cũ nhất trước' },
  { value: 'RESOLVED_FIXED', label: 'Đã xử lý · mới nhất trước' },
] as const;

export const INCIDENT_KIND_LABELS: Record<string, string> = {
  DISPENSE_FAILED: 'Không giao được hoa',
  DEVICE_FAULT: 'Sự cố thiết bị',
};
