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
  Wallet,
  Store,
  Package,
  MessageSquare,
  Search,
  X,
} from '@florabot/ui';
import { workspaceSections } from '../config/workspaceSections';

const groups = [
  {
    title: 'Đơn hàng & khách',
    items: [
      ['orders', ClipboardList],
      ['chats', MessageSquare],
    ],
  },
  {
    title: 'Hoa & tủ',
    items: [
      ['products', Flower2],
      ['stock', Boxes],
      ['accessories', Package],
      ['kiosks', MapPin],
    ],
  },
  {
    title: 'Nhân viên',
    items: [
      ['tasks', ListChecks],
      ['staff', Users],
      ['staff-chats', MessageSquare],
    ],
  },
  {
    title: 'Tiền & gói thuê',
    items: [
      ['wallet', Wallet],
      ['subscriptions', Store],
    ],
  },
] as const;
const searchTerms: Record<string, string> = {
  stock: 'nạp hoa thu hồi hoa lấy hoa báo sự cố',
  products: 'tạo mẫu thêm hoa sản phẩm ảnh giá',
  orders: 'báo giá chuẩn bị đơn',
  tasks: 'giao hoa phân công',
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
  const needle = normalize(search);
  const matches = groups
    .map((group) => ({
      ...group,
      items: group.items.filter(([key]) => {
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
          placeholder="Tìm việc cần làm…"
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
          {group.items.map(([key, Icon]) => {
            const item = workspaceSections.SELLER.find(([id]) => id === key)!;
            return (
              <Link
                href={`/seller/${key}`}
                key={key}
                onClick={closeMenu}
                onKeyDown={onEscape}
                aria-current={section === key ? 'page' : undefined}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{item[1]}</span>
                {key === 'chats' && unreadChatsCount > 0 && (
                  <span
                    className="workspace-badge"
                    aria-label={`${unreadChatsCount} tin nhắn chưa đọc`}
                  >
                    {unreadChatsCount > 99 ? '99+' : unreadChatsCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
      {matches.length === 0 && (
        <p className="seller-nav-empty" role="status">
          Không tìm thấy mục phù hợp. Thử “báo giá”, “nạp hoa” hoặc “rút tiền”.
        </p>
      )}
    </>
  );
}
