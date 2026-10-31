'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, RefreshCw } from '@florabot/ui';
import { request, type Session } from '@/shared/lib/api';
import { Modal } from '../../../shared/components/Modal';
import type { EligibleKioskResponse } from '../installations.types';

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
  const [slotFilter, setSlotFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const kiosksQuery = useQuery({
    queryKey: ['available-kiosks-inventory', session.id],
    queryFn: () => request<EligibleKioskResponse[]>('/operations/eligible-kiosks'),
    enabled: open,
  });

  const rawKiosks = kiosksQuery.data;
  const allKiosks = useMemo(() => rawKiosks || [], [rawKiosks]);

  const availableSlotCounts = useMemo(() => {
    const counts = new Set<number>();
    allKiosks.forEach((k) => counts.add(Number(k.slotCount)));
    return Array.from(counts).sort((a, b) => a - b);
  }, [allKiosks]);

  const filteredKiosks = useMemo(() => {
    return allKiosks.filter((k) => {
      const matchSlot = slotFilter === 'ALL' || String(k.slotCount) === slotFilter;
      const matchSearch =
        !searchTerm.trim() ||
        k.code.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        k.name.toLowerCase().includes(searchTerm.toLowerCase().trim());
      return matchSlot && matchSearch;
    });
  }, [allKiosks, slotFilter, searchTerm]);

  return (
    <Modal open={open} onClose={onClose} title="Kho thiết bị Kiosk khả dụng" size="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <p style={{ margin: 0, color: 'var(--color-text-muted, #475569)', fontSize: '0.9rem' }}>
          Danh sách các tủ kiosk phần cứng đã đăng ký, chưa được gán cho bất kỳ shop nào và đang sẵn
          sàng để cấp phát khi xếp lịch lắp đặt.
        </p>

        {/* Toolbar: Search, Slot filter, Refresh & Add */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc',
            padding: '0.75rem',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
          }}
        >
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Tìm theo mã hoặc tên tủ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: '0.875rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                minWidth: '200px',
              }}
            />

            <select
              value={slotFilter}
              onChange={(e) => setSlotFilter(e.target.value)}
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: '0.875rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
              }}
            >
              <option value="ALL">Tất cả quy mô ô ({allKiosks.length} tủ)</option>
              {availableSlotCounts.map((count) => (
                <option key={count} value={String(count)}>
                  Quy mô {count} ô ({allKiosks.filter((k) => k.slotCount === count).length} tủ)
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Button
              variant="outline"
              onClick={() => void kiosksQuery.refetch()}
              disabled={kiosksQuery.isFetching}
              style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
            >
              <RefreshCw
                size={15}
                className={kiosksQuery.isFetching ? 'spin' : ''}
                aria-hidden="true"
              />
              Làm mới
            </Button>
            <Button
              onClick={() => {
                onClose();
                onOpenEnroll(slotFilter !== 'ALL' ? Number(slotFilter) : 2);
              }}
              style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
            >
              + Thêm tủ mới
            </Button>
          </div>
        </div>

        {/* Content Table / Status */}
        {kiosksQuery.isLoading ? (
          <p role="status" style={{ textAlign: 'center', padding: '2rem 0', color: '#64748b' }}>
            Đang tải danh sách kho tủ...
          </p>
        ) : kiosksQuery.isError ? (
          <div
            role="alert"
            style={{
              padding: '1rem',
              background: '#fee2e2',
              borderRadius: '8px',
              color: '#991b1b',
            }}
          >
            <p style={{ margin: 0 }}>
              Không thể tải danh sách tủ khả dụng lúc này. Vui lòng thử lại.
            </p>
            <Button
              variant="outline"
              onClick={() => void kiosksQuery.refetch()}
              style={{ marginTop: '0.5rem' }}
            >
              Thử lại
            </Button>
          </div>
        ) : filteredKiosks.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '2.5rem 1rem',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px dashed #cbd5e1',
            }}
          >
            <p style={{ fontWeight: 600, color: '#334155', margin: '0 0 0.5rem 0' }}>
              {allKiosks.length === 0
                ? 'Hiện chưa có tủ kiosk trống nào trong kho'
                : 'Không tìm thấy tủ phù hợp với bộ lọc'}
            </p>
            <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0 0 1rem 0' }}>
              {allKiosks.length === 0
                ? 'Tất cả các tủ đã được gán cho các shop hoa hoặc chưa được đăng ký phần cứng.'
                : 'Hãy thử đổi từ khóa tìm kiếm hoặc chọn tất cả quy mô ô.'}
            </p>
            {allKiosks.length === 0 && (
              <Button
                onClick={() => {
                  onClose();
                  onOpenEnroll(2);
                }}
              >
                + Đăng ký thiết bị tủ mới ngay
              </Button>
            )}
          </div>
        ) : (
          <div
            style={{
              maxHeight: '350px',
              overflowY: 'auto',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.9rem',
                textAlign: 'left',
              }}
            >
              <thead style={{ background: '#f1f5f9', position: 'sticky', top: 0, zIndex: 1 }}>
                <tr>
                  <th
                    style={{
                      padding: '0.75rem 1rem',
                      borderBottom: '1px solid #cbd5e1',
                      color: '#1e293b',
                    }}
                  >
                    Mã tủ (Code)
                  </th>
                  <th
                    style={{
                      padding: '0.75rem 1rem',
                      borderBottom: '1px solid #cbd5e1',
                      color: '#1e293b',
                    }}
                  >
                    Tên thiết bị Kiosk
                  </th>
                  <th
                    style={{
                      padding: '0.75rem 1rem',
                      borderBottom: '1px solid #cbd5e1',
                      color: '#1e293b',
                    }}
                  >
                    Quy mô ô
                  </th>
                  <th
                    style={{
                      padding: '0.75rem 1rem',
                      borderBottom: '1px solid #cbd5e1',
                      color: '#1e293b',
                    }}
                  >
                    Trạng thái kết nối
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredKiosks.map((kiosk, idx) => (
                  <tr
                    key={kiosk.id}
                    style={{
                      background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                      borderBottom: '1px solid #e2e8f0',
                    }}
                  >
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                      <code>{kiosk.code}</code>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>{kiosk.name}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.5rem',
                          background: '#e0f2fe',
                          color: '#0369a1',
                          borderRadius: '4px',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                        }}
                      >
                        {kiosk.slotCount} ô
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.2rem 0.5rem',
                          background: kiosk.status === 'ONLINE' ? '#dcfce7' : '#f1f5f9',
                          color: kiosk.status === 'ONLINE' ? '#15803d' : '#475569',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          fontWeight: 500,
                        }}
                      >
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: kiosk.status === 'ONLINE' ? '#22c55e' : '#94a3b8',
                          }}
                        />
                        {kiosk.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </div>
    </Modal>
  );
}
