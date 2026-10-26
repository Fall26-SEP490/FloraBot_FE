'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import '../workspace-styles.css';

const MemberAccount = dynamic(() => import('../../../MemberAccount'), {
  loading: () => <p role="status">Đang tải thông tin tài khoản…</p>,
});

const PersonalProfile = dynamic(() => import('../../../PersonalProfile'), {
  loading: () => <p role="status">Đang tải hồ sơ cá nhân…</p>,
});

const CustomerKioskOnboarding = dynamic(() => import('../../../CustomerKioskOnboarding'), {
  loading: () => <p role="status">Đang tải đăng ký thuê kiosk…</p>,
});

export default function CustomerWorkspace({
  screen,
}: {
  screen: 'member' | 'profile' | 'thue-kiosk';
}) {
  switch (screen) {
    case 'member':
      return <MemberAccount />;
    case 'profile':
      return <PersonalProfile />;
    case 'thue-kiosk':
      return <CustomerKioskOnboarding />;
  }
}
