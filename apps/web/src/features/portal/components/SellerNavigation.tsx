import { useState } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  ClipboardList,
  Flower2,
  Boxes,
  Users,
  ListChecks,
  MapPin,
  Banknote,
  Store,
  Package,
  MessageSquare,
  Search,
  X,
  ChevronDown,
} from '@florabot/ui';
import { workspaceSections } from '../config/workspaceSections';

const primaryGroups = [
  {
    title: 'Bán hàng',
    items: [
      ['orders', ClipboardList, ['orders']],
      ['chats', MessageSquare, ['chats', 'staff-chats']],
    ],
  },
  {
    title: 'Sản phẩm & Tủ',
    items: [
      ['products', Flower2, ['products', 'accessories']],
      ['stock', Boxes, ['stock', 'kiosks']],
    ],
  },
  {
    title: 'Đội ngũ',
    items: [['tasks', ListChecks, ['tasks', 'staff']]],
  },
  {
    title: 'Tài chính & Thuê tủ',
    items: [
      ['commerce', Banknote, ['commerce', 'refunds', 'seasonal']],
      ['subscriptions', Store, ['subscriptions', 'terminations']],
    ],
  },
] as const;

const searchGroups = [
  {
    title: 'Bán hàng',
    items: [
      ['orders', ClipboardList, ['orders']],
      ['chats', MessageSquare, ['chats']],
      ['staff-chats', MessageSquare, ['staff-chats']],
    ],
  },
  {
    title: 'Sản phẩm & Tủ',
    items: [
      ['products', Flower2, ['products']],
      ['accessories', Package, ['accessories']],
      ['stock', Boxes, ['stock']],
      ['kiosks', MapPin, ['kiosks']],
    ],
  },
  {
    title: 'Đội ngũ',
    items: [
      ['tasks', ListChecks, ['tasks']],
      ['staff', Users, ['staff']],
    ],
  },
  {
    title: 'Tài chính & Thuê tủ',
    items: [
      ['commerce', Banknote, ['commerce']],
      ['refunds', Banknote, ['refunds']],
      ['seasonal', ClipboardList, ['seasonal']],
      ['subscriptions', Store, ['subscriptions']],
      ['terminations', Store, ['terminations']],
    ],
  },
] as const;

const searchTerms: Record<string, string> = {
  stock: 'nạp hoa thu hồi hoa lấy hoa báo sự cố vị trí kiosk',
  products: 'tạo mẫu thêm hoa sản phẩm ảnh giá phụ kiện',
  orders: 'báo giá chuẩn bị đơn',
  tasks: 'giao hoa phân công nhân viên',
  commerce: 'thanh toán doanh số hoàn tiền mùa dự báo',
  subscriptions: 'thuê kiosk gói thuê chấm dứt',
};
const hubLabels: Record<string, string> = {
  chats: 'Tin nhắn',
  products: 'Mẫu hoa & phụ kiện',
  stock: 'Hoa & vị trí tủ',
  tasks: 'Nhân viên & giao việc',
  commerce: 'Thanh toán & doanh số',
};
const normalize = (value: string) =>
  value
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();

export default function SellerNavigation({
  section,
  closeMenu,
  onEscape,
  unreadChatsCount,
}: {
  section: string;
  closeMenu: () => void;
  onEscape: (event: React.KeyboardEvent) => void;
  unreadChatsCount: number;
}) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const needle = normalize(search);
  const sourceGroups = needle ? searchGroups : primaryGroups;
  const matches = sourceGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(([key]) => {
        if (!needle) return true;
        const item = workspaceSections.SELLER.find(([id]) => id === key)!;
        return normalize(`${group.title} ${item[1]} ${item[2]} ${searchTerms[key] || ''}`).includes(
          needle,
        );
      }),
    }))
    .filter((group) => group.items.length);
  return (
    <>
      <Link
        href="/seller"
        aria-label="Tổng quan cửa hàng"
        onClick={closeMenu}
        onKeyDown={onEscape}
        aria-current={section === 'overview' ? 'page' : undefined}
      >
        <LayoutDashboard size={18} aria-hidden="true" /> Tổng quan
      </Link>
      <div className="seller-nav-search">
        <Search size={17} aria-hidden="true" />
        <label className="sr-only" htmlFor="seller-nav-search">
          Tìm chức năng cửa hàng
        </label>
        <input
          id="seller-nav-search"
          type="search"
          placeholder="Tìm nhanh…"
          value={search}
          autoComplete="off"
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={onEscape}
        />
        {search && (
          <button type="button" aria-label="Xóa tìm chức năng" onClick={() => setSearch('')}>
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      {matches.map((group) => (
        <div className="workspace-nav-group" key={group.title}>
          <p>{group.title}</p>
          {group.items.map(([key, Icon, activeKeys]) => {
            const item = workspaceSections.SELLER.find(([id]) => id === key)!;
            const isCurrent = (activeKeys as readonly string[]).includes(section);
            const children = needle ? [] : activeKeys.filter((id) => id !== key);
            const isOpen = expanded[key] ?? isCurrent;
            const label = !needle ? hubLabels[key] || item[1] : item[1];
            return (
              <div key={key} className="seller-nav-item">
                <div className="seller-nav-row" data-active={isCurrent}>
                  <Link
                    href={`/seller/${key}`}
                    onClick={closeMenu}
                    onKeyDown={onEscape}
                    aria-current={section === key ? 'page' : undefined}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{label}</span>
                    {key === 'chats' && unreadChatsCount > 0 && (
                      <span
                        className="workspace-badge"
                        aria-label={`${unreadChatsCount} tin nhắn chưa đọc`}
                      >
                        {unreadChatsCount > 99 ? '99+' : unreadChatsCount}
                      </span>
                    )}
                  </Link>
                  {children.length > 0 && (
                    <button
                      type="button"
                      aria-label={`Các mục trong ${label}`}
                      aria-expanded={isOpen}
                      aria-controls={`seller-nav-${key}`}
                      onClick={() => setExpanded((current) => ({ ...current, [key]: !isOpen }))}
                      onKeyDown={onEscape}
                    >
                      <ChevronDown size={17} aria-hidden="true" />
                    </button>
                  )}
                </div>
                {children.length > 0 && (
                  <div id={`seller-nav-${key}`} className="seller-nav-children" hidden={!isOpen}>
                    {children.map((child) => (
                      <Link
                        key={child}
                        href={`/seller/${child}`}
                        onClick={closeMenu}
                        onKeyDown={onEscape}
                        aria-current={section === child ? 'page' : undefined}
                      >
                        {workspaceSections.SELLER.find(([id]) => id === child)?.[1]}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
      {matches.length === 0 && (
        <p className="seller-nav-empty" role="status">
          Không tìm thấy mục phù hợp.
        </p>
      )}
    </>
  );
}
