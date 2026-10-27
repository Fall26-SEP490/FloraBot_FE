import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button, Flower2, LogOut, CircleAlert } from '@florabot/ui';
import { ApiError, logoutSession, sessionQuery } from '../../api';
import {
  accountPath,
  getRoleLabel,
  isDedicatedWorkspaceRole,
  isExistingFullPortalRole,
  isPlatformOperatorRole,
  ROLE_LABELS,
} from '../../roleRoutes';
import './workspace-styles.css';

export {
  ROLE_LABELS,
  getRoleLabel,
  isDedicatedWorkspaceRole,
  isExistingFullPortalRole,
  isPlatformOperatorRole,
};

export default function WorkspaceAccount() {
  const { t } = useTranslation();
  const router = useRouter();
  const session = useQuery(sessionQuery);

  const logout = useMutation({
    mutationFn: logoutSession,
    onSuccess: async () => {
      const isOperator = session.data && isPlatformOperatorRole(session.data.role);
      window.location.replace(isOperator ? '/admin/login' : '/dang-nhap');
    },
  });

  const shouldRedirect = session.data && isExistingFullPortalRole(session.data.role);

  useEffect(() => {
    if (shouldRedirect && session.data) {
      router.replace(accountPath(session.data.role));
    }
  }, [shouldRedirect, session.data, router]);

  if (session.isPending || shouldRedirect) {
    return (
      <main id="main">
        <p role="status">
          {shouldRedirect
            ? 'Đang chuyển hướng tới khu vực của bạn…'
            : 'Đang tải thông tin tài khoản…'}
        </p>
      </main>
    );
  }

  const isUnauthorized = session.error instanceof ApiError && session.error.status === 401;

  if (session.isError) {
    if (!isUnauthorized) {
      return (
        <div className="workspace-account-shell">
          <header className="dashboard-header workspace-account-header">
            <Link className="dashboard-brand" href="/">
              <Flower2 size={28} aria-hidden="true" />
              FloraBot<span aria-hidden="true">.</span>
            </Link>
            <span className="dashboard-role">Không gian làm việc</span>
          </header>
          <main id="main" className="workspace dashboard-content workspace-account-content">
            <div className="dashboard-page-heading">
              <div>
                <h1>Chưa tải được phiên làm việc</h1>
                <p>Không kết nối được với máy chủ FloraBot hoặc dịch vụ đang bận.</p>
              </div>
              <span className="dashboard-context">Lỗi kết nối</span>
            </div>
            <div className="workspace-unavailable-notice" role="alert">
              <CircleAlert size={20} aria-hidden="true" />
              <p>
                {session.error instanceof ApiError
                  ? session.error.message
                  : 'Kiểm tra kết nối rồi thử lại.'}
              </p>
            </div>
            <div className="workspace-account-actions">
              <Button onClick={() => void session.refetch()}>Thử lại</Button>
            </div>
          </main>
        </div>
      );
    }

    return (
      <div className="workspace-account-shell">
        <header className="dashboard-header workspace-account-header">
          <Link className="dashboard-brand" href="/">
            <Flower2 size={28} aria-hidden="true" />
            FloraBot<span aria-hidden="true">.</span>
          </Link>
          <span className="dashboard-role">Không gian làm việc</span>
        </header>
        <main id="main" className="workspace dashboard-content workspace-account-content">
          <div className="dashboard-page-heading">
            <div>
              <h1>Không gian làm việc FloraBot</h1>
              <p>Vui lòng đăng nhập để truy cập tài khoản và phiên làm việc của bạn.</p>
            </div>
            <span className="dashboard-context">Đăng nhập</span>
          </div>
          <div className="workspace-auth-choices">
            <Link href="/dang-nhap" className="button button-primary">
              Đăng nhập tài khoản shop & thành viên
            </Link>
            <Link href="/admin/login" className="button button-outline">
              Đăng nhập vận hành
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (!session.data) {
    return (
      <div className="workspace-account-shell">
        <header className="dashboard-header workspace-account-header">
          <Link className="dashboard-brand" href="/">
            <Flower2 size={28} aria-hidden="true" />
            FloraBot<span aria-hidden="true">.</span>
          </Link>
          <span className="dashboard-role">Không gian làm việc</span>
        </header>
        <main id="main" className="workspace dashboard-content workspace-account-content">
          <div className="dashboard-page-heading">
            <div>
              <h1>Không gian làm việc FloraBot</h1>
              <p>Vui lòng đăng nhập để truy cập tài khoản và phiên làm việc của bạn.</p>
            </div>
            <span className="dashboard-context">Đăng nhập</span>
          </div>
          <div className="workspace-auth-choices">
            <Link href="/dang-nhap" className="button button-primary">
              Đăng nhập tài khoản shop & thành viên
            </Link>
            <Link href="/admin/login" className="button button-outline">
              Đăng nhập vận hành
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const role = session.data.role;
  const isRetiredStaff = role === 'STAFF';
  const roleLabel = getRoleLabel(role);
  const avatarLetter = session.data.name.trim().slice(0, 1).toLocaleUpperCase('vi-VN');

  return (
    <div className="workspace-account-shell">
      <header className="dashboard-header workspace-account-header">
        <Link className="dashboard-brand" href="/">
          <Flower2 size={28} aria-hidden="true" />
          FloraBot<span aria-hidden="true">.</span>
        </Link>
        <span className="dashboard-role">{roleLabel}</span>
        <div className="dashboard-user">
          <span className="dashboard-avatar" aria-hidden="true">
            {avatarLetter}
          </span>
          <span>{session.data.name}</span>
          <Button
            variant="outline"
            className="dashboard-logout button"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
          >
            <LogOut size={16} aria-hidden="true" /> Đăng xuất
          </Button>
        </div>
      </header>

      <main id="main" className="workspace dashboard-content workspace-account-content">
        <div className="dashboard-page-heading">
          <div>
            <h1>
              {isRetiredStaff
                ? 'Tài khoản nhân viên cũ đã ngừng hoạt động'
                : 'Quyền truy cập chưa được cấp'}
            </h1>
            <p>
              {isRetiredStaff
                ? 'Vai trò nhân viên trước đây đã được thay thế. Vui lòng liên hệ quản trị viên để được cấp vai trò mới hoặc đăng xuất.'
                : 'Tài khoản của bạn chưa được phân quyền trong hệ thống.'}
            </p>
          </div>
          <span className="dashboard-context">{role}</span>
        </div>

        <section aria-labelledby="workspace-profile-heading" className="workspace-account-card">
          <h2 id="workspace-profile-heading">Thông tin tài khoản</h2>
          <dl className="account-details">
            <div>
              <dt>Tài khoản</dt>
              <dd>{session.data.name}</dd>
            </div>
            <div>
              <dt>Vai trò</dt>
              <dd>{roleLabel}</dd>
            </div>
            {session.data.sellerId && (
              <div>
                <dt>Mã shop</dt>
                <dd>{session.data.sellerId}</dd>
              </div>
            )}
            {session.data.sellerStatus && (
              <div>
                <dt>Trạng thái shop</dt>
                <dd>
                  {t(`status.${session.data.sellerStatus}`, {
                    defaultValue: session.data.sellerStatus,
                  })}
                </dd>
              </div>
            )}
          </dl>
        </section>

        {isRetiredStaff ? (
          <div className="workspace-denied-notice" role="alert">
            <CircleAlert size={20} aria-hidden="true" />
            <p>
              Tài khoản nhân viên FloraBot trước đây đã ngừng hoạt động. Hệ thống hiện phân chia
              thành hai vai trò mới: Kỹ thuật viên (xử lý sự cố tủ) và Nhân viên shop (giao hoa và
              nạp ô tủ). Vui lòng liên hệ quản trị viên để được cấp vai trò phù hợp hoặc đăng xuất.
            </p>
          </div>
        ) : (
          <div className="workspace-denied-notice" role="alert">
            <CircleAlert size={20} aria-hidden="true" />
            <p>
              Tài khoản chưa được kích hoạt phân quyền hợp lệ trong hệ thống. Vui lòng liên hệ quản
              trị viên để được cấp quyền.
            </p>
          </div>
        )}

        <div className="workspace-account-actions">
          <Button variant="outline" disabled={logout.isPending} onClick={() => logout.mutate()}>
            Đăng xuất
          </Button>
        </div>

        {logout.isError && (
          <p role="alert" className="error">
            Chưa đăng xuất được. Bạn thử lại nhé.
          </p>
        )}
      </main>
    </div>
  );
}
