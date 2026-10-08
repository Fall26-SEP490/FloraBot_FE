export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', ['landing', 'kiosk', 'portal', 'contracts', 'ui', 'infra']],
  },
};
