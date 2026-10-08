module.exports = {
  defaults: {
    standard: 'WCAG2AA',
    chromeLaunchConfig: { executablePath: require('@playwright/test').chromium.executablePath(), args: ['--no-sandbox'] },
    viewport: { width: 390, height: 844 },
    timeout: 30000,
  },
  urls: ['http://127.0.0.1:3010/', 'http://127.0.0.1:3010/chinh-sach-rieng-tu/'],
};
