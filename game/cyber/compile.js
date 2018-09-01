const fs = require('fs');
const rollup = require('rollup');
const { promisify } = require('util');

const sourcemaps = require('rollup-plugin-sourcemaps');
const includePaths = require('rollup-plugin-includepaths');

const writeFile = promisify(fs.writeFile);

const root = 'game/cyber';

// ErrorResolver resolves every import as an error. This is inserted in the
// plugin chain after all other resolvers, so this generates errors for imports
// that are not resolved elsewhere.
class ErrorResolver {
  static resolveId(id, origin) {
    throw new Error(`Unknown module ${id} referenced from ${origin}`);
  }
}

const inputOptions = {
  input: 'main',
  plugins: [
    includePaths({
      paths: [root],
      extensions: ['.js'],
    }),
    new ErrorResolver(),
    sourcemaps(),
  ],
};

const outputOptions = {
  format: 'iife',
  name: 'Game',
  sourcemap: true,
};

async function compile() {
  const bundle = await rollup.rollup(inputOptions);
  // Absolute source file paths in bundle.modules[].id.
  const { code, map } = await bundle.generate(outputOptions);
  await writeFile(`${root}/game.js`, code);
  await writeFile(`${root}/game.js.map`, JSON.stringify(map));
}

compile();
