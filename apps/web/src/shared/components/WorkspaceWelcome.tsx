'use client';

import { useId, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, Boxes, ClipboardList, ShieldCheck } from '@florabot/ui';

const workspaces = {
  admin: {
    label: 'Trung tâm quản trị',
    title: 'Ưu tiên giám sát hệ thống',
    description: 'Nắm tình hình vận hành, theo dõi đội ngũ và xử lý những việc cần bạn quyết định.',
    Icon: ShieldCheck,
    action: ['Theo dõi công việc', '/admin/tasks'],
    secondary: ['Tra cứu tài khoản', '/admin/accounts'],
    steps: [
      ['Quan sát', 'Sự cố & báo cáo'],
      ['Kiểm tra', 'Tài khoản & shop'],
      ['Xử lý', 'Đúng quyền, rõ kết quả'],
    ],
  },
  operations: {
    label: 'Trung tâm điều phối',
    title: 'Mỗi điểm đặt, một khởi đầu chỉn chu.',
    description:
      'Kết nối hồ sơ, đội ngũ kỹ thuật và từng điểm tủ. Mọi bước điều phối trong một không gian.',
    Icon: Boxes,
    action: ['Xử lý hồ sơ lắp đặt', '/operations/installations'],
    secondary: ['Xem đội ngũ kỹ thuật', '/operations/technicians'],
    steps: [
      ['Tiếp nhận', 'Kiểm tra hồ sơ thuê'],
      ['Điều phối', 'Xếp lịch & phân công'],
      ['Bàn giao', 'Đọc báo cáo & nghiệm thu'],
    ],
  },
  technician: {
    label: 'Không gian kỹ thuật',
    title: 'Rõ công việc. Chắc từng bước.',
    description:
      'Xem việc được giao, ghi nhận hiện trường và gửi kết quả để người quản lý kiểm tra.',
    Icon: ClipboardList,
    action: ['Xem lịch lắp đặt', '/technician/installations'],
    secondary: ['Cách xử lý công việc', '#technician-guide'],
    steps: [
      ['Nhận việc', 'Đọc thông tin & địa điểm'],
      ['Thực hiện', 'Ghi nhận ảnh minh chứng'],
      ['Báo cáo', 'Gửi quản lý kiểm tra'],
    ],
  },
} as const;

export default function WorkspaceWelcome({
  workspaceRole: role,
  children,
}: {
  workspaceRole: keyof typeof workspaces;
  children?: ReactNode;
}) {
  const titleId = useId();
  const { label, title, description, Icon, action, secondary, steps } = workspaces[role];
  return (
    <section className="platform-welcome" aria-labelledby={titleId}>
      <div className="platform-welcome-body">
        <div className="platform-welcome-copy">
          <span className="platform-welcome-label">
            <Icon size={15} aria-hidden="true" />
            {label}
          </span>
          <h2 id={titleId}>{title}</h2>
          <p>{description}</p>
          <div className="platform-welcome-actions">
            <Link className="button" href={action[1]}>
              {action[0]}
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link className="platform-welcome-secondary" href={secondary[1]}>
              {secondary[0]}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          {children}
        </div>
        <div className="platform-welcome-emblem" aria-hidden="true">
          <Icon size={66} strokeWidth={1.2} />
        </div>
      </div>
      <ol className="platform-welcome-steps" aria-label="Các bước làm việc">
        {steps.map(([step, detail], index) => (
          <li key={step}>
            <span aria-hidden="true">0{index + 1}</span>
            <div>
              <strong>{step}</strong>
              <small>{detail}</small>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
