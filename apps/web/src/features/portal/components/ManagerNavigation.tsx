import { useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { Boxes, ClipboardList, LayoutDashboard, Search, Store, Users, X } from '@florabot/ui';
const groups = [
  {
    title: 'Xử lý công việc',
    items: [
      { key: 'installations', title: 'Hồ sơ thuê & Lắp đặt', icon: Boxes },
      { key: 'tasks', title: 'Công việc kỹ thuật', icon: ClipboardList },
      { key: 'terminations', title: 'Chấm dứt thuê kiosk', icon: Boxes },
    ],
  },
  {
    title: 'Nguồn lực & tài khoản',
    items: [
      { key: 'technicians', title: 'Kỹ thuật viên', icon: Users },
      { key: 'sellers', title: 'Quản lý shop hoa', icon: Store },
      { key: 'customers', title: 'Khách hàng', icon: Users },
    ],
  },
];
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLocaleLowerCase('vi-VN');
export default function ManagerNavigation({
  section,
  closeMenu,
  onEscape,
}: {
  section: string;
  closeMenu: () => void;
  onEscape: (event: KeyboardEvent<HTMLElement>) => void;
}) {
  const [search, setSearch] = useState('');
  const searchInput = useRef<HTMLInputElement>(null);
  const visible = groups.map((group) => ({
    ...group,
    items: group.items.filter((item) => normalize(item.title).includes(normalize(search.trim()))),
  }));
  return (
    <>
      <Link
        href="/operations"
        onClick={closeMenu}
        onKeyDown={onEscape}
        aria-current={section === 'overview' ? 'page' : undefined}
      >
        <LayoutDashboard size={19} aria-hidden="true" />
        Tổng quan vận hành
      </Link>
      <label className="manager-nav-search">
        <Search size={16} aria-hidden="true" />
        <span className="sr-only">Tìm chức năng vận hành</span>
        <input
          ref={searchInput}
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={onEscape}
          placeholder="Tìm việc cần làm…"
        />
      </label>
      {search && (
        <button
          className="manager-clear-search"
          type="button"
          onClick={() => {
            setSearch('');
            searchInput.current?.focus();
          }}
        >
          <X size={14} aria-hidden="true" />
          Xóa tìm kiếm
        </button>
      )}
      {visible.map(
        (group) =>
          group.items.length > 0 && (
            <div className="workspace-nav-group" key={group.title}>
              <p>{group.title}</p>
              {group.items.map(({ key, title, icon: Icon }) => (
                <Link
                  key={key}
                  href={`/operations/${key}`}
                  onClick={closeMenu}
                  onKeyDown={onEscape}
                  aria-current={section === key ? 'page' : undefined}
                >
                  <Icon size={19} aria-hidden="true" />
                  <span>{title}</span>
                </Link>
              ))}
            </div>
          ),
      )}
      {visible.every((group) => group.items.length === 0) && (
        <p role="status" className="manager-nav-empty">
          Không tìm thấy chức năng. Thử từ khóa khác.
        </p>
      )}
    </>
  );
}
