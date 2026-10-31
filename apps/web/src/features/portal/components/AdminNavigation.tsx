import { useState } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  ClipboardList,
  Store,
  Boxes,
  Wallet,
  CircleAlert,
  Banknote,
  ListChecks,
  Users,
  Search,
  X,
} from '@florabot/ui';
import { workspaceSections } from '../config/workspaceSections';

const groups = [
  {
    title: 'Xử lý yêu cầu',
    items: [
      ['approvals', ClipboardList],
      ['complaints', CircleAlert],
      ['refunds', Banknote],
      ['kiosk-refunds', Banknote],
      ['withdrawals', Wallet],
    ],
  },
  {
    title: 'Theo dõi vận hành',
    items: [
      ['incidents', CircleAlert],
      ['tasks', ListChecks],
      ['orders', ClipboardList],
      ['installations', Boxes],
    ],
  },
  {
    title: 'Mạng lưới & tài khoản',
    items: [
      ['shops', Store],
      ['slots', Boxes],
      ['accounts', Users],
      ['managers', Users],
    ],
  },
  {
    title: 'Đối soát & báo cáo',
    items: [
      ['reconciliation', ListChecks],
      ['reports', LayoutDashboard],
    ],
  },
] as const;

const normalize = (value: string) =>
  value
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();

export default function AdminNavigation({
  section,
  closeMenu,
  onEscape,
}: {
  section: string;
  closeMenu: () => void;
  onEscape: (event: React.KeyboardEvent) => void;
}) {
  const [search, setSearch] = useState('');
  const needle = normalize(search);
  const filtered = groups
    .map((group) => ({
      ...group,
      items: group.items.filter(([id]) => {
        const item = workspaceSections.ADMIN.find(([key]) => key === id);
        return item && normalize(`${group.title} ${item[1]} ${item[2]}`).includes(needle);
      }),
    }))
    .filter((group) => group.items.length);
  return (
    <>
      <Link
        href="/admin"
        aria-current={section === 'overview' ? 'page' : undefined}
        onClick={closeMenu}
        onKeyDown={onEscape}
      >
        <LayoutDashboard size={18} aria-hidden="true" /> Tổng quan
      </Link>
      <div className="admin-nav-search">
        <Search size={17} aria-hidden="true" />
        <label className="sr-only" htmlFor="admin-nav-search">
          Tìm chức năng quản trị
        </label>
        <input
          id="admin-nav-search"
          type="search"
          value={search}
          placeholder="Tìm chức năng…"
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
      {filtered.map((group) => (
        <div className="workspace-nav-group" key={group.title}>
          <p>{group.title}</p>
          {group.items.map(([key, Icon]) => {
            const item = workspaceSections.ADMIN.find(([id]) => id === key)!;
            return (
              <Link
                key={key}
                href={`/admin/${key}`}
                aria-current={section === key ? 'page' : undefined}
                onClick={closeMenu}
                onKeyDown={onEscape}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{item[1]}</span>
              </Link>
            );
          })}
        </div>
      ))}
      {filtered.length === 0 && (
        <p className="admin-nav-empty" role="status">
          Không tìm thấy chức năng. Thử từ khóa “hoàn tiền” hoặc “kiosk”.
        </p>
      )}
    </>
  );
}
