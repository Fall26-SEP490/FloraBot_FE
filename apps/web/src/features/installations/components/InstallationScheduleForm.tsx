import { useId } from 'react';
import { Button, ClipboardList } from '@florabot/ui';
import type { UseQueryResult } from '@tanstack/react-query';
import type { AccountDirectoryItem } from '../../account-management/account-management.types';
import type { EligibleKioskResponse, KioskApplicationResponse } from '../installations.types';

interface InstallationScheduleFormProps {
  appDetail: KioskApplicationResponse;
  selectedTechId: string;
  onSelectTechId: (id: string) => void;
  selectedKioskId: string;
  onSelectKioskId: (id: string) => void;
  scheduledDate: string;
  onScheduledDateChange: (date: string) => void;
  timeWindow: string;
  onTimeWindowChange: (time: string) => void;
  activeTechnicians: AccountDirectoryItem[];
  techniciansQuery: UseQueryResult<AccountDirectoryItem[], Error>;
  eligibleKiosks: EligibleKioskResponse[];
  eligibleKiosksQuery: UseQueryResult<EligibleKioskResponse[], Error>;
  onOpenEnroll: (slotCount: number) => void;
  onSubmit: () => void;
  isPending: boolean;
}

export function InstallationScheduleForm({
  appDetail,
  selectedTechId,
  onSelectTechId,
  selectedKioskId,
  onSelectKioskId,
  scheduledDate,
  onScheduledDateChange,
  timeWindow,
  onTimeWindowChange,
  activeTechnicians,
  techniciansQuery,
  eligibleKiosks,
  eligibleKiosksQuery,
  onOpenEnroll,
  onSubmit,
  isPending,
}: InstallationScheduleFormProps) {
  const techSelectId = useId();
  const kioskSelectId = useId();
  const scheduleDateId = useId();
  const timeWindowId = useId();

  return (
    <div className="operations-action-card">
      <h3>Bước 2: Phân công Kỹ thuật viên & Cấp phát Tủ Kiosk</h3>
      <p>
        Chọn một kỹ thuật viên đang hoạt động và một tủ kiosk trống có đủ {appDetail.totalSlots} ô.
        Chủ shop phân loại hình thức bán sau khi được cấp kiosk.
      </p>

      <div className="form-fields-grid-2">
        <div className="kiosk-form-field">
          <label htmlFor={techSelectId}>Kỹ thuật viên phụ trách (ACTIVE):</label>
          <select
            id={techSelectId}
            value={selectedTechId}
            onChange={(e) => onSelectTechId(e.target.value)}
          >
            <option value="">-- Chọn kỹ thuật viên --</option>
            {activeTechnicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName} ({t.phone || t.email})
              </option>
            ))}
          </select>
          {techniciansQuery.isError && (
            <p role="alert" className="kiosk-field-error">
              Không tải được kỹ thuật viên.{' '}
              <button type="button" onClick={() => void techniciansQuery.refetch()}>
                Thử lại
              </button>
            </p>
          )}
          {techniciansQuery.isPending && <small role="status">Đang tải kỹ thuật viên…</small>}
          {techniciansQuery.isSuccess && activeTechnicians.length === 0 && (
            <small className="kiosk-field-error">
              Không có kỹ thuật viên ACTIVE nào. Vui lòng kích hoạt trong mục Kỹ thuật viên.
            </small>
          )}
        </div>

        <div className="kiosk-form-field">
          <div className="field-label-with-action">
            <label htmlFor={kioskSelectId}>Tủ Kiosk cấp phát:</label>
            <button
              type="button"
              className="link-inline-btn"
              onClick={() => onOpenEnroll(Number(appDetail.totalSlots))}
            >
              + Thêm tủ mới (Asset Enrollment)
            </button>
          </div>
          <select
            id={kioskSelectId}
            value={selectedKioskId}
            onChange={(e) => onSelectKioskId(e.target.value)}
          >
            <option value="">-- Chọn tủ kiosk phù hợp --</option>
            {appDetail.status === 'SCHEDULED' &&
              appDetail.assignedKioskId &&
              !eligibleKiosks.some((k) => k.id === appDetail.assignedKioskId) && (
                <option value={appDetail.assignedKioskId}>
                  {appDetail.assignedKioskCode} · Tủ đang phân công cho hồ sơ này
                </option>
              )}
            {eligibleKiosks.map((k) => (
              <option key={k.id} value={k.id}>
                {k.code} - {k.name} ({k.slotCount} ô) [{k.status}]
              </option>
            ))}
          </select>
          {eligibleKiosksQuery.isError && (
            <p role="alert" className="kiosk-field-error">
              Không tải được tủ khả dụng.{' '}
              <button type="button" onClick={() => void eligibleKiosksQuery.refetch()}>
                Thử lại
              </button>
            </p>
          )}
          {eligibleKiosksQuery.isPending && <small role="status">Đang tải tủ phù hợp…</small>}
          {eligibleKiosksQuery.isSuccess &&
            eligibleKiosks.length === 0 &&
            !appDetail.assignedKioskId && (
              <small className="kiosk-field-error">
                Chưa có tủ kiosk nào khả dụng với {appDetail.totalSlots} ô. Nhấn Thêm tủ mới để đăng
                ký thiết bị.
              </small>
            )}
        </div>
      </div>

      <div className="form-fields-grid-2">
        <div className="kiosk-form-field">
          <label htmlFor={scheduleDateId}>Ngày dự kiến lắp đặt:</label>
          <input
            id={scheduleDateId}
            type="date"
            value={scheduledDate}
            onChange={(e) => onScheduledDateChange(e.target.value)}
          />
        </div>
        <div className="kiosk-form-field">
          <label htmlFor={timeWindowId}>Khung giờ:</label>
          <input
            id={timeWindowId}
            type="text"
            value={timeWindow}
            onChange={(e) => onTimeWindowChange(e.target.value)}
            placeholder="09:00 - 12:00"
          />
        </div>
      </div>

      <div className="action-buttons-row">
        <Button
          onClick={onSubmit}
          disabled={
            isPending ||
            techniciansQuery.isPending ||
            techniciansQuery.isError ||
            eligibleKiosksQuery.isPending ||
            eligibleKiosksQuery.isError
          }
        >
          <ClipboardList size={18} aria-hidden="true" />
          {isPending ? 'Đang lưu...' : 'Lưu lịch & Phân công'}
        </Button>
      </div>
    </div>
  );
}
