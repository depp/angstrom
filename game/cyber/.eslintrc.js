module.exports = {
  env: {
    browser: true,
    es6: true,
  },
  extends: 'airbnb-base',
  globals: {
    DEBUG: true,
    RELEASE: true,
  },
  parserOptions: {
    ecmaVersion: 8, // 2017
    sourceType: 'module',
  },
  rules: {
    'default-case': 'off',
    // Save one character.
    'eqeqeq': 'off',

    // Just let Rollup catch import errors.
    'import/no-absolute-path': 'off',
    'import/no-unresolved': 'off',

    // Necessary for making code small.
    'import/no-mutable-exports': 'off',

    // Complete garbage.
    'import/prefer-default-export': 'off',

    'max-len': ['error', { code: 80 }],

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
    'no-nested-ternary': 'off',

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

    // We like to line data up.
    'no-multi-spaces': 'off',
    'array-bracket-spacing': 'off',

    // We use square bracket notation to signal to Terser that the properties
    // should not be mangled. This is mostly used for input bindings.
    'dot-notation': 'off',

    // Don't know why this one exists.
    'class-methods-use-this': 'off',

    // Needed for GLSL minifier.
    'import/no-extraneous-dependencies': 'dev-dependencies',
  },
};
