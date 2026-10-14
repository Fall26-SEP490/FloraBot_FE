import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Eye, EyeOff } from '@florabot/ui';
import { ApiError, queryClient, request, sessionQuery, type Session } from './api';
import './i18n';
import './workspace-polish.css';
import Products from './Products';
import WorkspaceNavigation, { WorkspaceHeader } from './WorkspaceNavigation';
import DashboardOverview from './DashboardOverview';
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
import AuthShell from './AuthShell';
import MemberAccount from './MemberAccount';
import WorkspaceAccount from './WorkspaceAccount';
import StaffTasks from './StaffTasks';
import FlowerShop from './FlowerShop';
import WebRequests from './WebRequests';
import AccountManagement from './AccountManagement';
import PersonalProfile from './PersonalProfile';
import { startPortalUpdates } from './realtime';

const loginSchema = z.object({
  email: z.email('Nhập địa chỉ email hợp lệ.'),
  password: z.string().min(1, 'Nhập mật khẩu của bạn.').max(128, 'Mật khẩu tối đa 128 ký tự.'),
});

function Login() {
  const [show, setShow] = useState(false);
  const feedback = useRef<HTMLParagraphElement>(null);
  const { t } = useTranslation();
  const router = useRouter();
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });
  const login = useMutation({
    mutationFn: (values: z.infer<typeof loginSchema>) =>
      request<Session>('/auth/admin/login', values),
    onSuccess: async (session) => {
      queryClient.clear();
      queryClient.setQueryData(['session'], session);
      router.push(accountPath(session.role));
    },
  });
  useEffect(() => {
    if (login.error) feedback.current?.focus();
  }, [login.error]);
  return (
    <AuthShell mode="staff">
      <h1 id="auth-title">Đăng nhập vận hành</h1>
      <p className="auth-intro">Dành cho Admin và nhân viên.</p>
      {login.error && (
        <p ref={feedback} tabIndex={-1} role="alert" className="auth-message auth-message-error">
          {login.error instanceof ApiError
            ? login.error.message
            : 'Không kết nối được máy chủ. Thông tin vẫn được giữ, bạn thử lại nhé.'}
        </p>
      )}
      <form
        className="auth-form"
        noValidate
        aria-busy={login.isPending}
        onSubmit={form.handleSubmit((values) => {
          if (!login.isPending) login.mutate(values);
        })}
      >
        <div className="auth-field">
          <label htmlFor="email">{t('email')}</label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            {...form.register('email')}
            aria-invalid={!!form.formState.errors.email}
            aria-describedby={form.formState.errors.email ? 'email-error' : undefined}
          />
          {form.formState.errors.email && (
            <p id="email-error" className="auth-field-error">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>
        <div className="auth-field">
          <label htmlFor="password">{t('password')}</label>
          <div className="auth-password">
            <input
              id="password"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              required
              {...form.register('password')}
              aria-invalid={!!form.formState.errors.password}
              aria-describedby={form.formState.errors.password ? 'password-error' : undefined}
            />
            <button
              type="button"
              className="auth-password-toggle"
              aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              aria-pressed={show}
              onClick={() => setShow(!show)}
            >
              {show ? (
                <EyeOff size={20} aria-hidden="true" />
              ) : (
                <Eye size={20} aria-hidden="true" />
              )}
            </button>
          </div>
          {form.formState.errors.password && (
            <p id="password-error" className="auth-field-error">
              {form.formState.errors.password.message}
            </p>
          )}
        </div>
        <Button className="auth-submit" type="submit" disabled={login.isPending}>
          {t(login.isPending ? 'loggingIn' : 'login')}
        </Button>
        <span className="auth-sr-status" role="status">
          {login.isPending ? 'Đang kiểm tra tài khoản. Vui lòng chờ.' : ''}
        </span>
      </form>
      <p className="auth-hint auth-staff-help">Quên mật khẩu? Liên hệ quản trị viên.</p>
      <div className="auth-alternative">
        <p>
          <Link href="/dang-nhap">Đăng nhập tài khoản</Link>
        </p>
      </div>
    </AuthShell>
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
      router.push('/dang-nhap');
    },
  });
  if (session.isPending)
    return (
      <main id="main">
        <p role="status">Đang tải tài khoản nhân viên shop…</p>
      </main>
    );
  if (session.isError)
    return (
      <main id="main" className="workspace">
        <h1>Không tải được phiên làm việc</h1>
        <p role="alert">Kiểm tra kết nối hoặc đăng nhập lại để tiếp tục.</p>
        <Button onClick={() => void session.refetch()}>Thử lại</Button>{' '}
        <Link href="/dang-nhap">Về đăng nhập tài khoản</Link>
      </main>
    );
  if (session.data.role !== 'SELLER_STAFF')
    return (
      <main id="main" className="workspace">
        <h1>Phiên làm việc đã thay đổi</h1>
        <Link href={accountPath(session.data.role)}>Về khu vực của bạn</Link>
      </main>
    );
  return (
    <>
      <WorkspaceHeader
        workspaceRole="SELLER_STAFF"
        name={session.data.name}
        busy={logout.isPending}
        onLogout={() => logout.mutate()}
      />
      <div className="dashboard-shell">
        <WorkspaceNavigation workspaceRole="SELLER_STAFF" section="tasks" />
        <main id="main" className="workspace dashboard-content">
          <div className="dashboard-page-heading">
            <div>
              <h1>Chào {session.data.name}</h1>
              <p>Nhận việc, nạp hoa vào ô tủ và gửi báo cáo cho shop.</p>
            </div>
            <span className="dashboard-context">Nhân viên shop</span>
          </div>
          <StaffTasks
            actorRole="SELLER_STAFF"
            mode="worker"
            actorId={session.data.id}
            sellerId={session.data.sellerId}
            apiBase="/staff/tasks"
            allowedKinds={['DELIVERY']}
          />
          <section
            id="staff-guide"
            className="dashboard-staff-guide"
            tabIndex={-1}
            aria-labelledby="staff-guide-title"
          >
            <h2 id="staff-guide-title">Từ nhận việc đến hoàn thành</h2>
            <ol>
              <li>
                <strong>Kiểm tra yêu cầu</strong>
                <p>Xem đúng tủ, địa chỉ và nội dung được phân công.</p>
              </li>
              <li>
                <strong>Nạp hoa vào ô</strong>
                <p>Bắt đầu công việc, chọn ô trống, quét mã QR và xác nhận.</p>
              </li>
              <li>
                <strong>Gửi báo cáo</strong>
                <p>Cập nhật kết quả nạp hoa để chủ shop theo dõi.</p>
              </li>
            </ol>
            <p className="dashboard-data-note">
              Bạn chỉ thao tác trong phạm vi công việc được giao của shop phụ trách.
            </p>
          </section>
          {logout.isError && <p role="alert">Chưa đăng xuất được. Bạn thử lại nhé.</p>}
        </main>
      </div>
    </>
  );
}

function TechnicianWorkspace() {
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
        <p role="status">Đang tải tài khoản kỹ thuật viên…</p>
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
  if (session.data.role !== 'TECHNICIAN')
    return (
      <main id="main" className="workspace">
        <h1>Phiên làm việc đã thay đổi</h1>
        <Link href={accountPath(session.data.role)}>Về khu vực của bạn</Link>
      </main>
    );
  return (
    <>
      <WorkspaceHeader
        workspaceRole="TECHNICIAN"
        name={session.data.name}
        busy={logout.isPending}
        onLogout={() => logout.mutate()}
      />
      <div className="dashboard-shell">
        <WorkspaceNavigation workspaceRole="TECHNICIAN" section="tasks" />
        <main id="main" className="workspace dashboard-content">
          <div className="dashboard-page-heading">
            <div>
              <h1>Chào {session.data.name}</h1>
              <p>Nhận việc kiểm tra sự cố, cập nhật tiến độ và gửi báo cáo tại tủ.</p>
            </div>
            <span className="dashboard-context">Kỹ thuật viên</span>
          </div>
          <StaffTasks
            actorRole="TECHNICIAN"
            mode="worker"
            actorId={session.data.id}
            apiBase="/staff/tasks"
            allowedKinds={['INCIDENT']}
          />
          <section
            id="technician-guide"
            className="dashboard-staff-guide"
            tabIndex={-1}
            aria-labelledby="technician-guide-title"
          >
            <h2 id="technician-guide-title">Từ nhận việc đến hoàn thành sự cố</h2>
            <ol>
              <li>
                <strong>Kiểm tra sự cố</strong>
                <p>Xem thông tin tủ, lý do và hướng dẫn xử lý.</p>
              </li>
              <li>
                <strong>Khắc phục và ghi nhận</strong>
                <p>Bắt đầu công việc, sửa chữa thực tế và tải ảnh minh chứng.</p>
              </li>
              <li>
                <strong>Đóng sự cố và gửi báo cáo</strong>
                <p>Xác nhận đã kiểm tra thực tế để gửi người quản lý duyệt.</p>
              </li>
            </ol>
            <p className="dashboard-data-note">
              Kỹ thuật viên chỉ phụ trách sự cố kỹ thuật; không thực hiện nạp hoa cho shop.
            </p>
          </section>
          {logout.isError && <p role="alert">Chưa đăng xuất được. Bạn thử lại nhé.</p>}
        </main>
      </div>
    </>
  );
}

function OperationsWorkspace({ section = 'overview' }: { section?: string }) {
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
        <p role="status">Đang tải tài khoản quản lý vận hành…</p>
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
  if (session.data.role !== 'OPERATIONS_MANAGER')
    return (
      <main id="main" className="workspace">
        <h1>Phiên làm việc đã thay đổi</h1>
        <Link href={accountPath(session.data.role)}>Về khu vực của bạn</Link>
      </main>
    );
  return (
    <>
      <WorkspaceHeader
        workspaceRole="OPERATIONS_MANAGER"
        name={session.data.name}
        busy={logout.isPending}
        onLogout={() => logout.mutate()}
      />
      <div className="dashboard-shell">
        <WorkspaceNavigation workspaceRole="OPERATIONS_MANAGER" section={section} />
        <main id="main" className="workspace dashboard-content">
          <div className="dashboard-page-heading">
            <div>
              <h1>
                {section === 'technicians' ? 'Quản lý Kỹ thuật viên' : `Chào ${session.data.name}`}
              </h1>
              <p>
                {section === 'technicians'
                  ? 'Tạo tài khoản và quản lý trạng thái kỹ thuật viên phụ trách xử lý sự cố tủ hoa.'
                  : 'Phân công sự cố cho kỹ thuật viên và kiểm tra kết quả khắc phục lỗi tủ.'}
              </p>
            </div>
            <span className="dashboard-context">
              {section === 'technicians' ? 'Kỹ thuật viên' : 'Quản lý vận hành'}
            </span>
          </div>
          {section === 'technicians' ? (
            <AccountManagement
              actorRole="OPERATIONS_MANAGER"
              targetRole="TECHNICIAN"
              title="Quản lý Kỹ thuật viên"
              eyebrow="Vận hành kỹ thuật"
              description="Tạo tài khoản và quản lý trạng thái kỹ thuật viên phụ trách xử lý sự cố tủ hoa."
              createLabel="Thêm Kỹ thuật viên"
              itemName="kỹ thuật viên"
              apiBase="/operations/technicians"
            />
          ) : (
            <>
              <StaffTasks
                actorRole="OPERATIONS_MANAGER"
                mode="manager"
                actorId={session.data.id}
                apiBase="/operations/staff-tasks"
                directoryEndpoint="/operations/staff"
                incidentsEndpoint="/operations/incidents"
                allowedKinds={['INCIDENT']}
                canAssign
                canReassign
              />
              <section
                id="operations-guide"
                className="dashboard-staff-guide"
                tabIndex={-1}
                aria-labelledby="operations-guide-title"
              >
                <h2 id="operations-guide-title">Hướng dẫn điều phối vận hành</h2>
                <ol>
                  <li>
                    <strong>Kiểm tra sự cố mở</strong>
                    <p>Theo dõi các cảnh báo và sự cố tủ trong phạm vi phụ trách.</p>
                  </li>
                  <li>
                    <strong>Phân công kỹ thuật viên</strong>
                    <p>Giao công việc kiểm tra sự cố cho kỹ thuật viên phù hợp.</p>
                  </li>
                  <li>
                    <strong>Duyệt kết quả xử lý</strong>
                    <p>Kiểm tra báo cáo và ảnh minh chứng trước khi xác nhận hoàn thành.</p>
                  </li>
                </ol>
                <p className="dashboard-data-note">
                  Tài khoản quản lý được phân quyền theo cụm tủ phụ trách; không có quyền tài chính
                  hay quản trị viên.
                </p>
              </section>
            </>
          )}
          {logout.isError && <p role="alert">Chưa đăng xuất được. Bạn thử lại nhé.</p>}
        </main>
      </div>
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
      <WorkspaceHeader
        workspaceRole={role}
        name={session.data.name}
        busy={logout.isPending}
        onLogout={() => logout.mutate()}
      />
      <div className="dashboard-shell">
        <WorkspaceNavigation key={section} workspaceRole={role} section={section} />
        <main id="main" className="workspace dashboard-content">
          <PortalUpdates />
          {role === 'SELLER' && <SubscriptionBanner session={session.data} />}
          <div className="dashboard-page-heading">
            <div>
              <h1>
                {section === 'overview'
                  ? t('welcome', { name: session.data.name })
                  : workspaceSections[role].find(([key]) => key === section)?.[1]}
              </h1>
              <p>
                {section === 'overview'
                  ? role === 'ADMIN'
                    ? 'Tình hình vận hành và các việc cần bạn xử lý.'
                    : 'Đơn hàng, danh mục hoa và tài chính của shop.'
                  : workspaceSections[role].find(([key]) => key === section)?.[2]}
              </p>
            </div>
            <span className="dashboard-context">
              {section === 'overview' ? 'Tổng quan' : 'Không gian làm việc'}
            </span>
          </div>
          {section === 'overview' && (
            <>
              <DashboardOverview session={session.data} />
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
          {role === 'SELLER' && section === 'tasks' && session.data.sellerId && (
            <StaffTasks
              actorRole="SELLER"
              mode="manager"
              actorId={session.data.id}
              sellerId={session.data.sellerId}
              apiBase={`/sellers/${session.data.sellerId}/staff-tasks`}
              directoryEndpoint={`/sellers/${session.data.sellerId}/staff`}
              deliveryScopesEndpoint={`/sellers/${session.data.sellerId}/staff-delivery-scopes`}
              allowedKinds={['DELIVERY']}
              canAssign
              canReassign
            />
          )}
          {role === 'SELLER' && section === 'staff' && (
            <AccountManagement
              actorRole="SELLER"
              targetRole="SELLER_STAFF"
              title="Quản lý Nhân viên shop"
              eyebrow="Vận hành shop"
              description="Tạo tài khoản và quản lý trạng thái hoạt động của nhân viên shop."
              createLabel="Thêm nhân viên shop"
              itemName="nhân viên shop"
              apiBase={`/sellers/${session.data.sellerId}/staff`}
              listEndpoint={`/sellers/${session.data.sellerId}/staff/accounts`}
              sellerId={session.data.sellerId}
            />
          )}
          {role === 'ADMIN' && section === 'managers' && (
            <AccountManagement
              actorRole="ADMIN"
              targetRole="OPERATIONS_MANAGER"
              title="Đội ngũ quản lý vận hành"
              eyebrow="Quản trị hệ thống"
              description="Tạo tài khoản và quản lý trạng thái hoạt động của Quản lý vận hành."
              createLabel="Thêm Quản lý vận hành"
              itemName="Quản lý vận hành"
              apiBase="/admin/managers"
            />
          )}
          {role === 'ADMIN' && section === 'shops' && <AdminSellers />}
          {role === 'ADMIN' && section === 'tasks' && (
            <StaffTasks
              actorRole="ADMIN"
              mode="oversight"
              actorId={session.data.id}
              apiBase="/admin/staff-tasks"
              readOnly
              canAssign={false}
              canReassign={false}
            />
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
  | 'profile'
  | 'shop'
  | 'seller'
  | 'admin'
  | 'staff'
  | 'technician'
  | 'operations'
  | 'workspace';

function Guard({ requiredRole, children }: { requiredRole: string; children: React.ReactNode }) {
  const router = useRouter();
  const session = useQuery(sessionQuery);
  const allowed =
    session.data &&
    (session.data.role === requiredRole ||
      (requiredRole === 'CUSTOMER' && session.data.role === 'SELLER'));
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
        <div className="workspace-portal-root">
          <Guard requiredRole="CUSTOMER">
            <MemberAccount />
          </Guard>
        </div>
      );
    case 'profile':
      return (
        <div className="workspace-portal-root">
          <PersonalProfile />
        </div>
      );
    case 'shop':
      return <FlowerShop />;
    case 'seller':
      return (
        <div className="workspace-portal-root">
          <Guard requiredRole="SELLER">
            <Workspace portalRole="SELLER" section={section} />
          </Guard>
        </div>
      );
    case 'admin':
      return (
        <div className="workspace-portal-root">
          <Guard requiredRole="ADMIN">
            <Workspace portalRole="ADMIN" section={section} />
          </Guard>
        </div>
      );
    case 'staff':
      return (
        <div className="workspace-portal-root">
          <Guard requiredRole="SELLER_STAFF">
            <StaffWorkspace />
          </Guard>
        </div>
      );
    case 'technician':
      return (
        <div className="workspace-portal-root">
          <Guard requiredRole="TECHNICIAN">
            <TechnicianWorkspace />
          </Guard>
        </div>
      );
    case 'operations':
      return (
        <div className="workspace-portal-root">
          <Guard requiredRole="OPERATIONS_MANAGER">
            <OperationsWorkspace section={section} />
          </Guard>
        </div>
      );
    case 'workspace':
      return (
        <div className="workspace-portal-root">
          <WorkspaceAccount />
        </div>
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
  React.useLayoutEffect(() => {
    const workspace = [
      'admin',
      'seller',
      'operations',
      'technician',
      'staff',
      'member',
      'profile',
      'workspace',
    ].includes(screen);
    if (workspace && !window.location.hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [screen, section]);
  return (
    <React.StrictMode>
      <Screen screen={screen} section={section} />
    </React.StrictMode>
  );
}
