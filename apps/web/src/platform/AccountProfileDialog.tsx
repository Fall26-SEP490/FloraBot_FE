'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { queryClient, request } from '../api';
import { Modal } from '../dashboard/Modal';
import {
  BasicProfileForm,
  DirectoryIdentity,
  LoadState,
  Status,
  dateText,
  roleLabels,
  type Profile,
  type ProfileInput,
} from './management';

export default function AccountProfileDialog({
  endpoint,
  actorId,
  title,
  close,
}: {
  endpoint: string;
  actorId: string;
  title: string;
  close: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const profile = useQuery({
    queryKey: ['platform-account', actorId, endpoint],
    queryFn: () => request<Profile>(endpoint),
    staleTime: 0,
  });
  async function save(value: ProfileInput) {
    setBusy(true);
    try {
      await request<Profile>(endpoint, value, true, 'PUT');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['platform-account'] }),
        queryClient.invalidateQueries({ queryKey: ['account-directory'] }),
        queryClient.invalidateQueries({ queryKey: ['platform-directory'] }),
        queryClient.invalidateQueries({ queryKey: ['platform-seller-owners'] }),
      ]);
      setEditing(false);
      setNotice('Đã lưu thông tin tài khoản.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open title={title} onClose={close} closeDisabled={busy}>
      <div className="platform-management">
        {notice && <p role="status">{notice}</p>}
        <LoadState
          pending={profile.isPending}
          error={profile.error}
          retry={() => void profile.refetch()}
        >
          {profile.data &&
            (editing ? (
              <BasicProfileForm
                initial={profile.data}
                save={save}
                busy={busy}
                cancel={() => setEditing(false)}
              />
            ) : (
              <>
                <div className="platform-profile-hero">
                  <DirectoryIdentity
                    name={profile.data.fullName}
                    secondary={roleLabels[profile.data.role] ?? profile.data.role}
                  />
                  <Status value={profile.data.status} />
                </div>
                <dl className="management-details">
                  <div>
                    <dt>Email đăng nhập</dt>
                    <dd>{profile.data.email || 'Chưa cập nhật'}</dd>
                  </div>
                  <div>
                    <dt>Số điện thoại</dt>
                    <dd>{profile.data.phone || 'Chưa cập nhật'}</dd>
                  </div>
                  <div>
                    <dt>Địa chỉ</dt>
                    <dd>{profile.data.address || 'Chưa cập nhật'}</dd>
                  </div>
                  <div>
                    <dt>Cập nhật lúc</dt>
                    <dd>{dateText(profile.data.updatedAt)}</dd>
                  </div>
                </dl>
                <div className="platform-actions platform-form-footer">
                  <Button
                    onClick={() => {
                      setEditing(true);
                      setNotice('');
                    }}
                  >
                    Chỉnh sửa thông tin
                  </Button>
                </div>
              </>
            ))}
        </LoadState>
      </div>
    </Modal>
  );
}
