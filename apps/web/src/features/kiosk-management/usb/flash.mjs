import {
  configurationImage,
  configAddress,
  configSize,
  firmwareFiles,
  hexDigest,
  journalSize,
  journalStart,
} from './config.mjs';

async function loadFirmware(baseUrl, installFirmware) {
  const response = await globalThis.fetch(baseUrl + '/manifest.json', {
    cache: 'no-store',
    redirect: 'error',
  });
  if (response.status === 503) throw new Error('Dịch vụ firmware chưa được cấu hình.');
  if (!response.ok)
    throw new Error('Chưa đọc được manifest firmware. Kiểm tra dịch vụ firmware rồi thử lại.');
  const manifest = await response.json();
  if (!Array.isArray(manifest) || manifest.length !== firmwareFiles.length) {
    throw new Error('Manifest firmware không đúng định dạng.');
  }

  return Promise.all(
    firmwareFiles.map(async (file) => {
      const entry = manifest.find((item) => item.name === file.name);
      if (
        !entry ||
        entry.address !== file.address ||
        !Number.isInteger(entry.size) ||
        entry.size < 1 ||
        file.address + Math.ceil(entry.size / 4096) * 4096 > file.limit ||
        !/^[a-f0-9]{64}$/.test(entry.sha256) ||
        !/^[a-f0-9]{32}$/.test(entry.md5)
      ) {
        throw new Error('Phát hiện file firmware hoặc địa chỉ flash không hợp lệ.');
      }

      if (!installFirmware) return entry;

      const downloaded = await globalThis.fetch(baseUrl + '/' + file.name, {
        cache: 'no-store',
        redirect: 'error',
      });
      if (!downloaded.ok) throw new Error('Thiếu file ' + file.name + '.');
      const data = new Uint8Array(await downloaded.arrayBuffer());
      const checksum = await globalThis.crypto.subtle.digest('SHA-256', data);
      if (data.length !== entry.size || hexDigest(checksum) !== entry.sha256) {
        throw new Error('Kiểm tra checksum thất bại với ' + file.name + '.');
      }
      return { ...entry, data };
    }),
  );
}

async function verifyOnBoard(loader, entries) {
  for (const file of entries) {
    if ((await loader.flashMd5sum(file.address, file.size)).toLowerCase() !== file.md5) {
      throw new Error('Bo chưa có đúng phiên bản firmware và bảng phân vùng của gói này.');
    }
  }
}

async function readJournalChecksum(loader) {
  const checksum = await loader.flashMd5sum(journalStart, journalSize);
  if (!/^[a-f0-9]{32}$/i.test(checksum)) {
    throw new Error('Không đọc được checksum vùng journal trên bo.');
  }
  return checksum.toLowerCase();
}

// esptool-js 0.7.1 acknowledges the last data block but leaves the stub's
// separate 16-byte digest in the serial stream. Consume it before the next command.
export async function readConfigFlash(loader, length) {
  const data = await loader.readFlash(configAddress, length);
  const trailer = await loader.transport.read(loader.DEFAULT_TIMEOUT);
  if (data.length !== length || trailer?.length !== 16) {
    throw new Error('ESP32 trả thiếu dữ liệu hoặc gói kết thúc khi đọc vùng cấu hình.');
  }
  return data;
}

async function ensureSameKiosk(loader, hardwareId, confirmTransfer) {
  const data = await readConfigFlash(loader, configSize);
  if (new globalThis.TextDecoder().decode(data.subarray(0, 4)) !== 'FBC1') return;

  const size = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(4, true);
  const payload = data.subarray(40, 40 + size);
  if (
    size < 1 ||
    size > 8192 ||
    hexDigest(await globalThis.crypto.subtle.digest('SHA-256', payload)) !==
      hexDigest(data.slice(8, 40))
  ) {
    throw new Error('Cấu hình đang có trên bo bị lỗi. Liên hệ phụ trách kỹ thuật trước khi nạp.');
  }
  const existing = JSON.parse(new globalThis.TextDecoder('utf-8', { fatal: true }).decode(payload));
  if (existing.hardwareId !== hardwareId) {
    if (
      typeof existing.hardwareId === 'string' &&
      /^[a-zA-Z0-9_-]{1,64}$/.test(existing.hardwareId) &&
      confirmTransfer?.(existing.hardwareId, hardwareId)
    )
      return;
    throw new Error('Bo đang có cấu hình của tủ khác. Kiểm tra lại cáp USB và đúng tủ được giao.');
  }
}

// Classic ESP32 boards with a USB-UART bridge boot from flash with IO0 high
// and a low-to-high pulse on EN. esptool-js 0.7.1 only releases RTS here.
export async function restartFromFlash(transport) {
  await transport.setDTR(false);
  await transport.setRTS(true);
  try {
    await new Promise((resolve) => globalThis.setTimeout(resolve, 100));
  } finally {
    await transport.setRTS(false);
  }
}

export async function flashEsp32(options, { ESPLoader, Transport }) {
  const { port, config, installFirmware, firmwareBase, beforeWrite, onProgress, onStatus } =
    options;
  const firmware = await loadFirmware(firmwareBase, installFirmware);

  const transport = new Transport(port, false);
  try {
    onStatus?.('Đang kiểm tra bo ESP32…');
    const loader = new ESPLoader({
      transport,
      baudrate: 115200,
      enableTracing: false,
      debugLogging: false,
    });
    await loader.main();

    const size = /^(\d+)MB(?:-c1)?$/.exec(await loader.detectFlashSize());
    if (loader.chip.CHIP_NAME !== 'ESP32' || !size || Number(size[1]) < 4) {
      throw new Error('Gói này chỉ hỗ trợ bo ESP32 cổ điển có flash ít nhất 4 MB.');
    }

    await ensureSameKiosk(loader, config.hardwareId, options.confirmTransfer);
    if (!installFirmware) {
      await verifyOnBoard(
        loader,
        firmware.filter((file) => ['partitions.bin', 'firmware.bin'].includes(file.name)),
      );
    }

    const image = await configurationImage(config);
    const images = installFirmware ? firmware.map(({ address, data }) => ({ address, data })) : [];
    images.push({ address: configAddress, data: image });
    onStatus?.('Đang kiểm tra vùng journal…');
    const journalBefore = await readJournalChecksum(loader);
    await beforeWrite?.();

    onStatus?.('Đang bắt đầu ghi flash…');
    await loader.writeFlash({
      fileArray: images,
      flashMode: 'keep',
      flashFreq: 'keep',
      flashSize: 'keep',
      eraseAll: false,
      compress: true,
      reportProgress(index, written, total) {
        onProgress?.(Math.floor((95 * (index + written / total)) / images.length));
      },
    });

    onStatus?.('Đang kiểm tra dữ liệu sau khi ghi…');
    if (installFirmware) await verifyOnBoard(loader, firmware);
    const readBack = await readConfigFlash(loader, image.length);
    if (
      hexDigest(await globalThis.crypto.subtle.digest('SHA-256', readBack)) !==
      hexDigest(await globalThis.crypto.subtle.digest('SHA-256', image))
    ) {
      throw new Error('Cấu hình đọc lại từ ESP32 sai checksum.');
    }
    if ((await readJournalChecksum(loader)) !== journalBefore) {
      throw new Error('Checksum vùng journal đã thay đổi. Dừng thử và gửi lại thông báo này.');
    }
    await restartFromFlash(transport);
  } finally {
    try {
      await transport.disconnect();
    } catch {
      // Pulling the USB cable already closed the physical connection.
    }
  }
}
