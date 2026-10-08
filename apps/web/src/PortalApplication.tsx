import React, { useEffect, useState } from 'react';
import { QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@florabot/ui';
import { ApiError, queryClient, request, sessionQuery, type Session } from './api';
import './i18n';
import Products from './Products';
import WorkspaceNavigation, { WorkspaceOverview } from './WorkspaceNavigation';
import { workspaceSections } from './workspaceSections';
import Subscriptions from './Subscriptions';
import AdminSellers from './AdminSellers';
import AdminSlots from './AdminSlots';
import AdminIncidents from './AdminIncidents';
import AdminComplaints from './AdminComplaints';
import AdminRefunds from './AdminRefunds';
import AdminReconciliation from './AdminReconciliation';
import AdminWithdrawals from './AdminWithdrawals';
import SellerStock from './SellerStock';
import SellerAccessories from './SellerAccessories';
import Wallet from './Wallet';
import Receipt from './Receipt';
import GuestHistory from './GuestHistory';
import MemberAuth, { accountPath } from './MemberAuth';
import MemberAccount from './MemberAccount';
import StaffTasks from './StaffTasks';
import FlowerShop from './FlowerShop';
import WebRequests from './WebRequests';
import './member.css';
import { startPortalUpdates } from './realtime';
import '@fontsource/nunito/vietnamese-800.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/be-vietnam-pro/vietnamese-400.css';
import '@fontsource/be-vietnam-pro/latin-400.css';
import '@fontsource/be-vietnam-pro/vietnamese-600.css';
import '@fontsource/be-vietnam-pro/latin-600.css';
import '@florabot/ui/tokens.css';
import './portal.css';
import './workspace.css';

const landingUrl = '/';
const loginSchema = z.object({
  email: z.email('Nhập địa chỉ email hợp lệ.'),
  password: z.string().min(1, 'Nhập mật khẩu của bạn.').max(128, 'Mật khẩu tối đa 128 ký tự.'),
});

function Login() {
  const { t } = useTranslation();
  const router = useRouter();
  const form = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });
  const login = useMutation({
    mutationFn: (values: z.infer<typeof loginSchema>) =>
      request<Session>('/auth/admin/login', values),
    onSuccess: async (session) => {
      queryClient.clear();
      queryClient.setQueryData(['session'], session);
      router.push(accountPath(session.role));
    },
  });
  return (
    <main id="main" className="login-layout">
      <section className="login-story">
        <a className="portal-brand" href={landingUrl}>
          FloraBot
        </a>
        <h1>Điều hành FloraBot.</h1>
        <p>
          Theo dõi tủ hoa và xử lý công việc.
          <br />
          Cùng giữ trải nghiệm nhận hoa trọn vẹn.
        </p>
        <p className="quiet">Dành cho quản trị viên và nhân viên được cấp quyền.</p>
      </section>
      <section className="login-form" aria-label="Đăng nhập">
        <h2>Đăng nhập vận hành</h2>
        <p>Dùng tài khoản quản trị viên hoặc nhân viên do FloraBot cấp.</p>
        <form noValidate onSubmit={form.handleSubmit((values) => login.mutate(values))}>
          <label htmlFor="email">{t('email')}</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            {...form.register('email')}
            aria-invalid={!!form.formState.errors.email}
            aria-describedby={form.formState.errors.email ? 'email-error' : undefined}
          />
          {form.formState.errors.email && (
            <p id="email-error" className="error">
              {form.formState.errors.email.message}
            </p>
          )}
          <label htmlFor="password">{t('password')}</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            {...form.register('password')}
            aria-invalid={!!form.formState.errors.password}
            aria-describedby={form.formState.errors.password ? 'password-error' : undefined}
          />
          {form.formState.errors.password && (
            <p id="password-error" className="error">
              {form.formState.errors.password.message}
            </p>
          )}
          <p role="alert" className="error">
            {login.error
              ? login.error instanceof ApiError
                ? login.error.message
                : 'Không kết nối được máy chủ. Thông tin vẫn được giữ, bạn thử lại nhé.'
              : ''}
          </p>
          <Button type="submit" disabled={login.isPending}>
            {t(login.isPending ? 'loggingIn' : 'login')}
          </Button>
        </form>
        <p className="quiet">
          Bạn mua hoa hoặc quản lý shop? <Link href="/dang-nhap">Đăng nhập tài khoản</Link>.
        </p>
      </section>
    </main>
  );
}

function SubscriptionBanner({ session }: { session: Session }) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const status = session.sellerStatus || 'UNKNOWN';
  const expiry = session.packageExpiresAt
    ? new Date(`${session.packageExpiresAt}T00:00:00+07:00`)
    : null;
  const days = expiry ? (expiry.getTime() - now) / 86400000 : Infinity;
  if (status === 'ACTIVE' && days > 7) return null;
  const key =
    status === 'ACTIVE'
      ? 'EXPIRING'
      : ['PENDING', 'APPROVED', 'PAST_DUE', 'SUSPENDED', 'CLOSED'].includes(status)
        ? status
        : 'UNKNOWN';
  return (
    <aside
      className={`subscription-banner ${status === 'PAST_DUE' ? 'subscription-overdue' : ''}`}
      aria-label="Trạng thái gói"
      role="status"
    >
      <p>
        {t(`banner.${key}`, {
          date:
            expiry?.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) ||
            'chưa xác định',
        })}
      </p>
      {['APPROVED', 'PAST_DUE', 'ACTIVE'].includes(status) && (
        <Link
          href="/seller/subscriptions#subscriptions"
          onClick={(event) => {
            const target = document.getElementById('subscriptions');
            if (target) {
              event.preventDefault();
              target.focus();
              target.scrollIntoView({ block: 'start' });
            }
          }}
        >
          {status === 'APPROVED' ? 'Đăng ký gói' : 'Gia hạn gói thuê'}
        </Link>
      )}
    </aside>
  );
}

function PortalUpdates() {
  useEffect(startPortalUpdates, []);
  return null;
}

function StaffWorkspace() {
  const router = useRouter();
  const session = useQuery({ ...sessionQuery, refetchInterval: 60_000 });
  const logout = useMutation({
    mutationFn: () => request('/auth/logout', {}),
    onSuccess: async () => {
      queryClient.clear();
      router.push('/admin/login');
    },
  });
  if (session.isPending)
    return (
      <main id="main">
        <p role="status">Đang tải tài khoản nhân viên…</p>
      </main>
    );
  if (session.isError)
    return (
      <main id="main" className="workspace">
        <h1>Không tải được phiên làm việc</h1>
        <p role="alert">Kiểm tra kết nối hoặc đăng nhập lại để tiếp tục.</p>
        <Button onClick={() => void session.refetch()}>Thử lại</Button>{' '}
        <Link href="/admin/login">Về đăng nhập vận hành</Link>
      </main>
    );
  if (session.data.role !== 'STAFF')
    return (
      <main id="main" className="workspace">
        <h1>Phiên làm việc đã thay đổi</h1>
        <Link href={accountPath(session.data.role)}>Về khu vực của bạn</Link>
      </main>
    );
  return (
    <>
      <header className="portal-header">
        <Link className="portal-brand" href="/staff">
          FloraBot
        </Link>
        <span>Khu vực nhân viên</span>
        <Button variant="outline" onClick={() => logout.mutate()} disabled={logout.isPending}>
          {logout.isPending ? 'Đang đăng xuất…' : 'Đăng xuất'}
        </Button>
      </header>
      <main id="main" className="workspace">
        <h1>Chào {session.data.name}</h1>
        <p>Tài khoản nhân viên FloraBot</p>
        <p>Quyền xử lý sự cố và giao hoa được giới hạn theo công việc được phân công.</p>
        <StaffTasks staffId={session.data.id} />
        {logout.isError && <p role="alert">Chưa đăng xuất được. Bạn thử lại nhé.</p>}
      </main>
    </>
  );
}

function Workspace({
  portalRole: role,
  section = 'overview',
}: {
  portalRole: 'ADMIN' | 'SELLER';
  section?: string;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const session = useQuery({ ...sessionQuery, refetchInterval: 60_000 });
  const logout = useMutation({
    mutationFn: () => request('/auth/logout', {}),
    onSuccess: async () => {
      queryClient.clear();
      router.push(role === 'ADMIN' ? '/admin/login' : '/dang-nhap');
    },
  });
  if (session.isPending)
    return (
      <main id="main">
        <p role="status">{t('loading')}</p>
      </main>
    );
  if (session.isError)
    return (
      <main id="main">
        <h1>Không tải được phiên làm việc</h1>
        <p role="alert">
          {session.error instanceof ApiError
            ? session.error.message
            : 'Kiểm tra kết nối rồi thử lại.'}
        </p>
        <Button onClick={() => void session.refetch()}>{t('retry')}</Button>{' '}
        <Link href={role === 'ADMIN' ? '/admin/login' : '/dang-nhap'}>Về đăng nhập</Link>
      </main>
    );
  if (session.data.role !== role)
    return (
      <main id="main">
        <h1>Bạn không có quyền vào khu vực này</h1>
        <Link href={accountPath(session.data.role)}>Về khu vực của bạn</Link>
      </main>
    );
  return (
    <>
      <header className="portal-header">
        <Link className="portal-brand" href={role === 'ADMIN' ? '/admin' : '/seller'}>
          FloraBot
        </Link>
        <span>{role === 'ADMIN' ? 'Quản trị vận hành' : 'Góc quản lý shop'}</span>
        <Button variant="outline" onClick={() => logout.mutate()} disabled={logout.isPending}>
          {t('logout')}
        </Button>
      </header>
      <div className="dashboard-shell">
        <WorkspaceNavigation key={section} role={role} section={section} />
        <main id="main" className="workspace dashboard-content">
          <PortalUpdates />
          {role === 'SELLER' && <SubscriptionBanner session={session.data} />}
          <h1>
            {section === 'overview'
              ? t('welcome', { name: session.data.name })
              : workspaceSections[role].find(([key]) => key === section)?.[1]}
          </h1>
          {section === 'overview' && (
            <>
              <p>
                {role === 'ADMIN'
                  ? 'Bạn đang đăng nhập với quyền quản trị hệ thống.'
                  : 'Thông tin tài khoản và gói thuê của shop được cập nhật từ hệ thống.'}
              </p>
              <details className="workspace-profile">
                <summary>Thông tin tài khoản và quyền truy cập</summary>
                <dl className="account-details">
                  <div>
                    <dt>Tài khoản</dt>
                    <dd>{session.data.name}</dd>
                  </div>
                  <div>
                    <dt>Vai trò</dt>
                    <dd>{role === 'ADMIN' ? 'Quản trị viên' : 'Chủ shop'}</dd>
                  </div>
                  {role === 'SELLER' && (
                    <>
                      <div>
                        <dt>Trạng thái shop</dt>
                        <dd>
                          {t(`status.${session.data.sellerStatus}`, {
                            defaultValue: 'Chưa xác định',
                          })}
                        </dd>
                      </div>
                      <div>
                        <dt>Ngày hết hạn gói</dt>
                        <dd>
                          {session.data.packageExpiresAt
                            ? new Date(
                                `${session.data.packageExpiresAt}T00:00:00+07:00`,
                              ).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
                            : 'Chưa có kỳ thuê đang hoạt động'}
                        </dd>
                      </div>
                    </>
                  )}
                </dl>
              </details>
              <WorkspaceOverview role={role} />
            </>
          )}
          {section === 'orders' && (
            <WebRequests
              mode={role === 'ADMIN' ? 'admin' : 'seller'}
              sellerId={session.data.sellerId || undefined}
            />
          )}
          {role === 'SELLER' && section === 'products' && <Products session={session.data} />}
          {role === 'SELLER' && section === 'subscriptions' && (
            <Subscriptions session={session.data} />
          )}
          {role === 'SELLER' && section === 'stock' && <SellerStock session={session.data} />}
          {role === 'SELLER' && section === 'accessories' && (
            <SellerAccessories session={session.data} />
          )}
          {role === 'SELLER' && section === 'wallet' && <Wallet session={session.data} />}
          {role === 'ADMIN' && section === 'shops' && <AdminSellers />}
          {role === 'ADMIN' && section === 'tasks' && (
            <StaffTasks admin adminId={session.data.id} />
          )}
          {role === 'ADMIN' && section === 'slots' && <AdminSlots />}
          {role === 'ADMIN' && section === 'incidents' && <AdminIncidents />}
          {role === 'ADMIN' && section === 'complaints' && <AdminComplaints />}
          {role === 'ADMIN' && section === 'refunds' && <AdminRefunds />}
          {role === 'ADMIN' && section === 'withdrawals' && <AdminWithdrawals />}
          {role === 'ADMIN' && section === 'reconciliation' && <AdminReconciliation />}
          {logout.isError && (
            <p role="alert" className="error">
              Chưa đăng xuất được. Bạn thử lại nhé.
            </p>
          )}
        </main>
      </div>
    </>
  );
}

export type PortalScreen =
  | 'admin-login'
  | 'receipt'
  | 'guest-history'
  | 'login'
  | 'register'
  | 'forgot'
  | 'reset'
  | 'member'
  | 'shop'
  | 'seller'
  | 'admin'
  | 'staff';

function Guard({ requiredRole, children }: { requiredRole: string; children: React.ReactNode }) {
  const router = useRouter();
  const session = useQuery(sessionQuery);
  const allowed =
    session.data &&
    (session.data.role === requiredRole ||
      (requiredRole === 'CUSTOMER' && session.data.role === 'SELLER'));
  const target =
    session.data && !allowed
      ? accountPath(session.data.role)
      : session.error instanceof ApiError && session.error.status === 401
        ? requiredRole === 'ADMIN' || requiredRole === 'STAFF'
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
  return allowed ? children : null;
}

function Screen({ screen, section }: { screen: PortalScreen; section?: string }) {
  switch (screen) {
    case 'admin-login':
      return <Login />;
    case 'receipt':
      return <Receipt />;
    case 'guest-history':
      return <GuestHistory />;
    case 'login':
      return <MemberAuth mode="login" />;
    case 'register':
      return <MemberAuth mode="register" />;
    case 'forgot':
      return <MemberAuth mode="forgot" />;
    case 'reset':
      return <MemberAuth mode="reset" />;
    case 'member':
      return (
        <Guard requiredRole="CUSTOMER">
          <MemberAccount />
        </Guard>
      );
    case 'shop':
      return <FlowerShop />;
    case 'seller':
      return (
        <Guard requiredRole="SELLER">
          <Workspace portalRole="SELLER" section={section} />
        </Guard>
      );
    case 'admin':
      return (
        <Guard requiredRole="ADMIN">
          <Workspace portalRole="ADMIN" section={section} />
        </Guard>
      );
    case 'staff':
      return (
        <Guard requiredRole="STAFF">
          <StaffWorkspace />
        </Guard>
      );
  }
}

export default function PortalApplication({
  screen,
  section,
}: {
  screen: PortalScreen;
  section?: string;
}) {
  return (
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <a className="skip-link" href="#main">
          Bỏ qua tới nội dung
        </a>
        <Screen screen={screen} section={section} />
      </QueryClientProvider>
    </React.StrictMode>
  );
}
