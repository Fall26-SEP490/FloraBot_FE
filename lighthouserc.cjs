module.exports = {
  ci: {
    collect: {
      url: ['http://127.0.0.1:3010/'],
      numberOfRuns: 1,
      chromePath: require('@playwright/test').chromium.executablePath(),
      settings: { chromeFlags: '--headless --no-sandbox' },
    },
    assert: {
      assertions: {
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:performance': ['error', { minScore: 0.90 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
      },
    },
    upload: { target: 'filesystem', outputDir: './artifacts/lighthouse' },
  },
};
