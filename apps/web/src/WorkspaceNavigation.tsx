import { useRef, useState } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  ClipboardList,
  Store,
  Boxes,
  Wallet,
  CircleAlert,
  Package,
  Banknote,
  ListChecks,
  Users,
  Flower2,
  ArrowRight,
  Menu,
  X,
  LogOut,
  Button,
} from '@florabot/ui';
import { workspaceBase, workspaceSections, type WorkspaceRole } from './workspaceSections';

type Role = WorkspaceRole | 'STAFF';
const icons = {
  overview: LayoutDashboard,
  orders: ClipboardList,
  incidents: CircleAlert,
  tasks: ListChecks,
  shops: Store,
  slots: Boxes,
  complaints: CircleAlert,
  refunds: Banknote,
  withdrawals: Wallet,
  reconciliation: ListChecks,
  products: Flower2,
  stock: Boxes,
  accessories: Package,
  subscriptions: Store,
  wallet: Wallet,
};
const groups = {
  ADMIN: [
    ['Vận hành', ['orders', 'incidents', 'tasks']],
    ['Mạng lưới', ['shops', 'slots']],
    ['Giao dịch', ['complaints', 'refunds', 'withdrawals', 'reconciliation']],
  ],
  SELLER: [
    ['Bán hoa', ['orders', 'products', 'stock', 'accessories']],
    ['Cửa hàng', ['subscriptions', 'wallet']],
  ],
} as const;

export function WorkspaceHeader({
  workspaceRole: role,
  name,
  busy,
  onLogout,
}: {
  workspaceRole: Role;
  name: string;
  busy: boolean;
  onLogout: () => void;
}) {
  return (
    <header className="dashboard-header">
      <Link className="dashboard-brand" href={role === 'STAFF' ? '/staff' : workspaceBase(role)}>
        <Flower2 size={28} aria-hidden="true" />
        FloraBot<span aria-hidden="true">.</span>
      </Link>
      <span className="dashboard-role">
        {role === 'ADMIN'
          ? 'Quản trị vận hành'
          : role === 'SELLER'
            ? 'Góc quản lý shop'
            : 'Khu vực nhân viên'}
      </span>
      <div className="dashboard-user">
        <span className="dashboard-avatar" aria-hidden="true">
          {name.trim().slice(0, 1).toLocaleUpperCase('vi-VN')}
        </span>
        <span>{name}</span>
      </div>
      <Button className="dashboard-logout" variant="outline" onClick={onLogout} disabled={busy}>
        <LogOut size={18} aria-hidden="true" />
        {busy ? 'Đang đăng xuất…' : 'Đăng xuất'}
      </Button>
    </header>
  );
}

export default function WorkspaceNavigation({
  workspaceRole: role,
  section,
}: {
  workspaceRole: Role;
  section: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const base = role === 'STAFF' ? '/staff' : workspaceBase(role);
  const handleEscape = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && expanded) {
      setExpanded(false);
      toggle.current?.focus();
    }
  };
  return (
    <aside className="workspace-sidebar">
      <button
        ref={toggle}
        onKeyDown={handleEscape}
        className="workspace-menu-toggle"
        aria-expanded={expanded}
        aria-controls="workspace-navigation"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        {expanded ? 'Đóng danh mục quản lý' : 'Mở danh mục quản lý'}
      </button>
      <nav
        id="workspace-navigation"
        className={expanded ? 'is-expanded' : ''}
        aria-label="Điều hướng quản lý"
      >
        {role === 'STAFF' ? (
          <>
            <Link onKeyDown={handleEscape} href="/staff" aria-current="page">
              <ClipboardList size={19} aria-hidden="true" />
              Công việc của tôi
            </Link>
            <Link onKeyDown={handleEscape} href="#staff-guide">
              <ListChecks size={19} aria-hidden="true" />
              Hướng dẫn làm việc
            </Link>
          </>
        ) : (
          <>
            <Link
              onKeyDown={handleEscape}
              href={base}
              aria-current={section === 'overview' ? 'page' : undefined}
            >
              <LayoutDashboard size={19} aria-hidden="true" />
              Tổng quan
            </Link>
            {groups[role].map(([label, keys]) => (
              <div className="workspace-nav-group" key={label}>
                <p>{label}</p>
                {keys.map((key) => {
                  const item = workspaceSections[role].find(([id]) => id === key);
                  if (!item) return null;
                  const Icon = icons[key];
                  return (
                    <Link
                      onKeyDown={handleEscape}
                      key={key}
                      href={`${base}/${key}`}
                      aria-current={section === key ? 'page' : undefined}
                    >
                      <Icon size={19} aria-hidden="true" />
                      <span>{item[1]}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </>
        )}
        <div className="workspace-personal-links">
          {role === 'SELLER' && (
            <Link onKeyDown={handleEscape} href="/tai-khoan">
              <Users size={19} aria-hidden="true" />
              Tài khoản & mua hoa
            </Link>
          )}
          <Link onKeyDown={handleEscape} href="/">
            <ArrowRight size={19} aria-hidden="true" />
            Về trang chủ
          </Link>
        </div>
      </nav>
    </aside>
  );
}
