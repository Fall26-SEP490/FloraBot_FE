import { expect, it, vi } from 'vitest';
import {
  readConfigFlash,
  restartFromFlash,
} from '../apps/web/src/features/kiosk-management/usb/flash.mjs';

it('consumes the stub digest before the next command', async () => {
  const data = new Uint8Array(32);
  const loader = {
    DEFAULT_TIMEOUT: 3000,
    readFlash: vi.fn().mockResolvedValue(data),
    transport: { read: vi.fn().mockResolvedValue(new Uint8Array(16)) },
  };
  await expect(readConfigFlash(loader, data.length)).resolves.toBe(data);
  expect(loader.transport.read).toHaveBeenCalledWith(3000);
  loader.transport.read.mockResolvedValue(new Uint8Array(2));
  await expect(readConfigFlash(loader, data.length)).rejects.toThrow();
});

it('releases BOOT and pulses EN before returning to the application', async () => {
  vi.useFakeTimers();
  try {
    const signals: string[] = [];
    const restarting = restartFromFlash({
      setDTR: async (value: boolean) => signals.push('DTR ' + value),
      setRTS: async (value: boolean) => signals.push('RTS ' + value),
    });
    await vi.advanceTimersByTimeAsync(99);
    expect(signals).toEqual(['DTR false', 'RTS true']);
    await vi.advanceTimersByTimeAsync(1);
    await restarting;
    expect(signals).toEqual(['DTR false', 'RTS true', 'RTS false']);
  } finally {
    vi.useRealTimers();
  }
});
