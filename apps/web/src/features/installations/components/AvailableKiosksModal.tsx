'use client';

import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Boxes, Button, Plus, RefreshCw, Search } from '@florabot/ui';
import { queryClient, request, type Session } from '@/shared/lib/api';
import { Modal } from '../../../shared/components/Modal';
import type { EligibleKioskResponse } from '../installations.types';
import { DeleteKioskModal } from './DeleteKioskModal';

interface AvailableKiosksModalProps {
  open: boolean;
  onClose: () => void;
  session: Session;
  onOpenEnroll: (slotCount?: number) => void;
}

export function AvailableKiosksModal({
  open,
  onClose,
  session,
  onOpenEnroll,
}: AvailableKiosksModalProps) {
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
    setDeleteSuccess(`Đã xóa tủ ${kiosk.code} khỏi kho.`);
    setDeleteTarget(null);
  };
  const [slotFilter, setSlotFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const kiosksQuery = useQuery({
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
  const openEnroll = () => {
    onClose();
    onOpenEnroll(slotFilter === 'ALL' ? 2 : Number(slotFilter));
  };

  if (!isManager) return null;

  return (
    <>
      <Modal
        open={open && !deleteTarget}
        onClose={onClose}
        title="Kho thiết bị Kiosk khả dụng"
        size="lg"
        className="installation-modal installation-inventory-modal"
        description="Tra cứu tủ chưa được phân bổ để chuẩn bị cho lịch lắp đặt."
      >
        {deleteSuccess && (
          <p role="status" className="inventory-delete-success">
            {deleteSuccess}
          </p>
        )}
        <div className="inventory-overview">
          <span className="installation-feature-icon">
            <Boxes size={23} aria-hidden="true" />
          </span>
          <div>
            <strong>
              {kiosksQuery.isSuccess ? `${allKiosks.length} tủ khả dụng` : 'Kho tủ lắp đặt'}
            </strong>
            <p>Tủ OFFLINE vẫn có thể được phân công trước khi kết nối.</p>
          </div>
          <Button onClick={openEnroll}>
            <Plus size={16} aria-hidden="true" />
            Thêm tủ mới
          </Button>
        </div>
        <div className="inventory-filters">
          <div className="kiosk-form-field">
            <label htmlFor="inventory-search">Tìm thiết bị</label>
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
            <label htmlFor="inventory-slot-filter">Quy mô ô</label>
            <select
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
            </select>
          </div>
          <Button
            variant="outline"
            onClick={() => void kiosksQuery.refetch()}
            disabled={kiosksQuery.isFetching}
          >
            <RefreshCw
              size={16}
              className={kiosksQuery.isFetching ? 'spin' : ''}
              aria-hidden="true"
            />
            Làm mới
          </Button>
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
            <p>
              {allKiosks.length === 0
                ? 'Đăng ký thiết bị mới để chuẩn bị phân công lắp đặt.'
                : 'Thử thay đổi từ khóa hoặc chọn tất cả quy mô ô.'}
            </p>
            {allKiosks.length === 0 ? (
              <Button onClick={openEnroll}>Đăng ký thiết bị tủ mới</Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setSlotFilter('ALL');
                }}
              >
                Xóa bộ lọc
              </Button>
            )}
          </div>
        ) : (
          <>
            <p className="inventory-result-count" role="status">
              Hiển thị {filteredKiosks.length} / {allKiosks.length} tủ
            </p>
            <div className="inventory-table-wrap">
              <table className="inventory-table" aria-label="Danh sách tủ khả dụng">
                <thead>
                  <tr>
                    <th scope="col">Thiết bị</th>
                    <th scope="col">Quy mô</th>
                    <th scope="col">Kết nối</th>
                    <th scope="col">
                      <span className="sr-only">Thao tác</span>
                    </th>
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
                          className="inventory-delete-button"
                          aria-label={`Xóa tủ ${kiosk.code}`}
                          aria-describedby="inventory-delete-policy"
                          data-autofocus={lastDeleteId === kiosk.id || undefined}
                          disabled={kiosk.status !== 'OFFLINE'}
                          title={
                            kiosk.status !== 'OFFLINE'
                              ? 'Chỉ xóa được tủ OFFLINE chưa từng kết nối.'
                              : undefined
                          }
                          onClick={() => {
                            setLastDeleteId(kiosk.id);
                            setDeleteSuccess('');
                            setDeleteTarget(kiosk);
                          }}
                        >
                          Xóa
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <div className="installation-modal-footer">
          <p id="inventory-delete-policy">
            Chọn tủ khi xếp lịch. Chỉ xóa tủ OFFLINE chưa từng kết nối và chưa có lịch sử sử dụng.
          </p>
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </Modal>
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
