'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@florabot/ui';
import { ApiError, queryClient } from '@/shared/lib/api';
import { updateMemberProfile } from '../customer-account.api';

export default function MemberBasicProfileForm({ defaultFullName }: { defaultFullName?: string }) {
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const form = useForm<{ fullName: string }>({
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    defaultValues: { fullName: defaultFullName || '' },
  });

  useEffect(() => {
    if (defaultFullName && !form.formState.isDirty) {
      form.reset({ fullName: defaultFullName });
    }
  }, [defaultFullName, form]);

  async function handleSave(data: { fullName: string }) {
    if (saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await updateMemberProfile(data);
      await queryClient.invalidateQueries({ queryKey: ['member-profile'] });
      setNotice('Đã lưu thay đổi hồ sơ cá nhân.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Chưa cập nhật được thông tin.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(handleSave)} style={{ marginBottom: '1.75rem' }}>
      <h3 style={{ fontSize: '1.1rem', color: '#113421', marginBottom: '0.75rem' }}>
        Thông tin cá nhân
      </h3>
      {notice && (
        <p role="status" className="notice-success" style={{ color: '#185a32', fontWeight: 600 }}>
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div style={{ marginBottom: '1rem', maxWidth: '480px' }}>
        <label htmlFor="member-fullname">Họ và tên *</label>
        <input
          id="member-fullname"
          type="text"
          {...form.register('fullName', {
            required: 'Vui lòng nhập họ và tên.',
            minLength: { value: 2, message: 'Họ và tên cần từ 2 đến 100 ký tự.' },
            maxLength: { value: 100, message: 'Họ và tên tối đa 100 ký tự.' },
            validate: (val) => val.trim().length >= 2 || 'Họ và tên cần từ 2 đến 100 ký tự.',
          })}
          aria-invalid={!!form.formState.errors.fullName}
          aria-describedby={form.formState.errors.fullName ? 'member-fullname-error' : undefined}
        />
        {form.formState.errors.fullName && (
          <p id="member-fullname-error" className="error" role="alert">
            {form.formState.errors.fullName.message}
          </p>
        )}
      </div>
      <Button type="submit" disabled={saving}>
        {saving ? 'Đang lưu…' : 'Lưu thông tin cá nhân'}
      </Button>
    </form>
  );
}
