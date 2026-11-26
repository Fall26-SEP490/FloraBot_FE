import type { DeviceConfigInput } from './config.mjs';

export function flashEsp32(
  options: {
    port: SerialPort;
    config: DeviceConfigInput;
    installFirmware: boolean;
    firmwareBase: string;
    beforeWrite: () => Promise<void>;
    onProgress: (percent: number) => void;
    onStatus: (message: string) => void;
  },
  tools: typeof import('esptool-js'),
): Promise<void>;
