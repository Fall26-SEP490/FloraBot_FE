'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { ApiError, sessionQuery } from '@/shared/lib/api';
import { accountPath } from '@/features/portal/config/roleRoutes';

export function PortalGuard({
  requiredRole,
  children,
}: {
  requiredRole: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const session = useQuery(sessionQuery);
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
    session.data && !allowed
      ? accountPath(session.data.role)
      : session.error instanceof ApiError && session.error.status === 401
        ? isPlatformRole
          ? '/admin/login'
          : '/dang-nhap'
        : null;
  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);
  if (session.isPending || target)
    return (
      <main id="main">
        <p role="status">Đang kiểm tra phiên làm việc…</p>
      </main>
    );
  if (session.isError)
    return (
      <main id="main" className="workspace">
        <h1>Chưa kết nối được FloraBot</h1>
        <p role="alert">Không tải được phiên làm việc. Kiểm tra kết nối rồi thử lại.</p>
        <Button onClick={() => void session.refetch()}>Thử lại</Button>
      </main>
    );
  return allowed ? <>{children}</> : null;
}
