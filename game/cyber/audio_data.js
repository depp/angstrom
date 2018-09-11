const cmap = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Nodes
export const funcGain = 0;
export const funcOscillator = 1;

// Wiring
export const funcOutput = 2;

// Parameters
export const funcEnvelope = 3;

export const oscillatorTypes = [
  'sine',
  'square',
  'sawtooth',
  'triangle',
];

// Parse an encoded audio program.
export function parseData(text) {
  return text.split(' ').map(str => Array.from(str).map(c => cmap.indexOf(c)));
}

// Encode an audio program.
export function encodeData(data) {
  return data.map(a => a.map(x => cmap[x]).join('')).join(' ');
}

export class ParseError extends Error {
  constructor(msg, lineno) {
    super(msg);
    this.line = lineno;
  }
}

const nameRE = /^[-_a-zA-Z][-_a-zA-Z0-9]*$/;

// Parse an audio script, returning an audio program.
export function parseScript(text) {
  let curNode;
  let itemCount = 0;
  const names = {};
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
    } else if (name == '.out') {
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
      program.push([funcOutput, dest]);
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
        program.push([funcGain]);
        emitNode(name, 'gain');
        break;

      case 'osc': {
        isNode();
        if (fields.length !== 1) {
          fail(`Got ${fields.length} arguments, expected 1`);
        }
        const waveform = oscillatorTypes.indexOf(fields[0]);
        if (waveform == null) {
          fail(`Unknown waveform ${JSON.stringify(fields[0])}`);
        }
        program.push([funcOscillator, waveform]);
        emitNode(name, 'frequency');
      } break;

      case 'env':
        isParameter();
        if ((fields.length & 1) !== 1) {
          fail(`Got ${fields.length} arguments, must be an odd number`);
        }
        program.push([funcEnvelope, parameter, ...parseFields()]);
        break;

      default:
        fail(
          `Unknown function ${JSON.stringify(func)}`, lineno,
        );
    }
  });
  return program;
}
