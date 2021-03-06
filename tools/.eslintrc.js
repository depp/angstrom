module.exports = {
  env: {
    node: true,
  },
  extends: 'airbnb-base',
  rules: {
    'import/no-extraneous-dependencies': ['error', {devDependencies: true}],
    'max-len': ['error', { code: 80 }],
    'no-console': 'off',
    'no-plusplus': 'off',
    'no-restricted-syntax': 'off',
  },
};
