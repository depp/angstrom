const cmap = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const operations = [
  'gain',
  'oscillator',
  'output',
  'envFrequency',
  'envGain',
];

const oscillators = [
  'sine',
  'square',
  'sawtooth',
  'triangle',
];

function operation(name) {
  const idx = operations.indexOf(name);
  if (idx == null) {
    throw new Error(`Invalid operation ${JSON.stringify(name)}`);
  }
  return idx;
}

class ParseError extends Error {
  constructor(msg, lineno) {
    super(msg);
    this.line = lineno;
  }
}

const nameRE = /^[-_a-zA-Z][-_a-zA-Z0-9]*$/;

const envMap = {
  frequency: 'envFrequency',
  gain: 'envGain',
};

// Parse an audio script, returning an audio program.
function parseScript(text) {
  let curNode;
  let itemCount = 1;
  const names = { out: 0 };
  const program = [];
  function emitNode(name, ...parameters) {
    names[name] = itemCount++;
    for (const param of parameters) {
      names[`${name}.${param}`] = itemCount++;
    }
  }
  text.split('\n').forEach((line, lineno) => {
    function fail(msg) {
      throw new ParseError(msg, lineno + 1);
    }
    if (line.match(/^\s*(?:#|$)/)) {
      return;
    }
    const fields = line.split(/\s+/).filter(s => s.length);
    if (fields.length < 3 || fields[1] !== '=') {
      fail('Invalid syntax', lineno);
    }
    const name = fields[0];
    let parameter;
    if (!name.startsWith('.')) {
      if (!name.match(nameRE)) {
        fail(`Invalid name ${JSON.stringify(name)}`);
      }
      if (name in names) {
        fail(`Duplicate name ${JSON.stringify(name)}`);
      }
    } else if (name === '.out') {
      if (fields.length > 3) {
        fail('Too many arguments');
      }
      if (curNode == null) {
        fail('Output has no parent node');
      }
      if (fields.length !== 3) {
        fail('Invalid output specification');
      }
      const destName = fields[2];
      const dest = names[destName];
      if (dest == null) {
        fail(`Unknown node ${JSON.stringify(destName)}`);
      }
      program.push([operation('output'), dest]);
      return;
    } else {
      if (curNode == null) {
        fail(`Parameter ${JSON.stringify(name)} has no parent node`);
      }
      const fullName = `${curNode}${name}`;
      parameter = names[fullName];
      if (parameter == null) {
        fail(`No such parameter ${JSON.stringify(fullName)}`);
      }
    }
    const func = fields[2];
    fields.splice(0, 3);
    function isNode() {
      if (parameter != null) {
        fail(`Not a parameter: ${func}`);
      }
      curNode = name;
    }
    function isParameter() {
      if (parameter == null) {
        fail(`Not a node: ${func}`);
      }
    }
    function parseFields() {
      const r = [];
      for (const field of fields) {
        const number = parseInt(field, 10);
        if (typeof number !== 'number' || number.toString() !== field) {
          fail(`Invalid number: ${JSON.stringify(field)}`);
        }
        if (number < 0 || number > 63) {
          fail(`Number out of range: ${number}`);
        }
        r.push(number);
      }
      return r;
    }
    switch (func) {
      case 'gain':
        isNode();
        if (fields.length > 0) {
          fail(`Got ${fields.length} arguments, expected 0`);
        }
        program.push([operation('gain')]);
        emitNode(name, 'gain');
        break;

      case 'osc': {
        isNode();
        if (fields.length !== 1) {
          fail(`Got ${fields.length} arguments, expected 1`);
        }
        const waveform = oscillators.indexOf(fields[0]);
        if (waveform == null) {
          fail(`Unknown waveform ${JSON.stringify(fields[0])}`);
        }
        program.push([operation('oscillator'), waveform]);
        emitNode(name, 'frequency');
      } break;

      case 'env': {
        isParameter();
        if ((fields.length % 2) !== 1) {
          fail(`Got ${fields.length} arguments, must be an odd number`);
        }
        const opName = envMap[name.substring(1)];
        if (opName == null) {
          fail(`Unknown envelope type for ${JSON.stringify(name)}`);
        }
        program.push([operation(opName), parameter, ...parseFields()]);
      } break;

      default:
        fail(
          `Unknown function ${JSON.stringify(func)}`, lineno,
        );
    }
  });
  return program;
}

// Encode an audio program.
function encodeProgram(data) {
  return data.map(a => a.map(x => cmap[x]).join('')).join(',');
}

module.exports = {
  cmap,
  operations,
  oscillators,
  ParseError,
  parseScript,
  encodeProgram,
};
