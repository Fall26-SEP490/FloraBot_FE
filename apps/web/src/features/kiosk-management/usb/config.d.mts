export interface DeviceFields {
  hardwareId: string;
  mqttHost: string;
  mqttPort: string;
  mqttPassword: string;
  hmacKeyHex: string;
  caCertificate: string;
}

export type DeviceConfigInput = DeviceFields & { wifiSsid: string; wifiPassword: string };

export function parseConfigHeader(text: string): DeviceFields;
export function validateConfig(config: DeviceConfigInput): unknown;
