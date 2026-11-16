module.exports = {
  extends: 'expo',
  ignorePatterns: ['/dist/*', '/.expo/*'],
  rules: {
    // TypeScript performs module resolution; this rule traverses outside the
    // workspace on Windows and fails before reporting source diagnostics.
    'import/no-unresolved': 'off',
  },
};
