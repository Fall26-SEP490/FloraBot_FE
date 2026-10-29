'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Eye, EyeOff } from '@florabot/ui';
import { ApiError, queryClient, request, type Session } from '@/shared/lib/api';
import AuthShell from '../../auth/components/AuthShell';
import { postLoginPath } from '@/features/auth/auth.utils';

const loginSchema = z.object({
  email: z.email('Nhập địa chỉ email hợp lệ.'),
  password: z.string().min(1, 'Nhập mật khẩu của bạn.').max(128, 'Mật khẩu tối đa 128 ký tự.'),
});

export default function AdminLoginScreen() {
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
      router.push(postLoginPath(session.role, window.location.search));
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
