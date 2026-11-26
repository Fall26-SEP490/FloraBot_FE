'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button } from '@florabot/ui';
import { downloadEsp32, Esp32RequestError, readEsp32 } from './esp32-config';
import { parseConfigHeader, validateConfig, type DeviceFields } from './usb/config.mjs';

type SerialNavigator = Navigator & {
  serial: { requestPort: () => Promise<SerialPort> };
};

const supported = () =>
  typeof window !== 'undefined' && window.isSecureContext && 'serial' in navigator;

async function awaitHeartbeat(
  path: string,
  hardwareId: string,
  previous: number,
  signal: AbortSignal,
) {
  const deadline = Date.now() + 90_000;
  while (!signal.aborted && Date.now() < deadline) {
    const info = await readEsp32(path, signal);
    if (info.hardwareId !== hardwareId) throw new Error('Định danh tủ đã thay đổi.');
    const received = Date.parse(info.lastHeartbeatAt ?? '') || 0;
    if (info.status === 'ONLINE' && received > previous) return info.lastHeartbeatAt;
    await new Promise((resolve) => window.setTimeout(resolve, 4500));
  }
  return null;
}

export function Esp32UsbProvisioner({
  path,
  hardwareId,
  onClose,
}: {
  path: string;
  hardwareId: string;
  onClose: () => void;
}) {
  const fields = useRef<DeviceFields | null>(null);
  const active = useRef<AbortController | null>(null);
  const label = useId();
  const [ready, setReady] = useState(false);
  const available = supported();
  const [busy, setBusy] = useState(false);
  const [written, setWritten] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    return () => {
      active.current?.abort();
      fields.current = null;
    };
  }, []);

  async function authorize(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (active.current) return;
    const input = event.currentTarget.elements.namedItem('password') as HTMLInputElement;
    const password = input.value;
    input.value = '';
    if (!password || new TextEncoder().encode(password).length > 72) {
      setError('Kiểm tra lại mật khẩu hiện tại.');
      return;
    }
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError('');
    try {
      const file = await downloadEsp32(path, password, controller.signal);
      if (file.size > 16 * 1024) throw new Error('File cấu hình vượt kích thước cho phép.');
      const parsed = parseConfigHeader(await file.text());
      if (parsed.hardwareId !== hardwareId) throw new Error('File cấu hình chưa đúng với tủ này.');
      if (controller.signal.aborted) return;
      fields.current = parsed;
      setReady(true);
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(
          cause instanceof Esp32RequestError
            ? cause.message
            : 'Chưa lấy được cấu hình cho đúng tủ.',
        );
      }
    } finally {
      active.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  async function flash(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (active.current || !fields.current) return;
    const data = new FormData(event.currentTarget);
    const secret = event.currentTarget.elements.namedItem('wifiPassword') as HTMLInputElement;
    const config = {
      ...fields.current,
      wifiSsid: String(data.get('wifiSsid') ?? ''),
      wifiPassword: secret.value,
    };
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError('');
    setMessage('');
    setProgress(0);
    try {
      validateConfig(config);
      // Opening the serial picker requires the current click, before any network await.
      const port = await (navigator as SerialNavigator).serial.requestPort();
      const [flasher, tools] = await Promise.all([import('./usb/flash.mjs'), import('esptool-js')]);
      let previous = 0;
      await flasher.flashEsp32(
        {
          port,
          config,
          installFirmware: data.has('installFirmware'),
          firmwareBase: '/api/esp32-firmware',
          beforeWrite: async () => {
            const current = await readEsp32(path, controller.signal);
            controller.signal.throwIfAborted();
            if (
              !current.canDownload ||
              !current.mqttClientIdsMatch ||
              current.hardwareId !== hardwareId
            ) {
              throw new Error('Ca lắp đặt hoặc định danh tủ đã thay đổi.');
            }
            previous = Date.parse(current.lastHeartbeatAt ?? '') || 0;
          },
          onProgress(percent) {
            if (controller.signal.aborted) return;
            setProgress(percent);
            setMessage('Đang nạp qua USB…');
          },
          onStatus(status) {
            if (!controller.signal.aborted) setMessage(status);
          },
        },
        tools,
      );
      if (controller.signal.aborted) return;
      fields.current = null;
      secret.value = '';
      setWritten(true);
      setProgress(100);
      setMessage('Đã nạp qua USB. Vùng journal giữ nguyên. Đang chờ heartbeat mới.');
      const heartbeat = await awaitHeartbeat(path, hardwareId, previous, controller.signal);
      if (!controller.signal.aborted) {
        setMessage(
          heartbeat
            ? 'Tủ đã gửi heartbeat mới về hệ thống.'
            : 'Chưa thấy heartbeat mới. Kiểm tra Wi-Fi và trạng thái tủ.',
        );
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(
          cause instanceof DOMException && cause.name === 'NotFoundError'
            ? 'Bạn chưa chọn cổng USB.'
            : cause instanceof Error
              ? cause.message
              : 'Chưa hoàn tất kiểm tra thiết bị.',
        );
      }
    } finally {
      active.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return (
    <section className="esp32-usb" aria-labelledby={label}>
      <h3 id={label}>Nạp ESP32 qua USB</h3>
      {!available && <p>Dùng Chrome hoặc Edge trên máy tính để kết nối USB.</p>}
      {available && !ready && (
        <form className="esp32-password" onSubmit={authorize}>
          <label>
            Mật khẩu hiện tại
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              disabled={busy}
            />
          </label>
          <Button type="submit" disabled={busy}>
            {busy ? 'Đang xác thực…' : 'Xác thực để nạp'}
          </Button>
        </form>
      )}
      {available && ready && !written && (
        <form className="esp32-password" onSubmit={flash}>
          <label>
            Tên Wi-Fi
            <input name="wifiSsid" maxLength={32} required disabled={busy} />
          </label>
          <label>
            Mật khẩu Wi-Fi
            <input
              name="wifiPassword"
              type="password"
              maxLength={64}
              autoComplete="new-password"
              disabled={busy}
            />
          </label>
          <label className="esp32-usb-checkbox">
            <input name="installFirmware" type="checkbox" disabled={busy} />
            Nạp cả firmware lần đầu hoặc khi đổi phiên bản
          </label>
          <Button type="submit" disabled={busy}>
            Chọn cổng USB và nạp
          </Button>
        </form>
      )}
      {(progress > 0 || written) && (
        <progress max={100} value={progress} aria-label="Tiến độ nạp ESP32" />
      )}
      {written && <p>Ghi USB và kiểm tra journal thành công.</p>}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      <div className="esp32-actions">
        <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
          Đóng
        </Button>
      </div>
    </section>
  );
}
