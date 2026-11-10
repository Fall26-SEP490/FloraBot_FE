'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import {
  downloadEsp32,
  esp32Path,
  Esp32RequestError,
  esp32Unavailable,
  provisionEsp32,
  readEsp32,
  type Esp32Role,
} from './esp32-config';
import './styles/esp32-configuration.css';

const provisioningLabels = {
  PENDING: 'Chờ cấp cấu hình',
  PROVISIONING: 'Đang cấp cấu hình',
  READY: 'Cấu hình sẵn sàng',
  FAILED: 'Cấp cấu hình thất bại',
};

type PanelProps = {
  scope: Esp32Role;
  resourceId: string;
  actorId: string;
  initiallyOpen?: boolean;
};

export function Esp32ConfigurationPanel(props: PanelProps) {
  const { actorId, scope, resourceId, initiallyOpen } = props;
  const [open, setOpen] = useState(!!initiallyOpen);
  return (
    <details
      className="esp32-configuration"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Cấu hình ESP32</summary>
      {open && <Esp32ConfigurationBody key={`${actorId}:${scope}:${resourceId}`} {...props} />}
    </details>
  );
}

function Esp32ConfigurationBody({ scope: role, resourceId, actorId }: PanelProps) {
  const path = esp32Path(role, resourceId);
  const [busy, setBusy] = useState<'provision' | 'download' | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [actionError, setActionError] = useState<Esp32RequestError | Error | null>(null);
  const [notice, setNotice] = useState('');
  const [retryDisabled, setRetryDisabled] = useState(false);
  const [downloadBlocked, setDownloadBlocked] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const operation = useRef<AbortController | null>(null);
  const passwordId = useId();
  const config = useQuery({
    queryKey: ['esp32-config', actorId, role, resourceId],
    queryFn: ({ signal }) => readEsp32(path, signal),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchInterval: (query) => {
      const state = query.state.data?.provisioning?.state;
      return query.state.status === 'success' && (state === 'PENDING' || state === 'PROVISIONING')
        ? 3000
        : false;
    },
  });

  useEffect(() => () => operation.current?.abort(), []);
  useEffect(() => {
    if (showPassword) input.current?.focus();
  }, [showPassword]);

  const data = config.data;
  const privileged = role !== 'admin';
  const accessLost =
    actionError instanceof Esp32RequestError &&
    (actionError.status === 403 ||
      actionError.status === 404 ||
      (actionError.status === 401 && actionError.code !== 'ESP32_CONFIG_REAUTHENTICATION_FAILED'));
  const canDownload =
    privileged && !config.isError && !!data?.canDownload && !accessLost && !downloadBlocked;
  const canRetry =
    privileged && !retryDisabled && !accessLost && data?.provisioning?.state === 'FAILED';

  async function reload() {
    const result = await config.refetch();
    if (!result.isSuccess) return;
    setDownloadBlocked(false);
    setActionError(null);
  }

  async function runAction(kind: 'provision' | 'download', password?: string) {
    if (operation.current) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(kind);
    setActionError(null);
    setNotice('');
    try {
      if (kind === 'provision') {
        await provisionEsp32(path, controller.signal);
        if (controller.signal.aborted) return;
        setNotice('Đã gửi yêu cầu cấp lại cấu hình cho tủ này.');
        setDownloadBlocked(false);
        await config.refetch();
      } else if (password !== undefined) {
        const file = await downloadEsp32(path, password, controller.signal);
        if (controller.signal.aborted) return;
        const objectUrl = URL.createObjectURL(file);
        try {
          const link = document.createElement('a');
          link.href = objectUrl;
          link.download = 'config.local.h';
          document.body.append(link);
          link.click();
          link.remove();
        } finally {
          window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        }
        setShowPassword(false);
        setNotice('Đã tải config.local.h. Điền Wi-Fi tại nơi lắp đặt trước khi nạp ESP32.');
      }
    } catch (cause) {
      if (controller.signal.aborted) return;
      const error =
        cause instanceof Esp32RequestError
          ? cause
          : new Error('Chưa hoàn tất thao tác. Kiểm tra kết nối rồi thử lại.');
      setActionError(error);
      if (error instanceof Esp32RequestError && error.code === 'ESP32_AUTO_PROVISIONING_DISABLED')
        setRetryDisabled(true);
      if (kind === 'download' && error instanceof Esp32RequestError && error.status === 409) {
        setDownloadBlocked(true);
        setShowPassword(false);
        await config.refetch();
      }
    } finally {
      operation.current = null;
      if (!controller.signal.aborted) setBusy(null);
    }
  }

  const phase = data?.provisioning;
  const unavailable = esp32Unavailable(data?.downloadUnavailableCode);
  return (
    <div className="esp32-content">
      {config.isPending ? (
        <p role="status">Đang đọc thông số ESP32…</p>
      ) : config.isError ? (
        <p role="alert">
          {config.error instanceof Esp32RequestError
            ? config.error.message
            : 'Chưa đọc được thông số ESP32.'}
        </p>
      ) : (
        data &&
        !accessLost && (
          <>
            <dl className="esp32-data">
              <div>
                <dt>Mã tủ</dt>
                <dd>{data.kioskCode}</dd>
              </div>
              <div>
                <dt>UUID tủ</dt>
                <dd>{data.kioskId}</dd>
              </div>
              <div>
                <dt>Kết nối thiết bị</dt>
                <dd>
                  {data.status === 'ONLINE'
                    ? 'ONLINE · Trực tuyến'
                    : data.status === 'OFFLINE'
                      ? 'OFFLINE · Chưa kết nối'
                      : data.status}
                </dd>
              </div>
              <div>
                <dt>Cấp cấu hình</dt>
                <dd aria-live="polite">
                  {phase ? provisioningLabels[phase.state] : 'Không có tiến trình tự cấp'}
                </dd>
              </div>
              <div>
                <dt>Hardware ID</dt>
                <dd>{data.hardwareId}</dd>
              </div>
              <div>
                <dt>MQTT Client ID đăng ký</dt>
                <dd>{data.mqttClientId}</dd>
              </div>
              <div>
                <dt>MQTT Client ID của firmware</dt>
                <dd>{data.firmwareMqttClientId}</dd>
              </div>
              <div>
                <dt>Broker MQTT</dt>
                <dd>{data.mqttHost ?? 'Chưa cấu hình'}</dd>
              </div>
              <div>
                <dt>Cổng TLS</dt>
                <dd>{data.mqttTlsPort ?? 'Chưa cấu hình'}</dd>
              </div>
            </dl>
            {!data.mqttClientIdsMatch && (
              <p role="status">
                Hai MQTT Client ID chưa khớp. Kiểm tra định danh tủ trước khi nạp firmware.
              </p>
            )}
            {phase?.state === 'FAILED' && phase.errorCode && (
              <p>
                Mã lỗi cấp cấu hình <code>{phase.errorCode}</code> · Đã thử {phase.attempts} lần.
              </p>
            )}
            {unavailable && <p>{unavailable}</p>}
            {phase?.state === 'READY' && data.status === 'OFFLINE' && (
              <p>Tủ sẽ chuyển ONLINE khi máy chủ nhận tín hiệu hợp lệ từ ESP32.</p>
            )}
            {data.caCertificatePem && (
              <details className="esp32-ca">
                <summary>Chứng chỉ CA công khai</summary>
                <pre>{data.caCertificatePem}</pre>
              </details>
            )}
            {role === 'admin' && (
              <Link href={`/admin/reports?esp32Kiosk=${encodeURIComponent(data.kioskId)}`}>
                Xem nhật ký tải cấu hình
              </Link>
            )}
          </>
        )
      )}
      {actionError && <p role="alert">{actionError.message}</p>}
      {notice && <p role="status">{notice}</p>}
      <div className="esp32-actions">
        <Button
          type="button"
          variant="outline"
          disabled={config.isFetching || !!busy}
          onClick={() => void reload()}
        >
          Tải lại thông số
        </Button>
        {!config.isError && canRetry && (
          <Button
            type="button"
            variant="outline"
            disabled={!!busy}
            onClick={() => void runAction('provision')}
          >
            {busy === 'provision' ? 'Đang gửi…' : 'Thử cấp lại'}
          </Button>
        )}
        {canDownload && !showPassword && (
          <Button type="button" disabled={!!busy} onClick={() => setShowPassword(true)}>
            Tải cấu hình ESP32
          </Button>
        )}
      </div>
      {canDownload && showPassword && (
        <form
          className="esp32-password"
          onSubmit={(event) => {
            event.preventDefault();
            if (operation.current || !input.current?.value) return;
            const password = input.current.value;
            input.current.value = '';
            if (new TextEncoder().encode(password).length > 72) {
              setActionError(
                new Error('Mật khẩu vượt giới hạn xác thực. Kiểm tra lại mật khẩu hiện tại.'),
              );
              return;
            }
            void runAction('download', password);
          }}
        >
          <label htmlFor={passwordId}>Mật khẩu hiện tại</label>
          <input
            id={passwordId}
            ref={input}
            type="password"
            autoComplete="current-password"
            required
            disabled={!!busy}
          />
          <div className="esp32-actions">
            <Button type="submit" disabled={!!busy}>
              {busy === 'download' ? 'Đang xác thực…' : 'Xác thực và tải file'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!!busy}
              onClick={() => {
                setShowPassword(false);
                setActionError(null);
              }}
            >
              Hủy
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
