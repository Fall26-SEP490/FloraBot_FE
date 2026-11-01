// Load account styles with the route, before browser-only session/workspace chunks render.
import '../../src/features/portal/workspace-styles.css';
import '../../src/features/portal/role-workspaces/customer-account-shell.css';
import '../../src/features/customer-account/styles/member.css';
import '../../src/features/customer-account/styles/member-dashboard.css';
import '../../src/features/customer-account/styles/account-home.css';
import '../../src/features/orders/customer-orders.module.css';
import type { Metadata } from 'next';
import PortalClient from '../portal-client';

export const metadata: Metadata = { title: 'Tài khoản của tôi | FloraBot' };

export default function Page() {
  return <PortalClient screen="member" />;
}
