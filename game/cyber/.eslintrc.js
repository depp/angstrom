module.exports = {
  env: {
    browser: true,
    es6: true,
  },
  extends: 'airbnb-base',
  parserOptions: {
    ecmaVersion: 8, // 2017
    sourceType: 'module',
  },
  rules: {
    // Just let Rollup catch import errors.
    'import/no-absolute-path': 'off',
    'import/no-unresolved': 'off',

    // Too useful for development.
    // TODO: Find a way to enable this for release builds.
    'no-console': 'off',

    // JS13K code is going to be a little different.
    'no-plusplus': 'off',
    'no-restricted-syntax': 'off',

    // A bit too annoying to leave as an error.
    'prefer-const': 'warn',
  },
  overrides: [
    {
      files: ["compile.js"],
      env: {
        browser: false,
        node: true,
      },
      rules: {
        'import/no-absolute-path': 'error',
        'import/no-unresolved': 'error',
        'import/no-extraneous-dependencies': 'devDependencies',
      },
    }
  ],
};
