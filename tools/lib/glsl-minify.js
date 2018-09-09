const tokenizeString = require('glsl-tokenizer/string');
const parseTokens = require('glsl-parser/direct');
const shortest = require('shortest');

// How the AST works:
//
// A varying shows up as:
// - type=stmt token="varying"
//   - type=decl token="varying"
//     - type=decllist token=";"
//       - type=ident token=<name>
//
// A uniform shows up as:
// - type=stmt token="uniform"
//   - type=decl token="uniform"
//     - type=decllist token=";"
//       - type=ident token=<name>

function dumpTree(node, depth = 0) {
  /* eslint-disable prefer-template */
  process.stdout.write(
    `${'  '.repeat(depth)}${node.type}`
      + (node.token ? `: ${JSON.stringify(node.token.data)}\n` : '\n'),
  );
  /* eslint-enable prefer-template */
  for (const child of node.children) {
    dumpTree(child, depth + 1);
  }
}

// Return a list of nodes in the AST.
function listNodes(ast) {
  const list = [ast];
  for (let i = 0; i < list.length; i++) {
    list.push(...list[i].children);
  }
  return list;
}

// Return a list of declarations from the given nodes. Does not search
// recursively.
function listDecls(nodes) {
  const decls = [];
  for (const node of nodes) {
    if (node.type === 'decl') {
      let type = node.token.data;
      if (type !== 'uniform' && type !== 'varying' && type !== 'attribute') {
        type = 'local';
      }
      for (const c of node.children) {
        if (c.type === 'decllist') {
          for (const c1 of c.children) {
            if (c1.type === 'ident') {
              decls.push({ type, name: c1.token.data });
            }
          }
        } else if (c.type === 'function') {
          for (const c1 of c.children) {
            if (c1.type === 'ident') {
              decls.push({ type: 'function', name: c1.token.data });
              break;
            }
          }
        }
      }
    }
  }
  return decls;
}

function mapNames(ast, options) {
  const {
    attributeMap = {},
    uniformMap = {},
    varyingMap = {},
  } = options || {};
  const nodes = listNodes(ast);
  const decls = listDecls(nodes);
  const nameMap = { main: 'main' };
  Object.assign(nameMap, uniformMap);
  Object.assign(nameMap, attributeMap);
  Object.assign(nameMap, varyingMap);
  const used = {};
  for (const name of Object.values(nameMap)) {
    used[name] = true;
  }
  let aIndex = 0;
  let uIndex = 0;
  const counter = shortest();
  for (const { type, name } of decls) {
    let name2 = nameMap[name];
    switch (type) {
      case 'uniform':
        if (!name2) {
          do {
            name2 = `U${uIndex}`;
            uIndex++;
          } while (used[name2]);
        }
        uniformMap[name] = name2;
        break;
      case 'attribute':
        if (!name2) {
          do {
            name2 = `A${aIndex}`;
            aIndex++;
          } while (used[name2]);
        }
        attributeMap[name] = name2;
        break;
      default:
        if (!name2) {
          do {
            name2 = counter();
          } while (used[name2]);
        }
        if (type === 'varying') {
          varyingMap[name] = name2;
        }
        break;
    }
    nameMap[name] = name2;
  }
  return nameMap;
}

function emit(tokens, nameMap) {
  // There is a glsl-deparser, but it doesn't seem to work or its error handling
  // leaves something to be desired.
  let result = '';
  let needWhite = false;
  for (const tok of tokens) {
    switch (tok.type) {
      case 'block-comment':
      case 'line-comment':
      case 'whitespace':
        break;
      case 'keyword':
      case 'builtin':
        if (needWhite) {
          result += ' ';
        }
        result += tok.data;
        needWhite = true;
        break;
      case 'eof':
        break;
      case 'float': {
        if (needWhite) {
          result += ' ';
        }
        const m = tok.data.match(/^0*((?:[1-9][0-9]*)?\.(?:[0-9]*[1-9])?)0*$/);
        if (m) {
          const d = m[1];
          if (d === '.') {
            result += '0.';
          } else {
            result += d;
          }
        } else {
          result += tok.data;
        }
        needWhite = true;
      } break;
      case 'ident':
        if (needWhite) {
          result += ' ';
        }
        result += nameMap[tok.data] || tok.data;
        needWhite = true;
        break;
      case 'integer': {
        if (needWhite) {
          result += ' ';
        }
        const m = tok.data.match(/^0*([1-9][0-9]*)?$/);
        if (m) {
          const d = m[1];
          if (d == '') {
            result += '0';
          } else {
            result += d;
          }
        } else {
          result += tok.data;
        }
        needWhite = true;
      } break;
      case 'operator':
        result += tok.data;
        needWhite = false;
        break;
      case 'preprocessor':
        if (result) {
          result += '\n';
        }
        result += tok.data;
        result += '\n';
        needWhite = false;
        break;
      default:
        throw new Error(`Unknown token type ${JSON.stringify(tok.type)}`);
    }
  }
  return result;
}

function minify(source, options) {
  const tokens = tokenizeString(source);
  const ast = parseTokens(tokens);
  const nameMap = mapNames(ast, options);
  return emit(tokens, nameMap);
}

module.exports = minify;
