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

    // Necessary for making code small.
    'import/no-mutable-exports': 'off',

    // Complete garbage.
    'import/prefer-default-export': 'off',

    // OpenGL demands otherwise.
    'no-bitwise': 'off',

    // Too useful for development.
    // TODO: Find a way to enable this for release builds.
    'no-console': 'off',

    // One of the most ill-conceived rules I have ever seen.
    'no-continue': 'off',

    // JS13K code is going to be a little different.
    'no-plusplus': 'off',
    'no-restricted-syntax': 'off',

    // Stylistic differences.
    'no-use-before-define': 'off',

    // A bit too annoying to leave as an error.
    'prefer-const': 'warn',

    // Annoying.
    'prefer-template': 'off',
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
