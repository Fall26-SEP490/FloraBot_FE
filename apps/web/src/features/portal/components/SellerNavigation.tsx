import { useState } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  ClipboardList,
  Flower2,
  Boxes,
  Users,
  Banknote,
  Store,
  MessageSquare,
  Search,
  X,
} from '@florabot/ui';
import { workspaceSections } from '../config/workspaceSections';

export interface SellerNavHub {
  key: string;
  label: string;
  icon: typeof ClipboardList;
  sections: readonly string[];
  tabs: readonly (readonly [string, string])[] | null;
}

export const sellerNavHubs: readonly { title: string; items: readonly SellerNavHub[] }[] = [
  {
    title: 'Bán hàng',
    items: [
      {
        key: 'orders',
        label: 'Đơn đặt trước',
        icon: ClipboardList,
        sections: ['orders'],
        tabs: null,
      },
      {
        key: 'chats',
        label: 'Tin nhắn',
        icon: MessageSquare,
        sections: ['chats', 'staff-chats'],
        tabs: [
          ['chats', 'Tin nhắn khách hàng'],
          ['staff-chats', 'Tin nhắn nhân viên'],
        ],
      },
    ],
  },
  {
    title: 'Sản phẩm & Tủ',
    items: [
      {
        key: 'products',
        label: 'Mẫu hoa & phụ kiện',
        icon: Flower2,
        sections: ['products', 'accessories'],
        tabs: [
          ['products', 'Mẫu hoa'],
          ['accessories', 'Phụ kiện đặt trước'],
        ],
      },
      {
        key: 'stock',
        label: 'Hoa tại tủ',
        icon: Boxes,
        sections: ['stock', 'kiosks'],
        tabs: [
          ['stock', 'Tồn kho tại tủ'],
          ['kiosks', 'Vị trí kiosk'],
        ],
      },
    ],
  },
  {
    title: 'Đội ngũ',
    items: [
      {
        key: 'tasks',
        label: 'Nhân viên & giao việc',
        icon: Users,
        sections: ['tasks', 'staff'],
        tabs: [
          ['tasks', 'Giao việc nhân viên'],
          ['staff', 'Nhân viên shop'],
        ],
      },
    ],
  },
  {
    title: 'Tài chính & Thuê tủ',
    items: [
      {
        key: 'commerce',
        label: 'Thanh toán & doanh số',
        icon: Banknote,
        sections: ['commerce', 'refunds', 'seasonal'],
        tabs: [
          ['commerce', 'Kênh nhận tiền & doanh số'],
          ['refunds', 'Hoàn tiền trực tiếp'],
          ['seasonal', 'Doanh số theo mùa'],
        ],
      },
      {
        key: 'subscriptions',
        label: 'Thuê kiosk',
        icon: Store,
        sections: ['subscriptions', 'terminations'],
        tabs: [
          ['subscriptions', 'Gói thuê & gia hạn'],
          ['terminations', 'Chấm dứt thuê kiosk'],
        ],
      },
    ],
  },
];

export const findSellerNavHub = (section: string): SellerNavHub | undefined => {
  for (const group of sellerNavHubs) {
    for (const hub of group.items) {
      if (hub.sections.includes(section)) return hub;
    }
  }
  return undefined;
};

const searchTerms: Record<string, string> = {
  stock: 'nạp hoa thu hồi hoa lấy hoa báo sự cố vị trí kiosk',
  products: 'tạo mẫu thêm hoa sản phẩm ảnh giá phụ kiện',
  orders: 'báo giá chuẩn bị đơn',
  tasks: 'giao hoa phân công nhân viên tài khoản',
  commerce: 'thanh toán doanh số hoàn tiền mùa dự báo',
  subscriptions: 'thuê kiosk gói thuê chấm dứt',
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
  const matches = sellerNavHubs
    .map((group) => ({
      ...group,
      items: group.items.filter((hub) => {
        if (!needle) return true;
        const subText = hub.sections
          .map((secKey) => {
            const found = workspaceSections.SELLER.find(([id]) => id === secKey);
            return found ? `${found[1]} ${found[2]} ${searchTerms[secKey] || ''}` : '';
          })
          .join(' ');
        return normalize(`${group.title} ${hub.label} ${subText}`).includes(needle);
      }),
    }))
    .filter((group) => group.items.length > 0);

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
          {group.items.map((hub) => {
            const Icon = hub.icon;
            const isCurrent = (hub.sections as readonly string[]).includes(section);
            return (
              <Link
                key={hub.key}
                href={`/seller/${hub.key}`}
                onClick={closeMenu}
                onKeyDown={onEscape}
                aria-current={isCurrent ? 'page' : undefined}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{hub.label}</span>
                {hub.key === 'chats' && unreadChatsCount > 0 && (
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
          Không tìm thấy mục phù hợp.
        </p>
      )}
    </>
  );
}
