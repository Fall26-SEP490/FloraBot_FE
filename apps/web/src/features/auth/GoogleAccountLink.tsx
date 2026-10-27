import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { ApiError } from '../../api';
import { fetchAuthConfig, linkGoogleAccount } from './auth.api';
import styles from './styles/GoogleAccountLink.module.css';
import type { GoogleAccountLinkProps, GoogleCredentialResponse, GoogleWindow } from './auth.types';

const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const SCRIPT_OWNER_TAG = 'member-google-link';
const GIS_LOAD_TIMEOUT_MS = 10_000;

export default function GoogleAccountLink({ email }: GoogleAccountLinkProps) {
  const isMountedRef = useRef(true);
  const isSubmittingRef = useRef(false);
  const ownedScriptRef = useRef<HTMLScriptElement | null>(null);
  const buttonContainerRef = useRef<HTMLDivElement | null>(null);

  const [containerMounted, setContainerMounted] = useState(false);
  const [buttonWidth, setButtonWidth] = useState(320);
  const [scriptState, setScriptState] = useState<'idle' | 'ready' | 'error'>(() => {
    if (typeof window !== 'undefined' && (window as GoogleWindow).google?.accounts?.id) {
      return 'ready';
    }
    return 'idle';
  });
  const [scriptAttempt, setScriptAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const setButtonContainer = useCallback((node: HTMLDivElement | null) => {
    buttonContainerRef.current = node;
    setContainerMounted(Boolean(node));
  }, []);

  const configQuery = useQuery({
    queryKey: ['auth-config'],
    queryFn: () => fetchAuthConfig(),
  });

  const config = configQuery.data;
  const isEnabled = Boolean(
    config &&
    typeof config === 'object' &&
    'googleEnabled' in config &&
    config.googleEnabled &&
    config.googleClientId,
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Measure button container width immediately when node becomes available and on resize
  useEffect(() => {
    if (!containerMounted || !buttonContainerRef.current) return;
    const container = buttonContainerRef.current;

    const measure = () => {
      const clientWidth = container.clientWidth;
      if (clientWidth > 0) {
        const clamped = Math.max(200, Math.min(320, Math.floor(clientWidth)));
        setButtonWidth(clamped);
      }
    };

    measure();

    const observer = new ResizeObserver(() => {
      measure();
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [containerMounted]);

  // Load Google Identity Services script if Google linking is enabled
  useEffect(() => {
    if (!isEnabled) return;

    let active = true;

    const win = window as GoogleWindow;
    if (win.google?.accounts?.id) {
      queueMicrotask(() => {
        if (active && isMountedRef.current) setScriptState('ready');
      });
      return;
    }

    // 10-second timeout guard
    const timeoutId = setTimeout(() => {
      if (active && isMountedRef.current) {
        setScriptState('error');
      }
    }, GIS_LOAD_TIMEOUT_MS);

    const handleLoad = () => {
      if (!active || !isMountedRef.current) return;
      clearTimeout(timeoutId);
      const currentWin = window as GoogleWindow;
      // Validate that google.accounts.id actually exists after load
      if (currentWin.google?.accounts?.id) {
        setScriptState('ready');
      } else {
        setScriptState('error');
      }
    };

    const handleError = () => {
      if (!active || !isMountedRef.current) return;
      clearTimeout(timeoutId);
      setScriptState('error');
    };

    let script = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SCRIPT_URL}"]`);
    if (!script) {
      script = document.createElement('script');
      script.src = GIS_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.dataset.florabotGisOwner = SCRIPT_OWNER_TAG;
      ownedScriptRef.current = script;
      document.head.appendChild(script);
    } else if (script.dataset.florabotGisOwner === SCRIPT_OWNER_TAG) {
      ownedScriptRef.current = script;
    }

    script.addEventListener('load', handleLoad);
    script.addEventListener('error', handleError);

    return () => {
      active = false;
      clearTimeout(timeoutId);
      script?.removeEventListener('load', handleLoad);
      script?.removeEventListener('error', handleError);
    };
  }, [isEnabled, scriptAttempt]);

  const handleCredentialCallback = useCallback(
    async (response: GoogleCredentialResponse) => {
      if (!isMountedRef.current) return;
      // Guard against duplicate credential invocations
      if (isSubmittingRef.current) return;
      if (!response.credential) {
        setError('Không nhận được thông tin xác thực từ Google. Hãy thử lại.');
        return;
      }

      isSubmittingRef.current = true;
      setBusy(true);
      setError('');
      setNotice('');

      try {
        const result = await linkGoogleAccount({
          idToken: response.credential,
        });
        if (!isMountedRef.current) return;
        setNotice(result?.message || 'Đã liên kết tài khoản Google thành công.');
      } catch (cause) {
        if (!isMountedRef.current) return;
        if (cause instanceof ApiError) {
          if (cause.status === 409) {
            setError(
              cause.message ||
                `Email tài khoản Google không khớp với email tài khoản (${email || 'của bạn'}). Vui lòng chọn tài khoản Google có cùng email.`,
            );
          } else {
            setError(cause.message);
          }
        } else {
          setError('Chưa liên kết được tài khoản Google. Vui lòng thử lại sau.');
        }
      } finally {
        isSubmittingRef.current = false;
        if (isMountedRef.current) {
          setBusy(false);
        }
      }
    },
    [email],
  );

  const callbackRef = useRef(handleCredentialCallback);
  useEffect(() => {
    callbackRef.current = handleCredentialCallback;
  }, [handleCredentialCallback]);

  // Initialize and render GIS button
  useEffect(() => {
    if (!containerMounted || scriptState !== 'ready' || !isEnabled || !config?.googleClientId) {
      return;
    }
    const container = buttonContainerRef.current;
    if (!container) return;

    const win = window as GoogleWindow;
    const accounts = win.google?.accounts;
    if (!accounts?.id) return;

    accounts.id.initialize({
      client_id: config.googleClientId,
      callback: (res) => void callbackRef.current(res),
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    container.replaceChildren();
    accounts.id.renderButton(container, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      width: buttonWidth,
    });
  }, [containerMounted, scriptState, isEnabled, config?.googleClientId, buttonWidth]);

  const retryScript = () => {
    // Only remove owned script tag to avoid deleting another component's script
    if (
      ownedScriptRef.current &&
      ownedScriptRef.current.dataset.florabotGisOwner === SCRIPT_OWNER_TAG
    ) {
      ownedScriptRef.current.remove();
      ownedScriptRef.current = null;
    }
    setScriptAttempt((prev) => prev + 1);
  };

  return (
    <div id="member-google-link" className={styles.card}>
      <h3 className={styles.title}>Liên kết tài khoản Google</h3>
      <div className={styles.instruction}>
        <p>
          Liên kết tài khoản Google giúp bạn đăng nhập nhanh chóng chỉ với một chạm. Vui lòng chọn
          tài khoản Google sử dụng cùng email:{' '}
          <strong className={styles.emailHighlight}>{email || 'tài khoản của bạn'}</strong>.
        </p>
        <p className={styles.benefitNote}>
          Sau khi liên kết, bạn có thể đăng nhập bằng mật khẩu hiện tại hoặc bằng Google bất cứ lúc
          nào.
        </p>
      </div>

      {configQuery.isPending ? (
        <p role="status" className={styles.statusMessage}>
          Đang tải cấu hình liên kết Google…
        </p>
      ) : configQuery.isError ? (
        <div role="alert" className={styles.errorMessage}>
          <p>Chưa tải được cấu hình hệ thống.</p>
          <Button
            type="button"
            variant="outline"
            className={styles.retryButton}
            onClick={() => void configQuery.refetch()}
          >
            Tải lại
          </Button>
        </div>
      ) : !isEnabled ? (
        <p className={styles.infoNote}>
          Tính năng liên kết tài khoản Google hiện không khả dụng trên hệ thống.
        </p>
      ) : scriptState === 'error' ? (
        <div role="alert" className={styles.errorMessage}>
          <p>Không thể tải dịch vụ Google Identity. Vui lòng kiểm tra kết nối mạng và thử lại.</p>
          <Button
            type="button"
            variant="outline"
            className={styles.retryButton}
            onClick={retryScript}
          >
            Thử lại
          </Button>
        </div>
      ) : (
        <div className={styles.buttonWrapper}>
          {busy && (
            <p role="status" className={styles.statusMessage}>
              Đang xác thực và liên kết tài khoản Google…
            </p>
          )}
          {error && (
            <p role="alert" className={styles.errorMessage}>
              {error}
            </p>
          )}
          {notice && (
            <div role="status" className={styles.successMessage}>
              {notice}
            </div>
          )}
          <div
            ref={setButtonContainer}
            className={styles.buttonContainer}
            aria-busy={busy}
            data-testid="google-link-button-container"
          />
        </div>
      )}
    </div>
  );
}
