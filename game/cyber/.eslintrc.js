module.exports = {
  env: {
    browser: true,
  },
  extends: 'airbnb-base',
  rules: {
    'no-console': 'off',
    'import/no-extraneous-dependencies': 'devDependencies',
    'no-restricted-syntax': 'off',
    'prefer-const': 'warn',
    'no-plusplus': 'off',
  },
};
