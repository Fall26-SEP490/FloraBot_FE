'use client';

import { catalogReturnPath } from '../catalog.navigation';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  LogIn,
  MapPin,
  Minus,
  Plus,
  Package,
  ShieldCheck,
} from '@florabot/ui';
import { ApiError, queryClient, request, sessionQuery } from '@/shared/lib/api';
import type { CatalogItem, CatalogResponse } from '../catalog.types';
import { formatPrice, isPreorder, isPreorderSoldOut, isWalkIn } from '../catalog.utils';
import type { components } from '../../../../../../packages/contracts/src/generated/api';
import { fetchPublicKiosks } from '../../kiosk-location/kiosk-location.api';

type AvailabilityResponse = components['schemas']['KioskPreorderAvailabilityResponse'];
type AccessoryInput = components['schemas']['PreorderAccessoryInput'];
type AccessoryCatalog = components['schemas']['PreorderAccessoryCatalogItem'][];

const briefSuggestions = [
  { label: 'Sinh nhật', text: 'Tặng sinh nhật, hoa tông pastel' },
  { label: 'Kỷ niệm', text: 'Kỷ niệm ngày cưới, hoa hồng đỏ' },
  { label: 'Khai trương', text: 'Chúc mừng khai trương, hoa màu tươi sáng' },
  { label: 'Tặng gia đình', text: 'Tặng gia đình, hoa tông ấm' },
];

function isValidPickupTime(pickup: Date) {
  const delay = pickup.getTime() - Date.now();
  return Number.isFinite(delay) && delay > 0 && delay <= 30 * 24 * 60 * 60 * 1000;
}
function isoDay(value: string) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return '';
  const [day, month, year] = value.split('/').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    : '';
}

function distanceOrder(lat: number, lon: number, origin: GeolocationCoordinates) {
  const rad = Math.PI / 180;
  return (
    Math.sin(((lat - origin.latitude) * rad) / 2) ** 2 +
    Math.cos(lat * rad) *
      Math.cos(origin.latitude * rad) *
      Math.sin(((lon - origin.longitude) * rad) / 2) ** 2
  );
}

interface FlowerRequestFormProps {
  item: CatalogItem;
  onOpenChat?: () => void;
  openingChat?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
  onUncertainChange?: (uncertain: boolean) => void;
}

export function FlowerRequestForm({
  item,
  onOpenChat,
  openingChat,
  onDirtyChange,
  onBusyChange,
  onUncertainChange,
}: FlowerRequestFormProps) {
  const session = useQuery(sessionQuery);
  const [chosenKioskId, setChosenKioskId] = useState('');
  const kiosks = useQuery({
    queryKey: ['catalog-pickup-kiosks', item.productId, item.sellerId],
    enabled: !item.isDemoSample && isPreorder(item),
    refetchInterval: 60_000,
    queryFn: async () => {
      const matches = new Map<string, CatalogItem>();
      let page = 1;
      let hasMore = true;
      while (hasMore && page <= 100) {
        const result = await request<CatalogResponse>(
          `/shop/catalog?page=${page}&search=${encodeURIComponent(item.name)}`,
        );
        for (const entry of result.items) {
          if (
            entry.productId === item.productId &&
            entry.sellerId === item.sellerId &&
            isPreorder(entry)
          ) {
            matches.set(entry.kioskId, entry);
          }
        }
        hasMore = result.hasMore;
        page++;
      }
      if (hasMore) throw new Error('Danh sách tủ nhận quá dài; chưa tải hết.');
      return [...matches.values()];
    },
  });

  const candidateKiosks = (kiosks.data ?? []).filter((entry) => !isPreorderSoldOut(entry));
  const kioskAvailability = useQuery({
    queryKey: [
      'catalog-kiosk-availability',
      item.productId,
      item.sellerId,
      candidateKiosks.map((k) => k.kioskId).sort(),
    ],
    enabled: candidateKiosks.length > 0,
    queryFn: async () => {
      const checks = await Promise.allSettled(
        candidateKiosks.map(async (entry) => {
          const resp = await request<AvailabilityResponse>(
            `/kiosks/${entry.kioskId}/preorder-availability`,
          );
          return { entry, resp };
        }),
      );
      if (checks.length > 0 && checks.every((check) => check.status === 'rejected'))
        throw new Error('Chưa kiểm tra được sức chứa tại các tủ nhận.');
      const available: CatalogItem[] = [];
      for (const result of checks) {
        if (result.status === 'fulfilled' && result.value.resp?.available === true) {
          available.push(result.value.entry);
        }
      }
      return available;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const [origin, setOrigin] = useState<GeolocationCoordinates | null>(null);
  const [locationPending, setLocationPending] = useState(false);
  const [locationError, setLocationError] = useState('');
  const directory = useQuery({
    queryKey: ['public-kiosks'],
    queryFn: fetchPublicKiosks,
    enabled: origin !== null,
    staleTime: 60_000,
  });
  const coordinates = new Map(directory.data?.map((kiosk) => [kiosk.id, kiosk]));
  function distance(entry: CatalogItem) {
    const point = coordinates.get(entry.kioskId);
    return origin &&
      point &&
      typeof point.latitude === 'number' &&
      typeof point.longitude === 'number'
      ? distanceOrder(point.latitude, point.longitude, origin)
      : Number.POSITIVE_INFINITY;
  }
  function distanceLabel(entry: CatalogItem) {
    const value = distance(entry);
    if (!Number.isFinite(value)) return '';
    const km = 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(value)));
    return km < 1
      ? `Khoảng ${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`
      : `Khoảng ${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(km)} km`;
  }
  const eligibleKiosks = [...(kioskAvailability.data ?? [])].sort((a, b) => {
    const first = distance(a);
    const second = distance(b);
    return first === second ? a.kioskName.localeCompare(b.kioskName, 'vi') : first - second;
  });
  const kioskListLoading =
    kiosks.isPending || (candidateKiosks.length > 0 && kioskAvailability.isPending);
  const kioskListError = kiosks.isError || kioskAvailability.isError;
  const noKiosksAvailable = !kioskListLoading && !kioskListError && eligibleKiosks.length === 0;
  const nearestKiosk =
    origin && !locationPending && !locationError && directory.isSuccess
      ? eligibleKiosks.find((entry) => Number.isFinite(distance(entry)))
      : undefined;

  const selectedKiosk = chosenKioskId
    ? eligibleKiosks.find((entry) => entry.kioskId === chosenKioskId)
    : eligibleKiosks.length === 1
      ? eligibleKiosks[0]
      : undefined;
  const kioskId = selectedKiosk?.kioskId ?? '';
  const [accessorySelection, setAccessorySelection] = useState<{
    kioskId: string;
    items: AccessoryInput[];
  }>({ kioskId: '', items: [] });
  const [kioskChangeNotice, setKioskChangeNotice] = useState('');
  const selectedAccessories =
    accessorySelection.kioskId === kioskId ? accessorySelection.items : [];
  function chooseKiosk(nextKioskId: string) {
    if (nextKioskId === kioskId) return;
    setKioskChangeNotice(
      selectedAccessories.length
        ? 'Phụ kiện ở tủ cũ đã được bỏ. Bạn có thể chọn lại phụ kiện tại tủ này.'
        : '',
    );
    setChosenKioskId(nextKioskId);
    setAccessorySelection({ kioskId: nextKioskId, items: [] });
    setError('');
  }
  const accessories = useQuery({
    queryKey: ['preorder-accessories', kioskId],
    enabled: Boolean(kioskId && session.data?.role === 'CUSTOMER'),
    queryFn: async () => {
      const catalog = await request<AccessoryCatalog>(
        `/member/kiosks/${kioskId}/catalog/accessories`,
      );
      if (!Array.isArray(catalog)) throw new Error('Danh sách phụ kiện không hợp lệ.');
      return catalog;
    },
    refetchOnMount: 'always',
    retry: false,
  });
  const invalidAccessories = selectedAccessories.some(({ accessoryId, quantity }) => {
    const entry = accessories.data?.find(({ id }) => id === accessoryId);
    return !entry || Number(quantity) > Number(entry.availableQuantity);
  });
  function setAccessoryQuantity(accessoryId: string, quantity: number) {
    const other = selectedAccessories.filter((entry) => entry.accessoryId !== accessoryId);
    setAccessorySelection({
      kioskId,
      items: quantity > 0 ? [...other, { accessoryId, quantity }] : other,
    });
    setError('');
  }
  function refreshKiosks() {
    void kiosks.refetch().then(() => {
      if (candidateKiosks.length > 0) void kioskAvailability.refetch();
    });
  }
  function locate() {
    setLocationError('');
    if (!window.isSecureContext) {
      setLocationError(
        'Trình duyệt cần kết nối HTTPS để lấy vị trí. Bạn vẫn có thể chọn tủ theo tên.',
      );
      return;
    }
    if (!navigator.geolocation) {
      setLocationError('Trình duyệt này không hỗ trợ lấy vị trí. Bạn có thể chọn tủ theo tên.');
      return;
    }
    setLocationPending(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOrigin(position.coords);
        setLocationPending(false);
        void directory.refetch();
      },
      (cause) => {
        setLocationError(
          cause.code === 1
            ? 'Bạn chưa cho phép truy cập vị trí. Bật quyền vị trí trong trình duyệt rồi thử lại, hoặc chọn tủ theo tên.'
            : cause.code === 3
              ? 'Lấy vị trí quá lâu. Bạn có thể thử lại hoặc chọn tủ theo tên.'
              : 'Chưa xác định được vị trí của bạn. Bật định vị rồi thử lại hoặc chọn tủ theo tên.',
        );
        setLocationPending(false);
      },
      { timeout: 10_000, maximumAge: 30_000 },
    );
  }
  const [pickupDay, setPickupDay] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const pickupISO = isoDay(pickupDay);
  const pickup = pickupISO && pickupTime ? `${pickupISO}T${pickupTime}` : '';
  const pickupDateForEstimate = pickup ? new Date(pickup) : null;
  const availability = useQuery({
    queryKey: ['preorder-availability', kioskId, pickup],
    enabled: Boolean(
      kioskId && pickupDateForEstimate && Number.isFinite(pickupDateForEstimate.getTime()),
    ),
    queryFn: () =>
      request<AvailabilityResponse>(
        `/kiosks/${kioskId}/preorder-availability?pickupAt=${encodeURIComponent(new Date(pickup).toISOString())}`,
      ),
    staleTime: 15_000,
  });
  const [instructions, setInstructions] = useState('');
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [stockConflictKiosk, setStockConflictKiosk] = useState<string | null>(null);
  // A retry of an unconfirmed request can still succeed with its existing request ID.
  const soldOut =
    !uncertain &&
    ((stockConflictKiosk !== null && (!kioskId || stockConflictKiosk === kioskId)) ||
      isPreorderSoldOut(selectedKiosk ?? item));
  const [error, setError] = useState('');
  const [pickupError, setPickupError] = useState('');
  const [briefError, setBriefError] = useState('');
  const pickupRef = useRef<HTMLInputElement>(null);
  const [calendarNow, setCalendarNow] = useState(Date.now);
  const timeRef = useRef<HTMLInputElement>(null);
  const briefRef = useRef<HTMLTextAreaElement>(null);
  const [done, setDone] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const dirty =
    !done &&
    Boolean(pickupDay || pickupTime || instructions || chosenKioskId || selectedAccessories.length);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);
  useEffect(() => {
    onUncertainChange?.(uncertain);
  }, [uncertain, onUncertainChange]);

  // Keep the same request identity and payload after a network timeout.
  const pending = useRef<{
    id: string;
    kind: 'CUSTOM';
    productId: string;
    kioskId: string;
    pickupAt: string;
    instructions: string;
    accessories?: AccessoryInput[];
  } | null>(null);
  const sending = useRef(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sending.current || !isPreorder(item) || item.isDemoSample || soldOut) return;
    setError('');
    setPickupError('');
    setBriefError('');
    if (!pending.current) {
      if (!selectedKiosk || kioskListLoading || kioskListError) {
        setError('Chưa xác minh được tủ nhận hoa. Hãy tải lại danh sách tủ.');
        return;
      }
      if (invalidAccessories || (accessories.isError && selectedAccessories.length)) {
        setError('Kiểm tra lại phụ kiện đã chọn hoặc bỏ phụ kiện để tiếp tục.');
        return;
      }
      const pickupDate = new Date(pickup);
      if (!isValidPickupTime(pickupDate)) {
        setPickupError('Chọn thời gian nhận trong tương lai, tối đa 30 ngày tới.');
        if (pickupDay && !pickupTime) timeRef.current?.focus();
        else pickupRef.current?.focus();
        return;
      }
      if (availability.data && availability.data.available === false) {
        setError(availability.data.message || 'Tủ nhận hiện không còn sức chứa đặt trước.');
        return;
      }
      const brief = instructions.trim();
      if (brief.length < 10 || brief.length > 2000) {
        setBriefError('Nhập mong muốn từ 10 đến 2.000 ký tự để shop báo giá.');
        briefRef.current?.focus();
        return;
      }

      pending.current = {
        id: crypto.randomUUID(),
        kind: 'CUSTOM',
        productId: item.productId,
        kioskId: selectedKiosk.kioskId,
        pickupAt: pickupDate.toISOString(),
        instructions: brief,
        ...(selectedAccessories.length > 0 && { accessories: selectedAccessories }),
      };
    }
    sending.current = true;
    setBusy(true);

    try {
      await request('/member/preorders', pending.current);
      setSubmittedId(pending.current.id);
      setDone(true);
      await queryClient.invalidateQueries({ queryKey: ['web-orders'] });
    } catch (cause) {
      if (
        cause instanceof ApiError &&
        cause.status === 409 &&
        cause.code === 'PREORDER_PRODUCT_OUT_OF_STOCK'
      ) {
        setStockConflictKiosk(pending.current?.kioskId ?? kioskId);
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: ['web-catalog'] }),
          queryClient.invalidateQueries({ queryKey: ['web-catalog-detail', item.productId] }),
          queryClient.invalidateQueries({ queryKey: ['landing-catalog-preview'] }),
          queryClient.invalidateQueries({
            queryKey: ['catalog-pickup-kiosks', item.productId, item.sellerId],
          }),
          queryClient.invalidateQueries({
            queryKey: ['catalog-kiosk-availability', item.productId, item.sellerId],
          }),
        ]);
      } else {
        if (
          cause instanceof ApiError &&
          cause.status === 409 &&
          pending.current?.accessories?.length
        ) {
          void accessories.refetch();
        }
        setError(
          cause instanceof ApiError
            ? cause.message
            : 'Chưa xác nhận được kết quả. Kiểm tra tài khoản hoặc gửi lại cùng yêu cầu.',
        );
      }
      if (
        cause instanceof ApiError &&
        cause.status >= 400 &&
        cause.status < 500 &&
        cause.status !== 408
      ) {
        pending.current = null;
        setUncertain(false);
      } else {
        setUncertain(true);
      }
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  if (!isPreorder(item)) {
    return (
      <div className="flower-request-notice">
        <p role="note">
          {isWalkIn(item) ? 'Chỉ mua tại kiosk' : 'Chưa xác định hình thức mua'}: {item.kioskName} —{' '}
          {item.address}
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div role="status" className="flower-request-done">
        <div className="flower-request-done-icon" aria-hidden="true">
          <Check size={24} />
        </div>
        <h3>Đã nhận yêu cầu của bạn</h3>
        <p>Shop sẽ báo giá và xác nhận lịch nhận trong tài khoản của bạn.</p>
        <p className="flower-request-pickup-hint">
          <Clock size={16} aria-hidden="true" />
          <span>Khi hoa sẵn sàng, mã nhận hoa sẽ được gửi đến email đăng nhập của bạn.</span>
        </p>
        <Link
          href={`/tai-khoan${submittedId ? `?requestId=${encodeURIComponent(submittedId)}` : ''}#web-orders`}
        >
          Xem yêu cầu vừa gửi
        </Link>
      </div>
    );
  }

  if (item.isDemoSample) {
    return (
      <div className="flower-request-notice">
        <p role="note">
          Mẫu minh họa để xem giao diện. Không tạo đơn, thanh toán hoặc tin nhắn cho mẫu này.
        </p>
      </div>
    );
  }

  if (!session.data) {
    const params = new URLSearchParams({ order: '1' });
    const current = new URL(window.location.href);
    const from = catalogReturnPath(
      current.pathname === '/dat-hoa'
        ? current.pathname + current.search
        : current.searchParams.get('from'),
    );
    if (from !== '/dat-hoa') params.set('from', from);
    if (item.zone) params.set('zone', item.zone);
    const returnUrl = `/dat-hoa/${encodeURIComponent(item.productId)}/${encodeURIComponent(item.kioskId)}?${params}`;
    const authQuery = `?returnUrl=${encodeURIComponent(returnUrl)}`;
    return (
      <div className="flower-request-guest-card">
        <div className="flower-request-guest-icon-badge">
          <LogIn size={26} aria-hidden="true" />
        </div>
        <div className="flower-request-guest-content">
          <h3 className="flower-request-guest-title">Đăng nhập để gửi yêu cầu báo giá</h3>
          <p className="flower-request-guest-desc">
            Đăng nhập để nhận báo giá từ shop và theo dõi đơn đặt hoa của bạn.
          </p>
          <div className="flower-request-guest-trust-list">
            <div className="flower-request-trust-item">
              <ShieldCheck size={16} className="flower-request-trust-icon" aria-hidden="true" />
              <span>Chưa cần thanh toán · Miễn phí gửi yêu cầu</span>
            </div>
            <div className="flower-request-trust-item">
              <CheckCircle2 size={16} className="flower-request-trust-icon" aria-hidden="true" />
              <span>Trao đổi mẫu và yêu cầu với shop</span>
            </div>
          </div>
          <Link
            className="button button-primary flower-request-guest-login-btn"
            href={`/dang-nhap${authQuery}`}
          >
            Đăng nhập để tiếp tục →
          </Link>
          <p className="flower-request-guest-register-text">
            Chưa có tài khoản?{' '}
            <Link className="flower-request-register-link" href={`/dang-ky${authQuery}`}>
              Tạo tài khoản mới
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (session.data.role !== 'CUSTOMER') {
    return (
      <div className="flower-request-notice">
        <p>Hãy dùng tài khoản thành viên để mua hoa. Tài khoản hiện tại dành cho vận hành.</p>
      </div>
    );
  }

  return (
    <form className="flower-request-form" noValidate onSubmit={(event) => void submit(event)}>
      <div className="flower-request-scroll">
        <div className="flower-request-intro">
          <div className="flower-request-intro-text">
            <div className="flower-request-intro-badge">
              <ShieldCheck size={15} aria-hidden="true" />
              <strong>Bạn chưa cần thanh toán</strong>
            </div>
            <p>Shop sẽ gửi báo giá và lịch nhận để bạn kiểm tra.</p>
          </div>
          <div className="flower-request-reference-price">
            <span>Giá mẫu</span>
            <strong>{formatPrice(item.price)} đ</strong>
          </div>
        </div>
        <fieldset disabled={busy || uncertain}>
          <legend className="sr-only">Đặt trước, shop chuẩn bị theo yêu cầu</legend>
          <div className="flower-request-field">
            <label htmlFor={`kiosk-${item.productId}`}>Tủ nhận hoa</label>
            <select
              id={`kiosk-${item.productId}`}
              value={selectedKiosk?.kioskId ?? ''}
              disabled={kioskListLoading || kioskListError || noKiosksAvailable}
              onChange={(event) => chooseKiosk(event.target.value)}
              required
            >
              <option value="" disabled>
                {noKiosksAvailable ? 'Không có tủ nhận khả dụng' : 'Chọn tủ nhận hoa'}
              </option>
              {eligibleKiosks.map((entry) => (
                <option key={entry.kioskId} value={entry.kioskId}>
                  {entry.kioskName}
                  {origin && distanceLabel(entry) ? ` · ${distanceLabel(entry)}` : ''}
                </option>
              ))}
            </select>
            {kioskListLoading && <p role="status">Đang kiểm tra tủ nhận khả dụng…</p>}
            {kioskListError && (
              <p role="alert">Chưa tải được danh sách tủ nhận. Vui lòng thử lại.</p>
            )}
            {noKiosksAvailable && (
              <p role="alert">Tất cả tủ nhận hiện không khả dụng. Thử tải lại sau.</p>
            )}
            {(kioskListError || noKiosksAvailable) && (
              <Button type="button" variant="outline" onClick={refreshKiosks}>
                Tải lại tủ nhận
              </Button>
            )}
            {(selectedKiosk?.address || eligibleKiosks.length > 1) && (
              <div className="flower-request-kiosk-tools">
                {selectedKiosk?.address && (
                  <p className="flower-request-kiosk-address">
                    <MapPin size={16} aria-hidden="true" />
                    <span>{selectedKiosk.address}</span>
                  </p>
                )}
                {eligibleKiosks.length > 1 && !kioskListError && (
                  <Button
                    type="button"
                    variant="outline"
                    className="flower-request-text-action"
                    onClick={locate}
                    disabled={locationPending || (Boolean(origin) && directory.isFetching)}
                  >
                    {locationPending
                      ? 'Đang lấy vị trí…'
                      : origin && directory.isFetching
                        ? 'Đang tìm tủ…'
                        : 'Tìm tủ gần tôi'}
                  </Button>
                )}
              </div>
            )}
            {locationError && <p role="status">{locationError}</p>}
            {!locationError && origin && directory.isError && (
              <p role="status">
                Đã lấy được vị trí, nhưng chưa tải được tọa độ tủ. Bấm “Tìm tủ gần tôi” để thử lại.
              </p>
            )}
            {!locationError &&
              origin &&
              directory.isSuccess &&
              !locationPending &&
              !nearestKiosk && (
                <p role="status">
                  Các tủ khả dụng chưa có tọa độ để so khoảng cách. Bạn có thể chọn theo tên.
                </p>
              )}
            {nearestKiosk && !directory.isFetching && (
              <div className="flower-request-nearest">
                <MapPin size={18} aria-hidden="true" />
                <p role="status">
                  <span className="flower-request-nearest-label">
                    {nearestKiosk.kioskId === kioskId
                      ? 'Đã chọn tủ gần nhất'
                      : 'Tủ nhận gần nhất của shop'}
                  </span>
                  <strong>{nearestKiosk.kioskName}</strong>
                  <span>{distanceLabel(nearestKiosk)} theo đường thẳng từ vị trí của bạn.</span>
                </p>
                {nearestKiosk.kioskId !== kioskId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => chooseKiosk(nearestKiosk.kioskId)}
                  >
                    Chọn tủ này
                  </Button>
                )}
              </div>
            )}
            {kioskChangeNotice && <p role="status">{kioskChangeNotice}</p>}
          </div>
          <div className="flower-request-field">
            <div className="flower-request-date-fields">
              <div>
                <label htmlFor={`pickup-${item.productId}`}>Ngày nhận hoa</label>
                <div className="flower-request-calendar-field">
                  <input
                    id={`pickup-${item.productId}`}
                    ref={pickupRef}
                    type="text"
                    inputMode="numeric"
                    placeholder="dd/mm/yyyy"
                    maxLength={10}
                    required
                    value={pickupDay}
                    onChange={(event) => {
                      const digits = event.target.value.replace(/\D/g, '').slice(0, 8);
                      setPickupDay(
                        [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)]
                          .filter(Boolean)
                          .join('/'),
                      );
                      setPickupError('');
                    }}
                    aria-invalid={Boolean(pickupError)}
                    aria-describedby={
                      pickupError
                        ? `pickup-error-${item.productId}`
                        : `pickup-hint-${item.productId}`
                    }
                  />
                  <div className="flower-request-calendar-trigger">
                    <CalendarDays size={18} aria-hidden="true" />
                    <input
                      type="date"
                      aria-label="Chọn ngày trên lịch"
                      min={new Date(calendarNow - new Date(calendarNow).getTimezoneOffset() * 60000)
                        .toISOString()
                        .slice(0, 10)}
                      max={new Date(
                        calendarNow +
                          30 * 86400000 -
                          new Date(calendarNow).getTimezoneOffset() * 60000,
                      )
                        .toISOString()
                        .slice(0, 10)}
                      value={pickupISO}
                      onFocus={() => setCalendarNow(Date.now())}
                      onClick={(event) => {
                        try {
                          event.currentTarget.showPicker?.();
                        } catch {
                          /* Native input remains available. */
                        }
                      }}
                      onChange={(event) => {
                        setPickupDay(event.target.value.split('-').reverse().join('/'));
                        setPickupError('');
                      }}
                    />
                  </div>
                </div>
              </div>
              <div>
                <label htmlFor={`pickup-time-${item.productId}`}>Giờ nhận hoa</label>
                <input
                  id={`pickup-time-${item.productId}`}
                  ref={timeRef}
                  type="time"
                  lang="vi-VN"
                  required
                  value={pickupTime}
                  onChange={(event) => {
                    setPickupTime(event.target.value);
                    setPickupError('');
                  }}
                  aria-invalid={Boolean(pickupError)}
                  aria-describedby={
                    pickupError ? `pickup-error-${item.productId}` : `pickup-hint-${item.productId}`
                  }
                />
              </div>
            </div>
            {!pickupError && (
              <p className="quiet" id={`pickup-hint-${item.productId}`}>
                Shop sẽ xác nhận giờ nhận cùng báo giá.
              </p>
            )}
            {pickupError && (
              <p
                className="flower-request-field-error"
                role="alert"
                id={`pickup-error-${item.productId}`}
              >
                {pickupError}
              </p>
            )}
            {availability.isFetching && <p role="status">Đang kiểm tra sức chứa tủ…</p>}
            {availability.data?.available === false && (
              <p className="flower-request-field-error" role="alert">
                {availability.data.message || 'Tủ đã hết chỗ. Bạn có thể chọn tủ hoặc giờ khác.'}
              </p>
            )}
            {availability.isError && (
              <p role="status" className="quiet">
                Chưa kiểm tra được sức chứa. Hệ thống sẽ xác nhận lại khi bạn duyệt báo giá.
              </p>
            )}
          </div>
          <div className="flower-request-field">
            <label htmlFor={`brief-${item.productId}`}>Bạn muốn bó hoa như thế nào?</label>
            <textarea
              id={`brief-${item.productId}`}
              ref={briefRef}
              minLength={10}
              maxLength={2000}
              required
              value={instructions}
              onChange={(event) => {
                setInstructions(event.target.value);
                setBriefError('');
              }}
              placeholder="Ví dụ: Tặng sinh nhật, hoa hồng tông pastel, ngân sách 400.000 đ…"
              aria-invalid={Boolean(briefError)}
              aria-describedby={`brief-hint-${item.productId}${briefError ? ` brief-error-${item.productId}` : ''}`}
            />
            {briefError && (
              <p
                className="flower-request-field-error"
                role="alert"
                id={`brief-error-${item.productId}`}
              >
                {briefError}
              </p>
            )}
            <div className="flower-request-quick-tags" role="group" aria-label="Gợi ý nội dung">
              {briefSuggestions.map(({ label, text }) => {
                const added = instructions
                  .toLocaleLowerCase('vi-VN')
                  .includes(text.toLocaleLowerCase('vi-VN'));
                const next = instructions.trim() ? `${instructions.trimEnd()}\n${text}` : text;
                return (
                  <button
                    key={label}
                    type="button"
                    className="quick-tag-btn"
                    aria-disabled={added || next.length > 2000}
                    onClick={() => {
                      if (added || next.length > 2000) return;
                      setInstructions(next);
                      setBriefError('');
                    }}
                  >
                    {added ? (
                      <Check size={14} aria-hidden="true" />
                    ) : (
                      <Plus size={14} aria-hidden="true" />
                    )}
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="quiet sr-only" id={`brief-hint-${item.productId}`}>
              Nhập từ 10 đến 2.000 ký tự.
            </p>
          </div>
          {selectedKiosk && (
            <section
              className="flower-request-field flower-request-accessories"
              aria-label="Phụ kiện kèm hoa"
            >
              <h3 className="flower-request-accessory-title">
                <Package size={18} aria-hidden="true" />
                Phụ kiện kèm hoa <span>Tùy chọn</span>
              </h3>
              <p className="quiet">Chọn thêm để shop chuẩn bị cùng bó hoa.</p>
              {accessories.isPending ? (
                <p role="status">Đang tải phụ kiện của tủ…</p>
              ) : accessories.isError ? (
                <>
                  <p role="status">Chưa tải được phụ kiện. Bạn có thể thử lại hoặc chỉ đặt hoa.</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void accessories.refetch()}
                  >
                    Tải lại phụ kiện
                  </Button>
                </>
              ) : accessories.data?.length ? (
                <>
                  <div className="preorder-accessory-options">
                    {accessories.data.map((entry) => {
                      const available = Math.min(2_147_483_647, Number(entry.availableQuantity));
                      const quantity = Number(
                        selectedAccessories.find(({ accessoryId }) => accessoryId === entry.id)
                          ?.quantity ?? 0,
                      );
                      const atLimit =
                        quantity >= available ||
                        (quantity === 0 && selectedAccessories.length >= 20);
                      return (
                        <div key={entry.id} className="preorder-accessory-option">
                          <span>
                            <strong>{entry.name}</strong>
                            <small>{formatPrice(Number(entry.price))} đ</small>
                            {quantity > 0 && quantity === available && (
                              <small>Đã chọn hết số lượng có sẵn</small>
                            )}
                          </span>
                          <div
                            className={`preorder-accessory-stepper ${quantity > 0 ? 'has-quantity' : ''}`}
                          >
                            {quantity > 0 && (
                              <Button
                                key="decrease"
                                type="button"
                                variant="outline"
                                aria-label={`Giảm số lượng ${entry.name}`}
                                onClick={(event) => {
                                  if (quantity === 1) {
                                    event.currentTarget.parentElement
                                      ?.querySelector<HTMLButtonElement>('[data-increase]')
                                      ?.focus({ preventScroll: true });
                                  }
                                  setAccessoryQuantity(entry.id, quantity - 1);
                                }}
                              >
                                <Minus size={16} aria-hidden="true" />
                              </Button>
                            )}
                            {quantity > 0 && (
                              <output key="quantity" aria-label={`Số lượng ${entry.name}`}>
                                {quantity}
                              </output>
                            )}
                            <Button
                              key="increase"
                              type="button"
                              variant="outline"
                              data-increase=""
                              aria-label={
                                quantity > 0
                                  ? `Tăng số lượng ${entry.name}`
                                  : available > 0
                                    ? `Thêm ${entry.name}`
                                    : `${entry.name} hết hàng`
                              }
                              aria-disabled={atLimit}
                              onClick={() => {
                                if (!atLimit) setAccessoryQuantity(entry.id, quantity + 1);
                              }}
                            >
                              {(quantity > 0 || available > 0) && (
                                <Plus size={16} aria-hidden="true" />
                              )}
                              {quantity === 0 && (available > 0 ? 'Thêm' : 'Hết hàng')}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {selectedAccessories.length >= 20 && (
                    <p className="quiet">Đã chọn tối đa 20 loại phụ kiện.</p>
                  )}
                </>
              ) : (
                <p className="quiet">Tủ này hiện không có phụ kiện.</p>
              )}
              {invalidAccessories && (
                <p role="alert">Một số phụ kiện đã đổi tồn kho. Vui lòng kiểm tra lại.</p>
              )}
              {selectedAccessories.length > 0 && (
                <div className="flower-request-accessory-summary">
                  <p>
                    Đã chọn{' '}
                    {selectedAccessories.reduce((sum, entry) => sum + Number(entry.quantity), 0)}{' '}
                    món
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="flower-request-clear-accessories"
                    onClick={() => {
                      setAccessorySelection({ kioskId, items: [] });
                      setError('');
                    }}
                  >
                    Bỏ chọn
                  </Button>
                </div>
              )}
            </section>
          )}
        </fieldset>
        <p role="alert" className="error">
          {error}
        </p>
      </div>
      {soldOut && (
        <p role="alert" className="flower-request-stock-alert">
          Mẫu hoa đã hết hàng. Bạn có thể nhắn shop hoặc chọn mẫu khác.
        </p>
      )}
      <div className="flower-request-footer">
        {!uncertain && (
          <p id={`request-ready-${item.productId}`} className="flower-request-ready" role="status">
            {!selectedKiosk
              ? kioskListLoading
                ? 'Đang kiểm tra tủ nhận…'
                : 'Chọn tủ nhận hoa để tiếp tục.'
              : !pickupISO || !pickupTime
                ? 'Chọn ngày và giờ bạn muốn nhận hoa.'
                : instructions.trim().length < 10
                  ? 'Nhập mong muốn ít nhất 10 ký tự để shop báo giá.'
                  : invalidAccessories
                    ? 'Kiểm tra lại phụ kiện đã chọn.'
                    : `${selectedKiosk.kioskName} · ${pickupDay} · ${pickupTime}`}
          </p>
        )}
        {onOpenChat && (
          <Button
            variant="outline"
            type="button"
            className="chat-open-btn"
            disabled={openingChat || busy}
            onClick={onOpenChat}
          >
            {openingChat ? 'Đang mở chat…' : 'Nhắn shop'}
          </Button>
        )}
        <Button
          type="submit"
          disabled={
            busy ||
            soldOut ||
            (!uncertain && (!selectedKiosk || kioskListLoading || kioskListError))
          }
          aria-describedby={!uncertain ? `request-ready-${item.productId}` : undefined}
          className="flower-request-submit-btn"
        >
          {busy ? 'Đang gửi…' : uncertain ? 'Gửi lại cùng yêu cầu' : 'Gửi yêu cầu báo giá'}
        </Button>
      </div>
      {uncertain && !busy && (
        <p className="flower-request-uncertain-link">
          <Link href="/tai-khoan#web-orders">Kiểm tra đơn đặt trước</Link>
        </p>
      )}
    </form>
  );
}
