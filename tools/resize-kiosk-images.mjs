import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Use the image processor already shipped with Astro; generation is an offline asset task.
const require = createRequire(new URL('../apps/landing/package.json', import.meta.url));
const sharp = createRequire(require.resolve('astro/package.json'))('sharp');
const source = fileURLToPath(
  new URL('../apps/landing/public/images/kiosk-model.png', import.meta.url),
);

for (const width of [240, 480, 720]) {
  for (const format of ['avif', 'webp']) {
    const target = fileURLToPath(
      new URL(`../apps/landing/public/images/kiosk-model-${width}.${format}`, import.meta.url),
    );
    await sharp(source)
      .resize({ width, withoutEnlargement: true })
      .toFormat(format, { quality: format === 'avif' ? 55 : 80 })
      .toFile(target);
  }
}
