export const journalStart = 0x310000;
export const journalSize = 0x20000;
export const configAddress = journalStart + journalSize;
export const configSize = 0x8000;
export const firmwareFiles = [
  { name: 'bootloader.bin', address: 0x1000, limit: 0x8000 },
  { name: 'partitions.bin', address: 0x8000, limit: 0x9000 },
  { name: 'boot_app0.bin', address: 0xe000, limit: 0x10000 },
  { name: 'firmware.bin', address: 0x10000, limit: journalStart },
];

const encoder = new globalThis.TextEncoder();

function field(input, key, limit, allowEmpty = false) {
  const value = input[key];
  if (
    typeof value !== 'string' ||
    value.includes('\0') ||
    (!allowEmpty && value.length === 0) ||
    encoder.encode(value).length > limit
  ) {
    throw new Error('Dữ liệu không hợp lệ ở ô ' + key + '.');
  }
  return value;
}

export function validateConfig(input) {
  const config = {
    version: 1,
    hardwareId: field(input, 'hardwareId', 64),
    wifiSsid: field(input, 'wifiSsid', 32),
    wifiPassword: field(input, 'wifiPassword', 64, true),
    mqttHost: field(input, 'mqttHost', 253),
    mqttPort: Number(input.mqttPort),
    mqttPassword: field(input, 'mqttPassword', 256),
    hmacKeyHex: field(input, 'hmacKeyHex', 64),
    caCertificate: field(input, 'caCertificate', 4096),
  };
  if (!/^[A-Za-z0-9_-]+$/.test(config.hardwareId)) {
    throw new Error('Mã thiết bị chỉ nhận chữ, số, gạch ngang và gạch dưới.');
  }
  if (
    !/^[A-Za-z0-9.-]+$/.test(config.mqttHost) ||
    !Number.isInteger(config.mqttPort) ||
    config.mqttPort < 1 ||
    config.mqttPort > 65535
  ) {
    throw new Error('Nhập tên miền hoặc IPv4 của MQTT TLS và một cổng hợp lệ.');
  }
  if (!/^[a-fA-F0-9]{64}$/.test(config.hmacKeyHex)) {
    throw new Error('Khóa HMAC phải có đúng 64 ký tự hex.');
  }
  if (
    !/^-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----\s*$/.test(config.caCertificate)
  ) {
    throw new Error('Dán chứng chỉ CA ở định dạng PEM.');
  }
  return config;
}

export function parseConfigHeader(text) {
  const keys = ['hardwareId', 'mqttHost', 'mqttPassword', 'hmacKeyHex', 'caCertificate'];
  const values = {};
  for (const key of keys) {
    const pattern = new RegExp(
      '^\\s*inline constexpr char ' + key + '\\[\\] = "((?:[^"\\\\\\r\\n]|\\\\[0-7]{3})*)";\\s*$',
      'gm',
    );
    const matches = Array.from(text.matchAll(pattern));
    if (matches.length !== 1)
      throw new Error('File cấu hình BE thiếu hoặc lặp trường ' + key + '.');
    const bytes = [];
    for (const part of matches[0][1].matchAll(/\\([0-7]{3})|([^\\])/g)) {
      const code = part[1] ? Number.parseInt(part[1], 8) : part[2].charCodeAt(0);
      if (code > 255) throw new Error('File cấu hình BE có byte không hợp lệ.');
      bytes.push(code);
    }
    values[key] = new globalThis.TextDecoder('utf-8', { fatal: true }).decode(
      Uint8Array.from(bytes),
    );
  }
  const ports = Array.from(text.matchAll(/^\s*inline constexpr uint16_t mqttPort = (\d+);\s*$/gm));
  if (ports.length !== 1) throw new Error('File cấu hình BE thiếu hoặc lặp cổng MQTT.');
  values.mqttPort = ports[0][1];
  return values;
}

export function hexDigest(bytes) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function configurationImage(config) {
  const payload = encoder.encode(JSON.stringify(validateConfig(config)));
  if (payload.length > 8192) throw new Error('Cấu hình thiết bị vượt kích thước cho phép.');
  const image = new Uint8Array(configSize).fill(0xff);
  image.set(encoder.encode('FBC1'));
  new DataView(image.buffer).setUint32(4, payload.length, true);
  image.set(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', payload)), 8);
  image.set(payload, 40);
  return image;
}
