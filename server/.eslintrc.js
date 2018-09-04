module.exports = {
  env: {
    browser: true,
    es6: true,
  },
  extends: 'airbnb-base',
  parserOptions: {
    ecmaVersion: 8, // 2017
    sourceType: 'script',
  },
  rules: {
    // Too useful for development.
    'no-console': 'off',

    // One of the most ill-conceived rules I have ever seen.
    'no-continue': 'off',
    'no-plusplus': 'off',

    // JS13K code is going to be a little different.
    'no-restricted-syntax': 'off',

    // A bit too annoying to leave as an error.
    'prefer-const': 'warn',
  },
};
