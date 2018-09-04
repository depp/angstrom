const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const rollup = require('rollup');
const { CLIEngine } = require('eslint');
const minimist = require('minimist');
const terser = require('terser');
const chokidar = require('chokidar');

const close = promisify(fs.close);
const fstat = promisify(fs.fstat);
const stat = promisify(fs.stat);
const open = promisify(fs.open);
const readFile = promisify(fs.readFile);

// A FileSet loads files and records them as dependencies.
class FileSet {
  constructor() {
    this.files = {};
  }

  load(file) {
    let source = this.files[file];
    if (source) {
      return source.contents;
    }
    source = { file, mtime: null };
    this.files[file] = source;
    source.contents = (async () => {
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
      source.contents = text;
      source.mtime = st.mtime;
      return text;
    })();
    return source.contents;
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

const baseConfig = {
  minify: true,
  lint: true,
  sourceMap: true,
};
const configNames = {
  release: {},
  debug: {
    minify: false,
  },
};

function getConfig(options) {
  const config = options.config || 'debug';
  const obj = { config };
  const nobj = configNames[config];
  if (!nobj) {
    throw Error(`Unknown configuration ${JSON.stringify(config)}`);
  }
  Object.assign(obj, baseConfig, nobj);
  for (const key of Object.keys(obj)) {
    const value = options[key];
    if (value !== undefined && value !== null) {
      obj[key] = value;
    }
  }
  return obj;
}

async function compile(config) {
  // Map from relative file path to list of ESLint diagnostics and our own that
  // we added. The empty string marks the root level.
  const diagnostics = { '': [] };
  const files = new FileSet();
  const inputOptions = {
    input: config.config === 'release'
      ? '/game/cyber/main.release'
      : '/game/cyber/main',
    onwarn(w) {
      pushDiagnostic(diagnostics, w, 1);
    },
    plugins: [
      {
        // Resolve the modules to JS files.
        async resolveId(id, origin) {
          let mpath = id;
          if (mpath.startsWith('/')) {
            mpath = path.normalize(mpath.replace(/^\/+/, ''));
          } else {
            diagnostics[origin || ''].push({
              severity: 2,
              message: `Cannot resolve relative import ${JSON.stringify(mpath)}`,
            });
            return null;
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
        load(id) {
          diagnostics[id] = [];
          return files.load(id);
        },
      },
    ],
  };
  if (config.lint) {
    const linter = new CLIEngine();
    inputOptions.plugins.push({
      transform(source, id) {
        diagnostics[id].push(
          ...linter.executeOnText(source, id).results[0].messages,
        );
      },
    });
  }
  if (config.minify) {
    inputOptions.plugins.push({
      renderChunk(code) {
        return terser.minify(code, {
          sourceMap: true,
        });
      },
    });
  }
  let bundle;
  try {
    bundle = await rollup.rollup(inputOptions);
  } catch (e) {
    console.error(e);
    if (e.code === undefined) {
      throw e;
    }
    pushDiagnostic(diagnostics, e, 2);
  }
  let errorCount = 0;
  let warningCount = 0;
  for (const messages of Object.values(diagnostics)) {
    for (const message of messages) {
      const s = message.severity;
      if (s >= 2) {
        errorCount++;
      } else if (s >= 1) {
        warningCount++;
      }
    }
  }
  const success = errorCount === 0;
  const result = {
    success,
    errorCount,
    warningCount,
    inputs: Object.values(files.files).map(f => ({ file: f.file, mtime: f.mtime })),
  };
  if (success) {
    const outputOptions = {
      format: 'iife',
      name: 'Game',
      sourcemap: true,
    };
    try {
      const { code, map } = await bundle.generate(outputOptions);
      result.code = code;
      result.map = map;
    } catch (e) {
      pushDiagnostic(diagnostics, e, 2);
      result.success = false;
    }
  }
  const dlist = [];
  for (const k of Object.keys(diagnostics).sort()) {
    const v = diagnostics[k];
    if (!v.length) {
      continue;
    }
    const d = {
      file: k,
      messages: v,
    };
    const file = files.files[k];
    if (file) {
      const code = file.contents;
      if (typeof code === 'string') {
        d.code = code;
      }
    }
    dlist.push(d);
  }
  result.diagnostics = dlist;
  return result;
}

async function watch(config) {
  const watcher = chokidar.watch('game/cyber', {
    ignored: /(^|\/)\.|~$/,
    persistent: true,
  });
  let dirty = true;
  let inputs = {};
  const files = {};
  let compiling = false;
  watcher
    .on('add', didChange)
    .on('change', didChange)
    .on('unlink', didUnlink);
  build();
  async function didChange(fpath) {
    updateFile(fpath, (await stat(fpath)).mtime);
  }
  function didUnlink(fpath) {
    updateFile(fpath, null);
  }
  function updateFile(file, mtime) {
    files[file] = mtime;
    if (dirty) {
      // Already dirty, can't make it any dirtier.
      return;
    }
    const input = inputs[file];
    if (input === undefined) {
      // Not an input.
      return;
    }
    if (!(mtime === null || mtime > input || mtime < input)) {
      // Unchanged from last compilation.
      return;
    }
    dirty = true;
    setImmediate(build);
  }
  function build() {
    if (!dirty || compiling) {
      return;
    }
    compiling = true;
    compile(config)
      .then((script) => {
        process.stdout.write(JSON.stringify(script));
        process.stdout.write('\n');
        const ninputs = {};
        let ndirty = false;
        for (const input of script.inputs) {
          ninputs[input.file] = input.mtime;
          const mtime = files[input.file];
          if (mtime === undefined) {
            continue;
          }
          if (mtime === null) {
            if (input.mtime != null) {
              ndirty = true;
            }
          } else if (input.mtime === null || input.mtime < mtime || input.mtime > mtime) {
            ndirty = true;
          }
        }
        dirty = ndirty;
        inputs = ninputs;
        compiling = false;
        if (ndirty) {
          setImmediate(build);
        }
      })
      .catch((e) => {
        compiling = false;
        console.error(e);
      });
  }
}

const command = minimist(process.argv.slice(2), {
  string: ['config'],
  boolean: ['minify', 'lint', 'sourceMap', 'watch'],
  alias: {
    'source-map': 'sourceMap',
  },
  default: {
    config: 'debug',
    minify: null,
    lint: null,
    sourceMap: null,
  },
  unknown(arg) {
    throw Error(`Unknown argument ${JSON.stringify(arg)}`);
  },
});

if (command.watch) {
  watch(getConfig(command))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
} else {
  compile(getConfig(command)).then((r) => {
    console.log(JSON.stringify(r, null, '  '));
  }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
