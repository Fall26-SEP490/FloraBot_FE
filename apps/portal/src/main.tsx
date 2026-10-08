import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query';
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  redirect,
  useNavigate,
  Link,
} from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@florabot/ui';
import { ApiError, queryClient, request, sessionQuery, type Session } from './api';
import './i18n';
import Products from './Products';
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
import MemberAuth, { accountPath } from './MemberAuth';
import MemberAccount from './MemberAccount';
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

const landingUrl = import.meta.env.VITE_LANDING_URL || 'http://127.0.0.1:4321';
const loginSchema = z.object({
  email: z.email('Nhập địa chỉ email hợp lệ.'),
  password: z.string().min(1, 'Nhập mật khẩu của bạn.').max(128, 'Mật khẩu tối đa 128 ký tự.'),
});

function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const form = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });
  const login = useMutation({
    mutationFn: (values: z.infer<typeof loginSchema>) => request<Session>('/auth/login', values),
    onSuccess: async (session) => {
      queryClient.clear();
      queryClient.setQueryData(['session'], session);
      await navigate({ to: accountPath(session.role) });
    },
  });
  return (
    <main id="main" className="login-layout">
      <section className="login-story">
        <a className="portal-brand" href={landingUrl}>
          FloraBot
        </a>
        <h1>{t('loginTitle')}</h1>
        <p>
          Mỗi bó hoa được chăm chút.
          <br />
          Mỗi ngày bán hàng thêm nhẹ nhàng.
        </p>
        <p className="quiet">Không gian dành cho shop và đội ngũ FloraBot.</p>
      </section>
      <section className="login-form" aria-label="Đăng nhập">
        <h2>Vào góc quản lý của bạn</h2>
        <p>{t('loginIntro')}</p>
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
          Chưa có tài khoản? <a href={`${landingUrl}#dang-ky`}>Đăng ký thông tin shop</a> để đội ngũ
          hỗ trợ.
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
        <a href="#subscriptions" onClick={() => document.getElementById('subscriptions')?.focus()}>
          {status === 'APPROVED' ? 'Đăng ký gói' : 'Gia hạn gói thuê'}
        </a>
      )}
    </aside>
  );
}

function PortalUpdates() {
  useEffect(startPortalUpdates, []);
  return null;
}

function Workspace({ portalRole: role }: { portalRole: 'ADMIN' | 'SELLER' }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const session = useQuery({ ...sessionQuery, refetchInterval: 60_000 });
  const logout = useMutation({
    mutationFn: () => request('/auth/logout', {}),
    onSuccess: async () => {
      queryClient.clear();
      await navigate({ to: '/login' });
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
        <Link to="/login">Về đăng nhập</Link>
      </main>
    );
  if (session.data.role !== role)
    return (
      <main id="main">
        <h1>Bạn không có quyền vào khu vực này</h1>
        <Link to="/login">Về đăng nhập</Link>
      </main>
    );
  return (
    <>
      <header className="portal-header">
        <Link className="portal-brand" to={role === 'ADMIN' ? '/admin' : '/seller'}>
          FloraBot
        </Link>
        <span>{role === 'ADMIN' ? 'Quản trị vận hành' : 'Góc quản lý shop'}</span>
        <Button variant="outline" onClick={() => logout.mutate()} disabled={logout.isPending}>
          {t('logout')}
        </Button>
      </header>
      <main id="main" className="workspace">
        <PortalUpdates />
        {role === 'SELLER' && <SubscriptionBanner session={session.data} />}
        <h1>{t('welcome', { name: session.data.name })}</h1>
        <p>
          {role === 'ADMIN'
            ? 'Bạn đang đăng nhập với quyền quản trị hệ thống.'
            : 'Thông tin tài khoản và gói thuê của shop được cập nhật từ hệ thống.'}
        </p>
        <dl className="account-details">
          <div>
            <dt>Tài khoản</dt>
            <dd>{session.data.name}</dd>
          </div>
          <div>
            <dt>Vai trò</dt>
            <dd>{role === 'ADMIN' ? 'Quản trị viên' : 'Chủ shop / nhân viên shop'}</dd>
          </div>
          {role === 'SELLER' && (
            <>
              <div>
                <dt>Trạng thái shop</dt>
                <dd>
                  {t(`status.${session.data.sellerStatus}`, { defaultValue: 'Chưa xác định' })}
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
        <nav className="member-tabs" aria-label="Điều hướng quản lý">
          <a href="#web-orders">Đơn đặt trước</a>
          {role === 'ADMIN' ? (
            <>
              <a href="#admin-sellers-title">Shop</a>
              <a href="#admin-slots-title">Ô tủ</a>
              <a href="#refunds-title">Hoàn tiền</a>
            </>
          ) : (
            <>
              <a href="#products-title">Mẫu hoa</a>
              <a href="#subscriptions">Gói thuê</a>
            </>
          )}
        </nav>
        <WebRequests
          mode={role === 'ADMIN' ? 'admin' : 'seller'}
          sellerId={session.data.sellerId || undefined}
        />
        {role === 'SELLER' && <Products session={session.data} />}
        {role === 'SELLER' && <Subscriptions session={session.data} />}
        {role === 'SELLER' && <SellerStock session={session.data} />}
        {role === 'SELLER' && <SellerAccessories session={session.data} />}
        {role === 'SELLER' && <Wallet session={session.data} />}
        {role === 'ADMIN' && <AdminSellers />}
        {role === 'ADMIN' && <AdminSlots />}
        {role === 'ADMIN' && <AdminIncidents />}
        {role === 'ADMIN' && <AdminComplaints />}
        {role === 'ADMIN' && <AdminRefunds />}
        {role === 'ADMIN' && <AdminWithdrawals />}
        {role === 'ADMIN' && <AdminReconciliation />}
        {logout.isError && (
          <p role="alert" className="error">
            Chưa đăng xuất được. Bạn thử lại nhé.
          </p>
        )}
      </main>
    </>
  );
}

async function guard(role: string) {
  let session: Session;
  try {
    session = await queryClient.fetchQuery(sessionQuery);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401)
      throw redirect({ to: role === 'CUSTOMER' ? '/dang-nhap' : '/login' });
    throw error;
  }
  if (session.role !== role) throw redirect({ to: accountPath(session.role) });
}
const root = createRootRoute({
  component: () => (
    <>
      <a className="skip-link" href="#main">
        Bỏ qua tới nội dung
      </a>
      <Outlet />
    </>
  ),
  errorComponent: () => (
    <main id="main">
      <h1>Chưa kết nối được FloraBot</h1>
      <p>Kiểm tra kết nối và thử đăng nhập lại.</p>
      <Link to="/login">Về đăng nhập</Link>
    </main>
  ),
});
const loginRoute = createRoute({ getParentRoute: () => root, path: '/login', component: Login });
const receiptRoute = createRoute({
  getParentRoute: () => root,
  path: '/receipt',
  component: Receipt,
});
const indexRoute = createRoute({
  getParentRoute: () => root,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/dat-hoa' });
  },
});
const memberLoginRoute = createRoute({
  getParentRoute: () => root,
  path: '/dang-nhap',
  component: () => <MemberAuth mode="login" />,
});
const registerRoute = createRoute({
  getParentRoute: () => root,
  path: '/dang-ky',
  component: () => <MemberAuth mode="register" />,
});
const forgotRoute = createRoute({
  getParentRoute: () => root,
  path: '/quen-mat-khau',
  component: () => <MemberAuth mode="forgot" />,
});
const resetRoute = createRoute({
  getParentRoute: () => root,
  path: '/dat-lai-mat-khau',
  component: () => <MemberAuth mode="reset" />,
});
const memberRoute = createRoute({
  getParentRoute: () => root,
  path: '/tai-khoan',
  beforeLoad: () => guard('CUSTOMER'),
  component: MemberAccount,
});
const shopRoute = createRoute({
  getParentRoute: () => root,
  path: '/dat-hoa',
  component: FlowerShop,
});
const sellerRoute = createRoute({
  getParentRoute: () => root,
  path: '/seller',
  beforeLoad: () => guard('SELLER'),
  component: () => <Workspace portalRole="SELLER" />,
});
const adminRoute = createRoute({
  getParentRoute: () => root,
  path: '/admin',
  beforeLoad: () => guard('ADMIN'),
  component: () => <Workspace portalRole="ADMIN" />,
});
const router = createRouter({
  routeTree: root.addChildren([
    indexRoute,
    loginRoute,
    sellerRoute,
    adminRoute,
    receiptRoute,
    memberLoginRoute,
    registerRoute,
    forgotRoute,
    resetRoute,
    memberRoute,
    shopRoute,
  ]),
  defaultPendingComponent: () => (
    <main id="main">
      <p role="status">Đang kiểm tra phiên làm việc…</p>
    </main>
  ),
});
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
