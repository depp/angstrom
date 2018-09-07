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
    // Save one character.
    'eqeqeq': 'off',

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
    'no-param-reassign': 'off',
    'no-plusplus': 'off',
    'no-restricted-syntax': 'off',
    'no-multi-assign': 'off',

    // Good rule, except for code size.
    'no-shadow': 'off',

    // Stylistic differences.
    'no-use-before-define': 'off',

    // We don't care.
    'one-var': 'off',
    'one-var-declaration-per-line': 'off',

    // A bit too annoying to leave as an error.
    'prefer-const': 'warn',

    // Annoying.
    'prefer-template': 'off',

    // We want to put spaces freely.
    'space-infix-ops': 'off',
  },
};
