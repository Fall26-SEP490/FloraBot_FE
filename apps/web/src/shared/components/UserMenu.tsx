'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getCustomerUnreadCount } from '@/features/chat/api';
import { sessionQuery } from '@/shared/lib/api';
import {
  ChevronDown,
  Flower2,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Package,
  RotateCcw,
  Store,
  User,
} from '@florabot/ui';
import '../styles/user-menu.css';

export type UserMenuLink = {
  href: string;
  label: string;
  icon: 'workspace' | 'shop' | 'purchase' | 'profile' | 'orders' | 'chats' | 'history';
};

const icons = {
  workspace: LayoutDashboard,
  shop: Store,
  purchase: Flower2,
  profile: User,
  orders: Package,
  chats: MessageSquare,
  history: RotateCcw,
} as const;

export function UserMenu({
  name,
  roleLabel,
  links,
  busy,
  onLogout,
  open,
  onOpenChange,
  onOpen,
  menuId,
  className = '',
}: {
  name: string;
  roleLabel: string;
  links: UserMenuLink[];
  busy: boolean;
  onLogout: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpen?: () => void;
  menuId: string;
  className?: string;
}) {
  const pathname = usePathname();
  const session = useQuery(sessionQuery);
  const unread = useQuery({
    queryKey: ['member-chats-unread-count', session.data?.id],
    queryFn: ({ signal }) => getCustomerUnreadCount(signal),
    enabled: open && session.data?.role === 'CUSTOMER',
    refetchInterval: 15_000,
  });
  const container = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (container.current?.contains(event.target as Node)) return;
      onOpenChange(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      onOpenChange(false);
      toggle.current?.focus();
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [onOpenChange, open]);

  return (
    <div ref={container} className={`user-menu-account ${className}`.trim()}>
      <button
        ref={toggle}
        className="user-menu-trigger"
        type="button"
        aria-label={`Mở menu người dùng của ${name}`}
        aria-controls={menuId}
        aria-expanded={open}
        onClick={() => {
          if (!open) onOpen?.();
          onOpenChange(!open);
        }}
      >
        <span className="user-menu-avatar" aria-hidden="true">
          {name.trim().slice(0, 1).toLocaleUpperCase('vi-VN') || 'F'}
        </span>
        <span className="user-menu-identity">
          <span className="user-menu-caption">{roleLabel}</span>
          <span className="user-menu-name">{name}</span>
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div id={menuId} className="user-menu-popover" aria-label="Menu người dùng">
          <div className="user-menu-links">
            {links.map((item) => {
              const Icon = icons[item.icon];
              return (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  prefetch={false}
                  aria-current={
                    `${pathname}${typeof window === 'undefined' ? '' : window.location.hash}` ===
                    item.href
                      ? 'page'
                      : undefined
                  }
                  onClick={(event) => {
                    if (item.href.includes('#') && item.href.split('#')[0] === pathname) {
                      event.preventDefault();
                      window.location.assign(item.href);
                    }
                    onOpenChange(false);
                  }}
                >
                  <Icon size={17} aria-hidden="true" />
                  <span>{item.label}</span>
                  {item.icon === 'chats' && unread.data != null && unread.data > 0 && (
                    <span className="user-menu-unread" aria-label={`${unread.data} tin chưa đọc`}>
                      {unread.data}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
          <button
            className="user-menu-logout"
            type="button"
            data-session-exit
            disabled={busy}
            onClick={onLogout}
          >
            <LogOut size={17} aria-hidden="true" />
            <span>{busy ? 'Đang đăng xuất…' : 'Đăng xuất'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
