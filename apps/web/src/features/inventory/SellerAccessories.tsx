import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Button, Plus, Search } from '@florabot/ui';
import Select from '@/shared/components/Select';
import IconActionButton from '@/shared/components/IconActionButton';
import { Modal } from '@/shared/components/Modal';
import styles from '../product-management/styles/seller-catalog.module.css';
import type { components } from '../../../../../packages/contracts/src/generated/api';
import { ApiError, queryClient, request, type Session } from '@/shared/lib/api';

type Accessory = components['schemas']['SellerAccessoryResponse'];
function validPrice(value: string) {
  return /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

function validName(value: string) {
  return value.length >= 2 && value.length <= 120;
}

function Restock({
  item,
  sellerId,
  refresh,
}: {
  item: Accessory;
  sellerId: string;
  refresh: () => Promise<unknown>;
}) {
  const [quantity, setQuantity] = useState('');
  const [review, setReview] = useState<number>();
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const sending = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const confirmation = useRef<HTMLParagraphElement>(null);
  const reviewPanel = useRef<HTMLDivElement>(null);
  const qty = Number(quantity);
  const valid = /^\d+$/.test(quantity) && Number.isSafeInteger(qty) && qty > 0 && qty <= 2147483647;
  async function submit() {
    if (review === undefined || sending.current || uncertain) return;
    sending.current = true;
    setPending(true);
    setError('');
    try {
      await request(
        `/sellers/${sellerId}/flows/restock_accessory`,
        {
          p_accessory: item.id,
          p_qty: review,
        } satisfies components['schemas']['RestockAccessoryRequest'],
        false,
      );
      setMessage(`Đã bổ sung ${review} phụ kiện ${item.name}.`);
      setQuantity('');
      setReview(undefined);
    } catch (cause) {
      const rejected =
        cause instanceof ApiError && [400, 401, 403, 404, 409, 422, 429].includes(cause.status);
      setUncertain(!rejected);
      setError(
        rejected
          ? cause.message
          : 'Chưa xác định được lần bổ sung này đã ghi nhận chưa. Nhờ đội ngũ đối chiếu lịch sử trước khi bổ sung tiếp. Không gửi lại cùng số lượng.',
      );
      setReview(undefined);
    } finally {
      setPending(false);
      sending.current = false;
      confirmation.current?.focus();
      await refresh();
    }
  }
  const [open, setOpen] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editPrice, setEditPrice] = useState(String(item.price));
  const [crudBusy, setCrudBusy] = useState(false);
  const [crudNotice, setCrudNotice] = useState('');
  const [crudError, setCrudError] = useState('');

  async function saveMetadata(event: React.FormEvent) {
    event.preventDefault();
    if (crudBusy) return;
    const trimmedName = editName.trim();
    const numericPrice = Number(editPrice);
    if (!validName(trimmedName)) {
      setCrudError('Tên phụ kiện từ 2 đến 120 ký tự.');
      return;
    }
    if (!validPrice(editPrice)) {
      setCrudError('Nhập giá phụ kiện là số nguyên lớn hơn 0.');
      return;
    }
    setCrudBusy(true);
    setCrudError('');
    setCrudNotice('');
    try {
      await request(
        `/sellers/${sellerId}/accessories/${item.id}`,
        { name: trimmedName, price: numericPrice },
        false,
        'PUT',
      );
      setCrudNotice('Đã cập nhật thông tin phụ kiện.');
      await refresh();
    } catch (cause) {
      setCrudError(cause instanceof ApiError ? cause.message : 'Chưa lưu được phụ kiện.');
    } finally {
      setCrudBusy(false);
    }
  }

  async function toggleStatus() {
    if (crudBusy) return;
    const nextStatus = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setCrudBusy(true);
    setCrudError('');
    setCrudNotice('');
    try {
      await request(
        `/sellers/${sellerId}/accessories/${item.id}/status`,
        { status: nextStatus },
        false,
        'PATCH',
      );
      setCrudNotice(
        nextStatus === 'ACTIVE' ? 'Đã bật bán phụ kiện.' : 'Đã tạm ngừng bán phụ kiện.',
      );
      await refresh();
    } catch (cause) {
      setCrudError(
        cause instanceof ApiError ? cause.message : 'Chưa đổi được trạng thái phụ kiện.',
      );
    } finally {
      setCrudBusy(false);
    }
  }

  return (
    <li>
      <button
        type="button"
        className={`${styles.row} ${styles.accessoryGrid}`}
        aria-label={`Xem phụ kiện ${item.name}`}
        onClick={() => setOpen(true)}
      >
        <span className={styles.productIdentity}>
          <strong>{item.name}</strong>
        </span>
        <span className={styles.price}>
          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
            Number(item.price),
          )}
        </span>
        <span className={styles.stock}>{item.stockQuantity}</span>
        <span className={styles.status}>
          <span className={styles.badge} data-active={item.status === 'ACTIVE'}>
            {item.status === 'ACTIVE' ? 'Đang bán' : 'Tạm ngừng bán'}
          </span>
        </span>
        <span className={styles.arrow}>
          <ArrowRight size={16} aria-hidden="true" />
        </span>
      </button>
      {open && (
        <Modal
          open
          size="md"
          className={styles.accessoryModal}
          title={item.name}
          onClose={() => setOpen(false)}
          closeDisabled={pending || crudBusy}
        >
          <div className={styles.editor}>
            <div className="accessory-card-header">
              <h3>{item.name}</h3>
              <div className="accessory-meta-pills">
                <span
                  className="accessory-stock-pill"
                  data-empty={Number(item.stockQuantity) === 0}
                >
                  Tồn hiện tại: <strong>{item.stockQuantity}</strong>
                </span>
                <span className="accessory-price-pill">
                  {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
                    Number(item.price),
                  )}
                </span>
              </div>
            </div>

            <p className="accessory-status-strip">
              <span className="accessory-pill" data-active={item.status === 'ACTIVE'}>
                {item.status === 'ACTIVE' ? 'Phụ kiện đang bật bán' : 'Phụ kiện đang tắt bán'}
              </span>
            </p>

            <div className="accessory-edit-disclosure">
              <form className="accessory-restock-box" onSubmit={(e) => void saveMetadata(e)}>
                <div className="accessory-restock-row">
                  <label htmlFor={`accessory-name-${item.id}`}>
                    Tên phụ kiện
                    <input
                      id={`accessory-name-${item.id}`}
                      value={editName}
                      maxLength={120}
                      disabled={crudBusy}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </label>
                  <label htmlFor={`accessory-price-${item.id}`}>
                    Giá bán (VND)
                    <input
                      id={`accessory-price-${item.id}`}
                      type="number"
                      min={1}
                      step={1}
                      value={editPrice}
                      disabled={crudBusy}
                      onChange={(e) => setEditPrice(e.target.value)}
                    />
                  </label>
                </div>
                <div className="stock-actions" style={{ marginTop: '0.5rem' }}>
                  <Button type="submit" disabled={crudBusy}>
                    {crudBusy ? 'Đang lưu…' : 'Lưu phụ kiện'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={crudBusy}
                    onClick={() => void toggleStatus()}
                  >
                    {item.status === 'ACTIVE' ? 'Tắt bán phụ kiện' : 'Bật bán phụ kiện'}
                  </Button>
                </div>
                {(crudError || crudNotice) && (
                  <p
                    role={crudError ? 'alert' : 'status'}
                    className={crudError ? 'error' : undefined}
                  >
                    {crudError || crudNotice}
                  </p>
                )}
              </form>
            </div>

            <form
              className="accessory-restock-box"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                if (pending || uncertain) return;
                setMessage('');
                if (!valid) {
                  setError('Nhập số lượng nguyên từ 1 đến 2.147.483.647.');
                  input.current?.focus();
                  return;
                }
                setError('');
                setReview(qty);
                requestAnimationFrame(() => reviewPanel.current?.focus());
              }}
            >
              <label htmlFor={`accessory-${item.id}`}>Số lượng bổ sung cho {item.name}</label>
              {review === undefined && (
                <div className="accessory-restock-row">
                  <input
                    id={`accessory-${item.id}`}
                    ref={input}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="Nhập số lượng..."
                    value={quantity}
                    disabled={pending || uncertain}
                    onChange={(event) => setQuantity(event.target.value)}
                    aria-describedby={`accessory-notice-${item.id}`}
                    aria-invalid={!!error && !valid}
                  />
                  <Button type="submit" disabled={pending || uncertain}>
                    Kiểm tra số lượng
                  </Button>
                </div>
              )}
              {review !== undefined && (
                <div ref={reviewPanel} tabIndex={-1} className="accessory-review-panel">
                  <p>
                    Bổ sung <strong>{review}</strong> {item.name} vào kho shop?
                  </p>
                  <div className="stock-actions">
                    <Button type="button" disabled={pending} onClick={() => void submit()}>
                      {pending ? 'Đang ghi nhận…' : 'Xác nhận bổ sung'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending}
                      onClick={() => {
                        setReview(undefined);
                        requestAnimationFrame(() => input.current?.focus());
                      }}
                    >
                      Sửa số lượng
                    </Button>
                  </div>
                </div>
              )}
              <p
                id={`accessory-notice-${item.id}`}
                role={error ? 'alert' : 'status'}
                ref={confirmation}
                tabIndex={-1}
                className={error ? 'error' : undefined}
              >
                {error || message}
              </p>
            </form>
          </div>
        </Modal>
      )}
    </li>
  );
}

export default function SellerAccessories({ session }: { session: Session }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [creating, setCreating] = useState(false);
  const [createNotice, setCreateNotice] = useState('');
  const [createError, setCreateError] = useState('');

  const inventory = useQuery({
    queryKey: ['seller-accessories', session.sellerId, 'SHOP'],
    queryFn: () => request<Accessory[]>(`/sellers/${session.sellerId}/accessories?scope=SHOP`),
    enabled: !!session.sellerId,
    refetchOnMount: 'always',
  });
  function refreshInventory() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ['seller-accessories', session.sellerId] }),
      queryClient.invalidateQueries({ queryKey: ['preorder-accessories', session.sellerId] }),
    ]);
  }

  async function handleCreateAccessory(event: React.FormEvent) {
    event.preventDefault();
    if (!session.sellerId || creating) return;
    const trimmedName = newName.trim();
    const numericPrice = Number(newPrice);
    if (!validName(trimmedName)) {
      setCreateError('Tên phụ kiện từ 2 đến 120 ký tự.');
      return;
    }
    if (!validPrice(newPrice)) {
      setCreateError('Nhập giá phụ kiện là số nguyên lớn hơn 0.');
      return;
    }
    setCreating(true);
    setCreateError('');
    setCreateNotice('');
    try {
      await request<{ id: string }>(
        `/sellers/${session.sellerId}/accessories`,
        {
          name: trimmedName,
          price: numericPrice,
        } satisfies components['schemas']['CreateSellerAccessory'],
        true,
        'POST',
      );
      setNewName('');
      setNewPrice('');
      setSearch('');
      setCreateNotice(`Đã thêm phụ kiện ${trimmedName}.`);
      setCreateOpen(false);
      await refreshInventory();
    } catch (cause) {
      setCreateError(cause instanceof ApiError ? cause.message : 'Chưa tạo được phụ kiện mới.');
    } finally {
      setCreating(false);
    }
  }
  const items = inventory.data ?? [];
  const fold = (value: string) =>
    value
      .toLocaleLowerCase('vi-VN')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd');
  const visible = items.filter(
    (item) =>
      fold(item.name).includes(fold(search.trim())) && (status === 'ALL' || item.status === status),
  );
  if (!session.sellerId) return null;
  return (
    <div className={styles.catalog} role="region" aria-label="Kho phụ kiện">
      {createNotice && (
        <p className={styles.notice} role="status">
          {createNotice}
        </p>
      )}
      <div className={styles.surface}>
        <div className={styles.toolbar}>
          <label className={styles.searchField}>
            <span>Tìm phụ kiện</span>
            <span className={styles.searchInput}>
              <Search size={18} aria-hidden="true" />
              <input
                id="accessory-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tên phụ kiện"
              />
            </span>
          </label>
          <label className={styles.stateField} htmlFor="accessory-state">
            <span>Trạng thái</span>
            <Select
              id="accessory-state"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="ALL">Tất cả</option>
              <option value="ACTIVE">Đang bán</option>
              <option value="INACTIVE">Tạm ngừng bán</option>
            </Select>
          </label>
          <Button
            type="button"
            onClick={() => {
              setCreateNotice('');
              setCreateOpen(true);
            }}
          >
            <Plus size={17} aria-hidden="true" />
            Thêm phụ kiện
          </Button>
          <IconActionButton
            action="reload"
            label="Tải lại phụ kiện"
            disabled={inventory.isFetching}
            onClick={() => void inventory.refetch()}
          />
        </div>
        <div className={`${styles.columns} ${styles.accessoryGrid}`} aria-hidden="true">
          <span>Phụ kiện</span>
          <span>Giá bán</span>
          <span>Tồn tại shop</span>
          <span>Trạng thái</span>
          <span />
        </div>
        {inventory.isPending && (
          <p className={styles.empty} role="status">
            Đang tải phụ kiện…
          </p>
        )}
        {inventory.isError && (
          <div className={styles.empty} role="alert">
            <p>Chưa tải được tồn mới nhất.</p>
            <Button
              variant="outline"
              disabled={inventory.isFetching}
              onClick={() => void inventory.refetch()}
            >
              Thử lại
            </Button>
          </div>
        )}
        {inventory.isSuccess && !visible.length && (
          <div className={styles.empty} role="status">
            <strong>{items.length ? 'Không tìm thấy phụ kiện phù hợp' : 'Chưa có phụ kiện'}</strong>
            <p>
              {items.length
                ? 'Thử đổi từ khóa hoặc trạng thái.'
                : 'Thêm phụ kiện đầu tiên cho cửa hàng.'}
            </p>
          </div>
        )}
        <ul className={styles.list}>
          {visible.map((item) => (
            <Restock
              key={item.id}
              item={item}
              sellerId={session.sellerId!}
              refresh={refreshInventory}
            />
          ))}
        </ul>
      </div>
      {createOpen && (
        <Modal
          open
          size="sm"
          className={styles.accessoryModal}
          title="Thêm phụ kiện"
          closeDisabled={creating}
          onClose={() => setCreateOpen(false)}
        >
          <div className={styles.editor}>
            <form noValidate onSubmit={(event) => void handleCreateAccessory(event)}>
              <label htmlFor="new-accessory-name">
                Tên phụ kiện
                <input
                  id="new-accessory-name"
                  value={newName}
                  maxLength={120}
                  disabled={creating}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="Tên phụ kiện"
                />
              </label>
              <label htmlFor="new-accessory-price">
                Giá bán (VND)
                <input
                  id="new-accessory-price"
                  type="number"
                  min={1}
                  step={1}
                  value={newPrice}
                  disabled={creating}
                  onChange={(event) => setNewPrice(event.target.value)}
                  placeholder="Nhập giá bán"
                />
              </label>
              {createError && (
                <p role="alert" className="error">
                  {createError}
                </p>
              )}
              <div className="stock-actions">
                <Button type="submit" disabled={creating}>
                  {creating ? 'Đang thêm…' : 'Tạo phụ kiện'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={creating}
                  onClick={() => setCreateOpen(false)}
                >
                  Hủy
                </Button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}
