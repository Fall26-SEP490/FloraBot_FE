import SellerOverview from './SellerOverview';
import AdminOverview from './AdminOverview';
import type { Session } from '@/shared/lib/api';

export default function DashboardOverview({ session }: { session: Session }) {
  return session.role === 'ADMIN' ? (
    <AdminOverview session={session} />
  ) : (
    <SellerOverview session={session} />
  );
}
