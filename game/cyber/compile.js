const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const rollup = require('rollup');
const sourcemaps = require('rollup-plugin-sourcemaps');

const { CLIEngine } = require('eslint');

const close = promisify(fs.close);
const fstat = promisify(fs.fstat);
const open = promisify(fs.open);
const readFile = promisify(fs.readFile);

// A FileSet loads files and records them as dependencies.
class FileSet {
  constructor() {
    this.files = {};
    this.deps = [];
  }

  load(file) {
    const source = this.files[file];
    if (source) {
      return source;
    }
    const r = (async () => {
      let fd;
      try {
        fd = await open(file, 'r');
      } catch (err) {
        if (err.code === 'ENOENT') {
          return null;
        }
      }
      let st;
      let text;
      try {
        st = await fstat(fd);
        text = await readFile(fd, 'UTF-8');
      } finally {
        await close(fd);
      }
      this.files[file] = text;
      this.deps.push({
        path: file,
        mtime: st.mtime,
      });
      return text;
    })();
    this.files[file] = r;
    return r;
  }
}

function pushDiagnostic(diagnostics, e, severity) {
  const { loc } = e;
  const msg = {
    severity,
    message: e.message,
  };
  let file;
  if (loc) {
    if (file !== undefined) {
      loc.file = file;
    }
    if (loc.line !== undefined) {
      msg.line = loc.line;
    }
    if (loc.column !== undefined) {
      msg.column = loc.column;
    }
  }
  if (file === undefined) {
    file = e.importer;
  }
  if (file === undefined) {
    file = '';
  }
  diagnostics[file].push(msg);
}

async function compile(config) {
  const linter = new CLIEngine();
  // Map from relative file path to list of ESLint diagnostics and our own that
  // we added. The empty string marks the root level.
  const diagnostics = { '': [] };
  const files = new FileSet();
  const inputOptions = {
    input: '/game/cyber/main',
    onwarn(w) {
      pushDiagnostic(diagnostics, w, 1);
    },
    plugins: [
      {
        // Resolve the modules to JS files.
        async resolveId(id, origin) {
          if (origin) {
            return null;
          }
          let mpath = id;
          if (mpath.startsWith('/')) {
            mpath = path.normalize(mpath.replace(/^\/+/, ''));
          } else {
            mpath = path.join(path.dirname(origin), mpath);
          }
          const fpath = `${mpath}.js`;
          const source = await files.load(fpath);
          if (source === null) {
            diagnostics[origin || ''].push({
              severity: 2,
              message: `Could not resolve module ${JSON.stringify(id)}`,
            });
            return false;
          }
          return fpath;
        },
        // Load the files and store the modification time.
        async load(id) {
          // const source = await files.load(id);
          diagnostics[id] = [];
          return files.load(id);
        },
      },
      {
        // Run ESLint on the modules.
        transform(source, id) {
          diagnostics[id].push(
            ...linter.executeOnText(source, id).results[0].messages,
          );
        },
      },
    ],
  };
  if (config === 'debug') {
    inputOptions.pluigns.push(sourcemaps());
  }
  let bundle;
  try {
    bundle = await rollup.rollup(inputOptions);
  } catch (e) {
    if (e.code === undefined) {
      throw e;
    }
    pushDiagnostic(diagnostics, e, 2);
  }
  let errorCount = 0;
  let warningCount = 0;
  for (let messages of Object.values(diagnostics)) {
    for (let message of messages) {
      let s = message.severity;
      if (s >= 2) {
        errorCount++;
      } else if (s >= 1) {
        warningCount++;
      }
    }
  }
  let success = errorCount === 0;
  let result = {
    success,
    errorCount,
    warningCount,
    diagnostics,
    inputs: files.deps,
  };
  if (success) {
    const outputOptions = {
      format: 'iife',
      name: 'Game',
      sourcemap: true,
    };
    const { code, map } = await bundle.generate(outputOptions);
    result.code = code;
    result.map = map;
  }
  return result;
}

compile().then(r => console.log(JSON.stringify(r, null, '  ')));
