'use client';

import IconActionButton from '@/shared/components/IconActionButton';
import '@/features/portal/styles/operations-registers.css';
import WorkspaceTable from '@/features/portal/components/WorkspaceTable';
import { liveListOptions } from '@/shared/lib/live-list';
import Select from '@/shared/components/Select';
import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Boxes, Button, Search } from '@florabot/ui';
import { queryClient, request, type Session } from '@/shared/lib/api';
import { Modal } from '../../../shared/components/Modal';
import type { EligibleKioskResponse } from '../installations.types';
import { DeleteKioskModal } from './DeleteKioskModal';
import { FlowerPresencePanel } from '../../kiosk-management/FlowerPresencePanel';
import { Esp32ConfigurationPanel } from '../../kiosk-management/Esp32ConfigurationPanel';

interface AvailableKiosksModalProps {
  open: boolean;
  onClose: () => void;
  session: Session;
}

export function AvailableKiosksModal({ open, onClose, session }: AvailableKiosksModalProps) {
  const [selectedKiosk, setSelectedKiosk] = useState<EligibleKioskResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EligibleKioskResponse | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState('');
  const [lastDeleteId, setLastDeleteId] = useState<string | null>(null);
  const isManager = session.role === 'OPERATIONS_MANAGER';
  const cancelDelete = useCallback(() => setDeleteTarget(null), []);
  const removeFromInventory = async (id: string) => {
    for (const key of ['available-kiosks-inventory', 'eligible-kiosks']) {
      const queryKey = [key, session.id];
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueriesData<EligibleKioskResponse[]>({ queryKey }, (items) =>
        items?.filter((item) => item.id !== id),
      );
      void queryClient.invalidateQueries({ queryKey });
    }
  };
  const handleDeleted = async (kiosk: EligibleKioskResponse) => {
    await removeFromInventory(kiosk.id);
    setDeleteSuccess(
      `Đã ngừng sử dụng và lưu trữ tủ ${kiosk.code}. Tủ không còn trong kho khả dụng.`,
    );
    setDeleteTarget(null);
  };
  const [slotFilter, setSlotFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const kiosksQuery = useQuery({
    ...liveListOptions(!deleteTarget && !selectedKiosk),
    queryKey: ['available-kiosks-inventory', session.id],
    queryFn: () => request<EligibleKioskResponse[]>('/operations/eligible-kiosks'),
    enabled: open && isManager,
  });
  const allKiosks = useMemo(() => kiosksQuery.data || [], [kiosksQuery.data]);
  const slotCounts = useMemo(
    () => Array.from(new Set(allKiosks.map((k) => Number(k.slotCount)))).sort((a, b) => a - b),
    [allKiosks],
  );
  const filteredKiosks = allKiosks.filter(
    (k) =>
      (slotFilter === 'ALL' || String(k.slotCount) === slotFilter) &&
      (!searchTerm.trim() ||
        `${k.code} ${k.name}`
          .toLocaleLowerCase('vi')
          .includes(searchTerm.trim().toLocaleLowerCase('vi'))),
  );

  if (!isManager) return null;

  return (
    <>
      <Modal
        open={open && !deleteTarget && !selectedKiosk}
        onClose={onClose}
        title="Kho tủ khả dụng"
        size="lg"
        className="installation-modal installation-inventory-modal"
      >
        {deleteSuccess && (
          <p role="status" className="inventory-delete-success">
            {deleteSuccess}
          </p>
        )}
        <div className="inventory-filters">
          <div className="kiosk-form-field">
            <label htmlFor="inventory-search">Tìm kiosk</label>
            <div className="installation-search">
              <Search size={17} aria-hidden="true" />
              <input
                id="inventory-search"
                type="search"
                placeholder="Tìm theo mã hoặc tên tủ..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          </div>
          <div className="kiosk-form-field">
            <label htmlFor="inventory-slot-filter">Số ô</label>
            <Select
              id="inventory-slot-filter"
              value={slotFilter}
              onChange={(event) => setSlotFilter(event.target.value)}
            >
              <option value="ALL">Tất cả</option>
              {slotCounts.map((count) => (
                <option key={count} value={String(count)}>
                  {count} ô
                </option>
              ))}
            </Select>
          </div>
        </div>
        {kiosksQuery.isPending ? (
          <p role="status" className="installation-loading">
            Đang tải danh sách kho tủ...
          </p>
        ) : kiosksQuery.isError ? (
          <div role="alert" className="kiosk-field-error-banner">
            <div>
              <p>Không thể tải danh sách tủ khả dụng lúc này. Vui lòng thử lại.</p>
              <Button variant="outline" onClick={() => void kiosksQuery.refetch()}>
                Thử lại
              </Button>
            </div>
          </div>
        ) : filteredKiosks.length === 0 ? (
          <div className="installation-empty">
            <Boxes size={32} aria-hidden="true" />
            <h3>
              {allKiosks.length === 0 ? 'Chưa có tủ trống trong kho' : 'Không tìm thấy tủ phù hợp'}
            </h3>
            {(searchTerm.trim() || slotFilter !== 'ALL') && (
              <IconActionButton
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setSlotFilter('ALL');
                }}
                action="clear"
                label="Xóa bộ lọc"
              />
            )}
          </div>
        ) : (
          <>
            <p className="inventory-result-count" role="status">
              Hiển thị {filteredKiosks.length} / {allKiosks.length} tủ
            </p>
            <WorkspaceTable label="Danh sách tủ khả dụng">
              <table className="available-kiosk-table" aria-label="Danh sách tủ khả dụng">
                <thead>
                  <tr>
                    <th scope="col">Thiết bị</th>
                    <th scope="col">Số ô</th>
                    <th scope="col">Kết nối</th>
                    <th scope="col">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredKiosks.map((kiosk) => (
                    <tr key={kiosk.id}>
                      <td data-label="Thiết bị">
                        <strong>{kiosk.name}</strong>
                        <code>{kiosk.code}</code>
                      </td>
                      <td data-label="Quy mô">
                        <span className="inventory-slot-count">{kiosk.slotCount} ô</span>
                      </td>
                      <td data-label="Kết nối">
                        <span
                          className="inventory-connection"
                          data-online={kiosk.status === 'ONLINE'}
                        >
                          <span aria-hidden="true" />
                          {kiosk.status}
                        </span>
                      </td>
                      <td data-label="Thao tác" className="inventory-row-actions">
                        <Button
                          variant="outline"
                          aria-label={`Xem tủ ${kiosk.code}`}
                          onClick={() => setSelectedKiosk(kiosk)}
                        >
                          Xem
                        </Button>
                        <Button
                          variant="outline"
                          className="inventory-delete-button"
                          aria-label={`Lưu trữ tủ ${kiosk.code}`}
                          aria-describedby="inventory-delete-policy"
                          data-autofocus={lastDeleteId === kiosk.id || undefined}
                          disabled={kiosk.status !== 'OFFLINE'}
                          title={
                            kiosk.status !== 'OFFLINE' ? 'Chỉ lưu trữ được tủ OFFLINE.' : undefined
                          }
                          onClick={() => {
                            setLastDeleteId(kiosk.id);
                            setDeleteSuccess('');
                            setDeleteTarget(kiosk);
                          }}
                        >
                          Lưu trữ
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </WorkspaceTable>
          </>
        )}
        <div className="installation-modal-footer">
          <p id="inventory-delete-policy" className="sr-only">
            Chỉ lưu trữ tủ OFFLINE và đủ điều kiện. Lịch sử được giữ lại.
          </p>
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </Modal>
      {open && selectedKiosk && (
        <Modal
          open
          title={selectedKiosk.name}
          description={selectedKiosk.code}
          size="lg"
          className="installation-modal inventory-device-dialog"
          onClose={() => setSelectedKiosk(null)}
        >
          <FlowerPresencePanel kioskId={selectedKiosk.id} />
          <Esp32ConfigurationPanel
            actorId={session.id}
            scope="manager"
            resourceId={selectedKiosk.id}
          />
        </Modal>
      )}
      {open && deleteTarget && (
        <DeleteKioskModal
          key={deleteTarget.id}
          kiosk={deleteTarget}
          session={session}
          onCancel={cancelDelete}
          onDeleted={handleDeleted}
          onMissing={removeFromInventory}
        />
      )}
    </>
  );
}
