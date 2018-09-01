module.exports = {
  env: {
    browser: true,
  },
  extends: 'airbnb-base',
  rules: {
    'no-console': 'off',
    'import/no-extraneous-dependencies': 'devDependencies',
    'no-restricted-syntax': 0,
    'prefer-const': 0,
    'no-plusplus': 0,
  },
};
