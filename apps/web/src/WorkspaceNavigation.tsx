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
import { workspaceBase, workspaceSections } from './workspaceSections';
import { SiteBrand } from './SiteFrame';

type Role = 'ADMIN' | 'SELLER' | 'OPERATIONS_MANAGER' | 'TECHNICIAN' | 'SELLER_STAFF';
const icons = {
  overview: LayoutDashboard,
  managers: Users,
  technicians: Users,
  staff: Users,
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
    ['Vận hành', ['managers', 'orders', 'incidents', 'tasks']],
    ['Mạng lưới', ['shops', 'slots']],
    ['Giao dịch', ['complaints', 'refunds', 'withdrawals', 'reconciliation']],
  ],
  SELLER: [
    ['Bán hoa', ['orders', 'products', 'stock', 'accessories', 'tasks']],
    ['Cửa hàng', ['staff', 'subscriptions', 'wallet']],
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
      <SiteBrand className="dashboard-brand" href={workspaceBase(role)} />
      <span className="dashboard-role">
        {role === 'ADMIN'
          ? 'Quản trị vận hành'
          : role === 'OPERATIONS_MANAGER'
            ? 'Quản lý vận hành'
            : role === 'SELLER'
              ? 'Chủ shop'
              : role === 'TECHNICIAN'
                ? 'Kỹ thuật viên'
                : 'Nhân viên shop'}
      </span>
      <Link
        href="/ho-so"
        className="dashboard-user"
        title="Xem và chỉnh sửa hồ sơ cá nhân"
        aria-label={`Hồ sơ cá nhân của ${name}`}
      >
        <span className="dashboard-avatar" aria-hidden="true">
          {name.trim().slice(0, 1).toLocaleUpperCase('vi-VN')}
        </span>
        <span>{name}</span>
      </Link>
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
  const base = workspaceBase(role);
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
        {role === 'TECHNICIAN' ? (
          <>
            <Link onKeyDown={handleEscape} href="/technician" aria-current="page">
              <ClipboardList size={19} aria-hidden="true" />
              Công việc kỹ thuật
            </Link>
            <Link onKeyDown={handleEscape} href="#technician-guide">
              <ListChecks size={19} aria-hidden="true" />
              Hướng dẫn xử lý sự cố
            </Link>
          </>
        ) : role === 'SELLER_STAFF' ? (
          <>
            <Link onKeyDown={handleEscape} href="/staff" aria-current="page">
              <ClipboardList size={19} aria-hidden="true" />
              Công việc giao hoa
            </Link>
            <Link onKeyDown={handleEscape} href="#staff-guide">
              <ListChecks size={19} aria-hidden="true" />
              Hướng dẫn làm việc
            </Link>
          </>
        ) : role === 'OPERATIONS_MANAGER' ? (
          <>
            <Link
              onKeyDown={handleEscape}
              href="/operations"
              aria-current={section === 'overview' ? 'page' : undefined}
            >
              <LayoutDashboard size={19} aria-hidden="true" />
              Tổng quan vận hành
            </Link>
            <div className="workspace-nav-group">
              <p>Vận hành kỹ thuật</p>
              <Link
                onKeyDown={handleEscape}
                href="/operations#staff-tasks"
                aria-current={section === 'tasks' ? 'page' : undefined}
              >
                <ListChecks size={19} aria-hidden="true" />
                <span>Công việc kỹ thuật</span>
              </Link>
              <Link
                onKeyDown={handleEscape}
                href="/operations/technicians"
                aria-current={section === 'technicians' ? 'page' : undefined}
              >
                <Users size={19} aria-hidden="true" />
                <span>Kỹ thuật viên</span>
              </Link>
              <Link onKeyDown={handleEscape} href="#operations-guide">
                <ClipboardList size={19} aria-hidden="true" />
                <span>Hướng dẫn điều phối</span>
              </Link>
            </div>
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
            {groups[role as 'ADMIN' | 'SELLER']?.map(([label, keys]) => (
              <div className="workspace-nav-group" key={label}>
                <p>{label}</p>
                {keys.map((key) => {
                  const item = workspaceSections[role as 'ADMIN' | 'SELLER']?.find(
                    ([id]) => id === key,
                  );
                  if (!item) return null;
                  const Icon = icons[key as keyof typeof icons];
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
          <Link onKeyDown={handleEscape} href="/ho-so">
            <Users size={19} aria-hidden="true" />
            Hồ sơ cá nhân
          </Link>
          <Link onKeyDown={handleEscape} href="/">
            <ArrowRight size={19} aria-hidden="true" />
            Về trang chủ
          </Link>
        </div>
      </nav>
    </aside>
  );
}
