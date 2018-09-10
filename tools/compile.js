const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const rollup = require('rollup');
const replace = require('rollup-plugin-replace');
const { CLIEngine } = require('eslint');
const minimist = require('minimist');
const terser = require('terser');
const chokidar = require('chokidar');
const evalModule = require('eval');
const domprops = require('terser/tools/domprops.json');

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

function pushDiagnostic(diagnostics, e, severity = 2, fatal = false) {
  const { loc, stack } = e;
  const msg = {
    severity,
    message: e.message,
  };
  let file;
  if (loc) {
    if (!file) {
      /* eslint prefer-destructuring: off */
      file = loc.file;
    }
    if (loc.line !== undefined) {
      msg.line = loc.line;
    }
    if (loc.column !== undefined) {
      msg.column = loc.column + 1;
    }
  }
  if (!file) {
    file = e.importer || '';
  }
  if (file === undefined) {
    file = '';
  }
  if (fatal) {
    msg.fatal = true;
  }
  if (stack) {
    msg.stack = stack;
  }
  diagnostics[file].push(msg);
}

const baseConfig = {
  minify: true,
  lint: true,
  sourceMap: true,
};
const configNames = {
  release: {
    defines: {
      RELEASE: true,
      DEBUG: false,
    },
  },
  debug: {
    minify: false,
    defines: {
      RELEASE: false,
      DEBUG: true,
    },
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
  Object.keys(obj).forEach((key) => {
    const value = options[key];
    if (value !== undefined && value !== null) {
      obj[key] = value;
    }
  });
  return obj;
}

async function compile(config) {
  // Map from relative file path to list of ESLint diagnostics and our own that
  // we added. The empty string marks the root level.
  const diagnostics = { '': [] };
  const files = new FileSet();
  const generated = {};
  const transformers = [];
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
        resolveId(id, origin) {
          let mpath = id;
          if (mpath.startsWith('/')) {
            mpath = path.normalize(mpath.replace(/^\/+/, ''));
          } else {
            diagnostics[origin || ''].push({
              severity: 2,
              message:
              `Cannot resolve relative import ${JSON.stringify(mpath)}`,
              fatal: true,
            });
            return null;
          }
          return `${mpath}.js`;
        },
        // Load the files and store the modification time.
        async load(id) {
          diagnostics[id] = [];
          return files.load(id);
        },
      },
    ],
  };
  if (config.lint) {
    // Total hack to reload when ESLint config changes.
    await files.load('game/cyber/.eslintrc.js');
    const linter = new CLIEngine();
    inputOptions.plugins.push({
      transform(source, id) {
        diagnostics[id].push(
          ...linter.executeOnText(source, id).results[0].messages,
        );
      },
    });
  }
  inputOptions.plugins.push({
    // Run ad-hoc source code generators.
    async transform(source, id) {
      if (!source.startsWith('// @generate_source\n')) {
        return null;
      }
      try {
        const generator = evalModule(source, id, null, true);
        const newSource = await generator(Object.assign({
          load(name) {
            return files.load(name);
          },
          addTransformer(transform) {
            transformers.push(transform);
          },
        }, config.defines));
        generated[id] = newSource;
        return { code: newSource, map: null };
      } catch (e) {
        diagnostics[id].push({
          fatal: true,
          severity: 2,
          message: `Code generation failed: ${e.message}`,
          stack: e.stack,
        });
        return '';
      }
    },
  });
  inputOptions.plugins.push(replace({
    // The replace plugin modifies the values, so we need to copy them.
    values: Object.assign({}, config.defines),
  }));
  if (config.minify) {
    const reserved = [];
    reserved.push(...domprops);
    reserved.push('movementX', 'movementY');
    inputOptions.plugins.push({
      renderChunk(code) {
        let tree = terser.parse(code);
        for (const transform of transformers) {
          tree = tree.transform(new terser.TreeTransformer(transform));
        }
        return terser.minify(tree, {
          compress: {
            drop_console: true,
            ecma: 8, // 2017
            keep_fargs: false,
            unsafe_arrows: true,
            unsafe_comps: true, // Does have an effect
            unsafe_math: true,
            unsafe_methods: true,
          },
          mangle: {
            properties: {
              reserved,
              keep_quoted: true,
            },
          },
          sourceMap: true,
        });
      },
    });
  }
  let bundle;
  try {
    bundle = await rollup.rollup(inputOptions);
  } catch (e) {
    if (e.code === undefined) {
      throw e;
    }
    pushDiagnostic(diagnostics, e, 2, true);
  }
  let errorCount = 0;
  let warningCount = 0;
  let success = true;
  Object.values(diagnostics).forEach((messages) => {
    messages.forEach((message) => {
      const s = message.severity;
      if (s >= 2) {
        errorCount += 1;
      } else if (s >= 1) {
        warningCount += 1;
      }
      if (message.fatal) {
        success = false;
      }
    });
  });
  const result = {
    success,
    errorCount,
    warningCount,
    generated,
    inputs: Object.values(files.files).map(
      f => ({ file: f.file, mtime: f.mtime }),
    ),
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
      pushDiagnostic(diagnostics, e, 2, true);
      result.success = false;
    }
  }
  const dlist = [];
  Object.keys(diagnostics).sort().forEach((k) => {
    const v = diagnostics[k];
    if (!v.length) {
      return;
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
  });
  result.diagnostics = dlist;
  return result;
}

async function watch(config) {
  const watcher = chokidar.watch(['game/cyber', 'tools/compile.js'], {
    ignored: /(^|\/)#|~$/,
    persistent: true,
  });
  let dirty = true;
  let inputs = {};
  const files = {};
  let compiling = false;
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
        script.inputs.forEach((input) => {
          ninputs[input.file] = input.mtime;
          const mtime = files[input.file];
          if (mtime === undefined) {
            return;
          }
          if (mtime === null) {
            if (input.mtime != null) {
              ndirty = true;
            }
          } else if (
            input.mtime === null || input.mtime < mtime || input.mtime > mtime
          ) {
            ndirty = true;
          }
        });
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
  function updateFile(file, mtime) {
    if (file === 'tools/compile.js') {
      if (!files[file]) {
        files[file] = mtime;
      } else {
        process.exit(0);
      }
      return;
    }
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
  async function didChange(fpath) {
    updateFile(fpath, (await stat(fpath)).mtime);
  }
  function didUnlink(fpath) {
    updateFile(fpath, null);
  }
  watcher
    .on('add', didChange)
    .on('change', didChange)
    .on('unlink', didUnlink);
  build();
}

const command = minimist(process.argv.slice(2), {
  string: ['config'],
  boolean: ['minify', 'lint', 'sourceMap', 'watch', 'show-generated'],
  alias: {
    'source-map': 'sourceMap',
    'show-generated': 'showGenerated',
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
    if (command.showGenerated) {
      const { generated } = r;
      Object.entries(generated).forEach(([name, source]) => {
        process.stdout.write(`===== ${name} =====\n`);
        process.stdout.write(source);
      });
      return;
    }
    console.log(JSON.stringify(r, null, '  '));
  }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
