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
  MapPin,
  ArrowRight,
  Menu,
  X,
  LogOut,
  Button,
  MessageSquare,
  ShieldCheck,
} from '@florabot/ui';
import { useQuery } from '@tanstack/react-query';
import { workspaceBase, workspaceSections } from './workspaceSections';
import { SiteBrand } from './SiteFrame';
import { sessionQuery } from './api';
import { getSellerChats } from './chat/api';

type Role = 'ADMIN' | 'SELLER' | 'OPERATIONS_MANAGER' | 'TECHNICIAN' | 'SELLER_STAFF';
const icons = {
  overview: LayoutDashboard,
  managers: Users,
  accounts: Users,
  customers: Users,
  sellers: Store,
  technicians: Users,
  staff: Users,
  orders: ClipboardList,
  chats: MessageSquare,
  'staff-chats': MessageSquare,
  incidents: CircleAlert,
  tasks: ListChecks,
  shops: Store,
  slots: Boxes,
  complaints: CircleAlert,
  refunds: Banknote,
  'kiosk-refunds': Banknote,
  installations: Boxes,
  withdrawals: Wallet,
  reconciliation: ListChecks,
  reports: LayoutDashboard,
  products: Flower2,
  stock: Boxes,
  accessories: Package,
  kiosks: MapPin,
  subscriptions: Store,
  wallet: Wallet,
};
const groups = {
  ADMIN: [
    ['Vận hành', ['accounts', 'managers', 'orders', 'incidents', 'tasks']],
    ['Mạng lưới', ['shops', 'slots']],
    [
      'Giao dịch',
      ['complaints', 'refunds', 'kiosk-refunds', 'withdrawals', 'reconciliation', 'reports'],
    ],
  ],
  SELLER: [
    ['Bán hoa', ['orders', 'chats', 'products', 'stock', 'accessories', 'tasks']],
    ['Cửa hàng', ['staff', 'staff-chats', 'kiosks', 'subscriptions', 'wallet']],
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
      <Button
        className="dashboard-logout"
        variant="outline"
        onClick={onLogout}
        disabled={busy}
        aria-label={busy ? 'Đang đăng xuất…' : 'Đăng xuất'}
      >
        <LogOut size={18} aria-hidden="true" />
        <span>{busy ? 'Đang đăng xuất…' : 'Đăng xuất'}</span>
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
  const session = useQuery(sessionQuery);
  const sellerId = role === 'SELLER' ? session.data?.sellerId : null;
  const sellerChats = useQuery({
    queryKey: ['seller-chats', sellerId, 1],
    queryFn: () => getSellerChats(sellerId!, 1),
    enabled: Boolean(sellerId && sellerId !== '00000000-0000-0000-0000-000000000000'),
    staleTime: 30_000,
  });

  const unreadChatsCount =
    sellerChats.data?.items?.reduce((sum, item) => sum + (Number(item.unreadCount) || 0), 0) || 0;

  const [expanded, setExpanded] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const base = workspaceBase(role);
  const platformName =
    role === 'ADMIN'
      ? 'Quản trị hệ thống'
      : role === 'OPERATIONS_MANAGER'
        ? 'Điều phối vận hành'
        : role === 'TECHNICIAN'
          ? 'Đội ngũ kỹ thuật'
          : null;
  const WorkspaceIcon = role === 'ADMIN' ? ShieldCheck : role === 'TECHNICIAN' ? ListChecks : Boxes;
  const closeMenu = () => setExpanded(false);
  const handleEscape = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && expanded) {
      setExpanded(false);
      toggle.current?.focus();
    }
  };
  return (
    <aside className="workspace-sidebar">
      {platformName && (
        <div className="platform-nav-heading">
          <span>
            <WorkspaceIcon size={20} aria-hidden="true" />
          </span>
          <div>
            <small>KHÔNG GIAN LÀM VIỆC</small>
            <strong>{platformName}</strong>
          </div>
        </div>
      )}
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
            <Link
              onKeyDown={handleEscape}
              onClick={closeMenu}
              href="/technician"
              aria-current={section !== 'installations' ? 'page' : undefined}
            >
              <ClipboardList size={19} aria-hidden="true" />
              Công việc kỹ thuật
            </Link>
            <Link
              onKeyDown={handleEscape}
              onClick={closeMenu}
              href="/technician/installations"
              aria-current={section === 'installations' ? 'page' : undefined}
            >
              <Boxes size={19} aria-hidden="true" />
              Lắp đặt Kiosk
            </Link>
            <Link onKeyDown={handleEscape} onClick={closeMenu} href="/technician#technician-guide">
              <ListChecks size={19} aria-hidden="true" />
              Hướng dẫn xử lý sự cố
            </Link>
          </>
        ) : role === 'SELLER_STAFF' ? (
          <>
            <Link
              onKeyDown={handleEscape}
              onClick={closeMenu}
              href="/staff"
              aria-current={section !== 'chats' ? 'page' : undefined}
            >
              <ClipboardList size={19} aria-hidden="true" />
              Công việc giao hoa
            </Link>
            <Link
              onKeyDown={handleEscape}
              onClick={closeMenu}
              href="/staff/chats"
              aria-current={section === 'chats' ? 'page' : undefined}
            >
              <MessageSquare size={19} aria-hidden="true" />
              Nhắn với chủ shop
            </Link>
            <Link onKeyDown={handleEscape} onClick={closeMenu} href="/staff#staff-guide">
              <ListChecks size={19} aria-hidden="true" />
              Hướng dẫn làm việc
            </Link>
          </>
        ) : role === 'OPERATIONS_MANAGER' ? (
          <>
            <Link
              onKeyDown={handleEscape}
              onClick={closeMenu}
              href="/operations"
              aria-current={section === 'overview' ? 'page' : undefined}
            >
              <LayoutDashboard size={19} aria-hidden="true" />
              Tổng quan vận hành
            </Link>
            <div className="workspace-nav-group">
              <p>Quản lý tài khoản</p>
              <Link
                onKeyDown={handleEscape}
                onClick={closeMenu}
                href="/operations/sellers"
                aria-current={section === 'sellers' ? 'page' : undefined}
              >
                <Store size={19} aria-hidden="true" />
                <span>Quản lý shop hoa</span>
              </Link>
              <Link
                onKeyDown={handleEscape}
                onClick={closeMenu}
                href="/operations/customers"
                aria-current={section === 'customers' ? 'page' : undefined}
              >
                <Users size={19} aria-hidden="true" />
                <span>Khách hàng</span>
              </Link>
            </div>
            <div className="workspace-nav-group">
              <p>Điều phối kỹ thuật</p>
              <Link
                onKeyDown={handleEscape}
                onClick={closeMenu}
                href="/operations/installations"
                aria-current={section === 'installations' ? 'page' : undefined}
              >
                <Boxes size={19} aria-hidden="true" />
                <span>Hồ sơ thuê & Lắp đặt</span>
              </Link>
              <Link
                onKeyDown={handleEscape}
                onClick={closeMenu}
                href="/operations/tasks"
                aria-current={section === 'tasks' ? 'page' : undefined}
              >
                <ListChecks size={19} aria-hidden="true" />
                <span>Công việc kỹ thuật</span>
              </Link>
              <Link
                onKeyDown={handleEscape}
                onClick={closeMenu}
                href="/operations/technicians"
                aria-current={section === 'technicians' ? 'page' : undefined}
              >
                <Users size={19} aria-hidden="true" />
                <span>Kỹ thuật viên</span>
              </Link>
              <Link
                onKeyDown={handleEscape}
                onClick={closeMenu}
                href="/operations#operations-guide"
              >
                <ClipboardList size={19} aria-hidden="true" />
                <span>Hướng dẫn điều phối</span>
              </Link>
            </div>
          </>
        ) : (
          <>
            <Link
              onKeyDown={handleEscape}
              onClick={closeMenu}
              href={base}
              aria-current={section === 'overview' ? 'page' : undefined}
            >
              <LayoutDashboard size={19} aria-hidden="true" />
              {role === 'SELLER' ? 'Tổng quan cửa hàng' : 'Tổng quan'}
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
                      onClick={closeMenu}
                      key={key}
                      href={`${base}/${key}`}
                      aria-current={section === key ? 'page' : undefined}
                    >
                      <Icon size={19} aria-hidden="true" />
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
          </>
        )}
        <div className="workspace-personal-links">
          {role === 'SELLER' && (
            <Link onKeyDown={handleEscape} onClick={closeMenu} href="/tai-khoan">
              <Users size={19} aria-hidden="true" />
              Tài khoản & mua hoa
            </Link>
          )}
          <Link onKeyDown={handleEscape} onClick={closeMenu} href="/ho-so">
            <Users size={19} aria-hidden="true" />
            Hồ sơ cá nhân
          </Link>
          <Link onKeyDown={handleEscape} onClick={closeMenu} href="/">
            <ArrowRight size={19} aria-hidden="true" />
            Về trang chủ
          </Link>
        </div>
      </nav>
    </aside>
  );
}
