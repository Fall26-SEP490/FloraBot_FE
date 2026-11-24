import { useRef, useState } from 'react';
import '../styles/role-compact.css';
import AdminNavigation from './AdminNavigation';
import SellerNavigation from './SellerNavigation';
import ManagerNavigation from './ManagerNavigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ClipboardList,
  Store,
  Boxes,
  ListChecks,
  Menu,
  X,
  MessageSquare,
  ShieldCheck,
} from '@florabot/ui';
import { useQuery } from '@tanstack/react-query';
import { getSellerChats } from '@/features/chat/api';
import { getRoleLabel } from '@/features/portal/config/roleRoutes';
import { workspaceBase } from '@/features/portal/config/workspaceSections';
import { UserMenu, type UserMenuLink } from '@/shared/components/UserMenu';
import { SiteBrand } from '@/shared/layout/SiteFrame';
import { sessionQuery } from '@/shared/lib/api';

type Role = 'ADMIN' | 'SELLER' | 'OPERATIONS_MANAGER' | 'TECHNICIAN' | 'SELLER_STAFF';

function workspaceRoleLabel(role: string) {
  return role === 'ADMIN'
    ? 'Quản trị viên'
    : role === 'OPERATIONS_MANAGER'
      ? 'Quản lý vận hành'
      : getRoleLabel(role);
}

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
      <SiteBrand className="dashboard-brand" href="/" />
      <WorkspaceUserMenu role={role} name={name} busy={busy} onLogout={onLogout} />
    </header>
  );
}

export function WorkspaceUserMenu({
  role,
  name,
  busy,
  onLogout,
}: {
  role: string;
  name: string;
  busy: boolean;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const [openedPath, setOpenedPath] = useState<string | null>(null);
  const menuOpen = openedPath === pathname;
  const links: UserMenuLink[] = [{ href: '/ho-so', label: 'Hồ sơ cá nhân', icon: 'profile' }];

  return (
    <UserMenu
      className="dashboard-account"
      menuId="workspace-user-menu"
      name={name}
      roleLabel={workspaceRoleLabel(role)}
      links={links}
      busy={busy}
      onLogout={onLogout}
      open={menuOpen}
      onOpenChange={(open) => setOpenedPath(open ? pathname : null)}
    />
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
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const collapsed = !hovered && !focusWithin && !expanded;
  const compactRole = ['ADMIN', 'OPERATIONS_MANAGER', 'TECHNICIAN'].includes(role);
  const toggle = useRef<HTMLButtonElement>(null);
  const base = workspaceBase(role);
  const platformName =
    role === 'ADMIN'
      ? 'Quản trị hệ thống'
      : role === 'OPERATIONS_MANAGER'
        ? 'Điều phối vận hành'
        : role === 'TECHNICIAN'
          ? 'Đội ngũ kỹ thuật'
          : role === 'SELLER'
            ? 'Vận hành cửa hàng'
            : 'Công việc tại shop';
  const WorkspaceIcon =
    role === 'ADMIN'
      ? ShieldCheck
      : role === 'TECHNICIAN'
        ? ListChecks
        : role === 'SELLER'
          ? Store
          : role === 'SELLER_STAFF'
            ? ClipboardList
            : Boxes;
  const closeMenu = () => setExpanded(false);
  const handleEscape = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && expanded) {
      setExpanded(false);
      toggle.current?.focus();
    }
  };
  return (
    <aside
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onPointerDownCapture={() => setFocusWithin(false)}
      onFocusCapture={(event) => {
        setFocusWithin(event.target.matches(':focus-visible'));
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocusWithin(false);
      }}
      className={
        compactRole
          ? collapsed
            ? 'workspace-sidebar role-sidebar-collapsed'
            : 'workspace-sidebar role-sidebar-expanded'
          : 'workspace-sidebar'
      }
    >
      <div className="platform-nav-heading">
        <span>
          <WorkspaceIcon size={20} aria-hidden="true" />
        </span>
        <div>
          <small>KHÔNG GIAN LÀM VIỆC</small>
          <strong>{platformName}</strong>
        </div>
      </div>
      <button
        ref={toggle}
        onKeyDown={handleEscape}
        className="workspace-menu-toggle"
        aria-expanded={expanded}
        aria-controls="workspace-navigation"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        <span className={compactRole ? 'sr-only' : undefined}>
          {expanded ? 'Đóng danh mục quản lý' : 'Mở danh mục quản lý'}
        </span>
      </button>
      <nav
        id="workspace-navigation"
        className={expanded ? 'is-expanded' : ''}
        aria-label="Điều hướng quản lý"
      >
        {role === 'ADMIN' ? (
          <AdminNavigation
            section={section}
            closeMenu={closeMenu}
            onEscape={handleEscape}
            compact={collapsed}
            openGroups={compactRole}
          />
        ) : role === 'SELLER' ? (
          <SellerNavigation
            section={section}
            closeMenu={closeMenu}
            onEscape={handleEscape}
            unreadChatsCount={unreadChatsCount}
          />
        ) : role === 'TECHNICIAN' ? (
          <>
            <Link
              onKeyDown={handleEscape}
              onClick={closeMenu}
              href="/technician"
              aria-label="Công việc kỹ thuật"
              title="Công việc kỹ thuật"
              aria-current={section === 'tasks' ? 'page' : undefined}
            >
              <ClipboardList size={19} aria-hidden="true" />
              Công việc kỹ thuật
            </Link>
            <Link
              onKeyDown={handleEscape}
              onClick={closeMenu}
              href="/technician/installations"
              aria-label="Lắp đặt kiosk"
              title="Lắp đặt kiosk"
              aria-current={section === 'installations' ? 'page' : undefined}
            >
              <Boxes size={19} aria-hidden="true" />
              Lắp đặt Kiosk
            </Link>
            <Link
              onKeyDown={handleEscape}
              onClick={closeMenu}
              href="/technician/kiosk-health"
              aria-label="Sức khỏe kiosk"
              title="Sức khỏe kiosk"
              aria-current={section === 'kiosk-health' ? 'page' : undefined}
            >
              <ShieldCheck size={19} aria-hidden="true" />
              Sức khỏe kiosk
            </Link>
          </>
        ) : role === 'SELLER_STAFF' ? (
          <>
            <Link
              onKeyDown={handleEscape}
              onClick={closeMenu}
              href="/staff"
              aria-label="Công việc tại tủ"
              title="Công việc tại tủ"
              aria-current={section !== 'chats' ? 'page' : undefined}
            >
              <ClipboardList size={19} aria-hidden="true" />
              <span className="workspace-nav-label">Công việc tại tủ</span>
            </Link>
            <Link
              onKeyDown={handleEscape}
              onClick={closeMenu}
              href="/staff/chats"
              aria-label="Nhắn với chủ shop"
              title="Nhắn với chủ shop"
              aria-current={section === 'chats' ? 'page' : undefined}
            >
              <MessageSquare size={19} aria-hidden="true" />
              <span className="workspace-nav-label">Nhắn với chủ shop</span>
            </Link>
          </>
        ) : role === 'OPERATIONS_MANAGER' ? (
          <ManagerNavigation
            section={section}
            closeMenu={closeMenu}
            onEscape={handleEscape}
            compact={collapsed}
          />
        ) : (
          <Link
            onKeyDown={handleEscape}
            onClick={closeMenu}
            href={base}
            aria-current={section === 'overview' ? 'page' : undefined}
          >
            <LayoutDashboard size={19} aria-hidden="true" />
            Tổng quan
          </Link>
        )}
      </nav>
    </aside>
  );
}
