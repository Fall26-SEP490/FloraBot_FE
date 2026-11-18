'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { ApiError, isTransientSessionError, sessionQuery } from '@/shared/lib/api';
import { accountPath } from '@/features/portal/config/roleRoutes';

export function PortalGuard({
  requiredRole,
  children,
}: {
  requiredRole: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const session = useQuery({
    ...sessionQuery,
    refetchInterval: (query) => {
      if (!query.state.error) return 60_000;
      return isTransientSessionError(query.state.error) ? 10_000 : false;
    },
  });
  const allowed =
    session.data &&
    (session.data.role === requiredRole ||
      (requiredRole === 'CUSTOMER' && session.data.role === 'SELLER') ||
      (requiredRole === 'OPERATIONS_MANAGER' && session.data.role === 'ADMIN'));
  const isPlatformRole =
    requiredRole === 'ADMIN' ||
    requiredRole === 'OPERATIONS_MANAGER' ||
    requiredRole === 'TECHNICIAN';
  const target =
    session.error instanceof ApiError && session.error.status === 401
      ? isPlatformRole
        ? '/admin/login'
        : '/dang-nhap'
      : session.data && !allowed
        ? accountPath(session.data.role)
        : null;
  useEffect(() => {
    if (!target) return;
    const loginTarget = target === '/dang-nhap' || target === '/admin/login';
    const returnUrl = window.location.pathname + window.location.search + window.location.hash;
    router.replace(loginTarget ? `${target}?returnUrl=${encodeURIComponent(returnUrl)}` : target);
  }, [target, router]);
  if (session.isPending || target)
    return (
      <main id="main">
        <p role="status">Đang kiểm tra phiên làm việc…</p>
      </main>
    );
  if (session.isError && (!allowed || !isTransientSessionError(session.error)))
    return (
      <main id="main" className="workspace">
        <h1>Chưa kết nối được FloraBot</h1>
        <p role="alert">Không tải được phiên làm việc. Kiểm tra kết nối rồi thử lại.</p>
        <Button
          disabled={session.isFetching}
          aria-busy={session.isFetching}
          onClick={() => void session.refetch()}
        >
          {session.isFetching ? 'Đang thử lại…' : 'Thử lại'}
        </Button>
        {isPlatformRole && (
          <p>
            <Link href="/admin/login">Về đăng nhập vận hành</Link>
          </p>
        )}
      </main>
    );
  return allowed ? (
    <>
      {session.isError && (
        <p role="status" className="workspace">
          Kết nối đang gián đoạn. Đang tự kiểm tra lại phiên làm việc.{' '}
          <Button disabled={session.isFetching} onClick={() => void session.refetch()}>
            Thử lại
          </Button>
        </p>
      )}
      {children}
    </>
  ) : null;
}
