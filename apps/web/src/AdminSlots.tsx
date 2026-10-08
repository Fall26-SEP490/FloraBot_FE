import { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@florabot/ui';
import type { components } from '../../../packages/contracts/src/generated/api';
import { queryClient, request } from './api';

type Slot = components['schemas']['AdminSlotResponse'];
type Seller = components['schemas']['AdminSellerResponse'];
const statuses: Record<string, string> = {
  FREE: 'Chưa cho thuê',
  RENTED_EMPTY: 'Đã thuê, chưa nạp hoa',
  STOCKED: 'Đã nạp hoa',
  HELD: 'Khách đang thanh toán',
  PENDING_REMOVAL: 'Chờ lấy hoa hết hạn',
  PENDING_RELEASE: 'Chờ lấy hoa về để trả ô',
  FAULT: 'Có sự cố',
  LOCKED: 'Đang khóa',
};
const kioskStatuses: Record<string, string> = {
  ONLINE: 'Trực tuyến',
  OFFLINE: 'Mất kết nối',
  MAINTENANCE: 'Bảo trì',
  DISABLED: 'Ngừng hoạt động',
};
const schema = z.object({ sellerId: z.string().min(1, 'Chọn shop sẽ thuê ô này.') });

function Assignment({
  slot,
  sellers,
  onAssigned,
}: {
  slot: Slot;
  sellers: Seller[];
  onAssigned: (message: string) => void;
}) {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { sellerId: '' },
  });
  const assign = useMutation({
    mutationFn: (values: z.infer<typeof schema>) =>
      request('/admin/flows/assign_slot', {
        p_slot: slot.id,
        p_seller: values.sellerId,
      } satisfies components['schemas']['AssignSlotRequest']),
    onSuccess: async (_result, values) => {
      onAssigned(
        `Đã gán ô ${slot.slotCode} tại ${slot.kioskName} cho ${sellers.find((seller) => seller.id === values.sellerId)?.shopName || 'shop đã chọn'}. Shop có thể nạp hoa vào ô này.`,
      );
      await queryClient.invalidateQueries({ queryKey: ['admin-slots'] });
    },
  });
  return (
    <form
      className="approval-form"
      noValidate
      onSubmit={form.handleSubmit((values) => assign.mutate(values))}
    >
      <label htmlFor={`slot-seller-${slot.id}`}>Shop thuê ô {slot.slotCode}</label>
      <select
        id={`slot-seller-${slot.id}`}
        {...form.register('sellerId')}
        disabled={assign.isPending}
        aria-invalid={!!form.formState.errors.sellerId}
        aria-describedby={`slot-error-${slot.id} slot-help-${slot.id}`}
      >
        <option value="">Chọn shop</option>
        {sellers.map((seller) => (
          <option key={seller.id} value={seller.id}>
            {seller.shopName} · {seller.phone}
          </option>
        ))}
      </select>
      <p id={`slot-error-${slot.id}`} className="error">
        {form.formState.errors.sellerId?.message}
      </p>
      <p id={`slot-help-${slot.id}`} className="quiet">
        Hệ thống kiểm tra hiệu lực gói, số ô còn được thuê và trạng thái ô trước khi gán.
      </p>
      <Button type="submit" disabled={!sellers.length || assign.isPending}>
        {assign.isPending ? 'Đang gán ô…' : 'Gán ô cho shop'}
      </Button>
      {assign.isError && (
        <p className="error" role="alert">
          {assign.error.message}
        </p>
      )}
    </form>
  );
}

export default function AdminSlots() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('FREE');
  const [confirmation, setConfirmation] = useState('');
  const notice = useRef<HTMLParagraphElement>(null);
  const slots = useQuery({
    queryKey: ['admin-slots'],
    queryFn: () => request<Slot[]>('/admin/slots'),
  });
  const sellers = useQuery({
    queryKey: ['admin-sellers', 'ACTIVE'],
    queryFn: () => request<Seller[]>('/admin/sellers?status=ACTIVE'),
  });
  const visible = slots.data?.filter(
    (slot) =>
      (!status || slot.status === status) &&
      `${slot.kioskCode} ${slot.kioskName} ${slot.kioskAddress} ${slot.slotCode}`
        .toLocaleLowerCase('vi')
        .includes(search.trim().toLocaleLowerCase('vi')),
  );
  return (
    <section className="admin-slots" aria-labelledby="admin-slots-title">
      <h2 id="admin-slots-title">Sắp chỗ cho những bó hoa</h2>
      <p>Chọn đúng kiosk và ô tủ đã trao đổi với shop, rồi gán ô để shop chuẩn bị nạp hoa.</p>
      <div className="product-filters">
        <div>
          <label htmlFor="slot-search">Tìm kiosk, địa chỉ hoặc mã ô</label>
          <input
            id="slot-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="slot-status">Lọc trạng thái ô</label>
          <select
            id="slot-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">Tất cả trạng thái ô</option>
            {Object.entries(statuses).map(([value, name]) => (
              <option key={value} value={value}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Button
        onClick={() => {
          void slots.refetch();
          void sellers.refetch();
        }}
        disabled={slots.isFetching || sellers.isFetching}
      >
        Làm mới danh sách ô
      </Button>
      <p className="quiet">
        Danh sách chọn shop gồm tối đa 100 shop đang hoạt động mới nhất. Gói thuê phải còn hiệu lực
        tại thời điểm gán ô.
      </p>
      <p role="status" ref={notice} tabIndex={-1}>
        {confirmation}
      </p>
      {slots.isPending && <p role="status">Đang tải các ô tủ…</p>}
      {slots.isError && (
        <p className="error" role="alert">
          Chưa tải được ô tủ. Chọn “Làm mới danh sách ô” để thử lại.
        </p>
      )}
      {sellers.isError && (
        <p className="error" role="alert">
          Chưa tải được shop đang hoạt động. Chọn “Làm mới danh sách ô” để thử lại.
        </p>
      )}
      {visible?.length === 0 && <p>Không có ô phù hợp với bộ lọc hiện tại.</p>}
      <ul className="admin-shop-list">
        {visible?.map((slot) => (
          <li key={slot.id}>
            <details>
              <summary>
                <strong>
                  {slot.kioskName} · Ô {slot.slotCode}
                </strong>
                <span>{statuses[slot.status] || slot.status}</span>
              </summary>
              <div className="shop-profile">
                <dl>
                  <div>
                    <dt>Kiosk</dt>
                    <dd>{slot.kioskCode}</dd>
                  </div>
                  <div>
                    <dt>Địa chỉ</dt>
                    <dd>{slot.kioskAddress}</dd>
                  </div>
                  <div>
                    <dt>Kết nối kiosk</dt>
                    <dd>{kioskStatuses[slot.kioskStatus] || slot.kioskStatus}</dd>
                  </div>
                  <div>
                    <dt>Shop đang thuê</dt>
                    <dd>
                      {slot.currentSellerId
                        ? sellers.data?.find((seller) => seller.id === slot.currentSellerId)
                            ?.shopName || 'Đã gán cho shop'
                        : 'Chưa có'}
                    </dd>
                  </div>
                </dl>
                {slot.status === 'FREE' &&
                  (sellers.isPending ? (
                    <p role="status">Đang tải shop…</p>
                  ) : (
                    sellers.data &&
                    (sellers.data.length ? (
                      <Assignment
                        slot={slot}
                        sellers={sellers.data}
                        onAssigned={(message) => {
                          setConfirmation(message);
                          notice.current?.focus();
                        }}
                      />
                    ) : (
                      <p>
                        Chưa có shop đang hoạt động để gán ô. Shop cần được duyệt và thanh toán gói
                        trước.
                      </p>
                    ))
                  ))}
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
