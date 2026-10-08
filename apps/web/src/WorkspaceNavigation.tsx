import { useState } from 'react';
import Link from 'next/link';
import { workspaceBase, workspaceSections, type WorkspaceRole } from './workspaceSections';

export default function WorkspaceNavigation({
  role,
  section,
}: {
  role: WorkspaceRole;
  section: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const base = workspaceBase(role);
  return (
    <aside className="workspace-sidebar">
      <button
        className="workspace-menu-toggle"
        aria-expanded={expanded}
        aria-controls="workspace-navigation"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? 'Đóng danh mục quản lý' : 'Mở danh mục quản lý'}
      </button>
      <nav
        id="workspace-navigation"
        className={expanded ? 'is-expanded' : ''}
        aria-label="Điều hướng quản lý"
      >
        <Link href={base} aria-current={section === 'overview' ? 'page' : undefined}>
          Tổng quan
        </Link>
        {workspaceSections[role].map(([key, title]) => (
          <Link
            key={key}
            href={`${base}/${key}`}
            aria-current={section === key ? 'page' : undefined}
          >
            {title}
          </Link>
        ))}
        <div className="workspace-personal-links">
          {role === 'SELLER' && <Link href="/tai-khoan">Tài khoản & mua hoa</Link>}
          <Link href="/">Về trang chủ</Link>
        </div>
      </nav>
    </aside>
  );
}

export function WorkspaceOverview({ role }: { role: WorkspaceRole }) {
  return (
    <section className="workspace-overview" aria-labelledby="overview-title">
      <h2 id="overview-title">
        {role === 'ADMIN' ? 'Bạn cần xử lý việc gì?' : 'Chăm chút shop, từ mẫu hoa đến đơn hàng.'}
      </h2>
      <p>
        {role === 'ADMIN'
          ? 'Bắt đầu từ sự cố cần xử lý hoặc công việc đang chờ nhân viên báo cáo.'
          : 'Chọn một khu vực để cập nhật shop. Đơn mua cá nhân vẫn nằm trong tài khoản của bạn.'}
      </p>
      <ul>
        {workspaceSections[role].map(([key, title, description]) => (
          <li key={key}>
            <Link href={`${workspaceBase(role)}/${key}`}>
              {title}
              <span aria-hidden="true"> →</span>
            </Link>
            <p>{description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
