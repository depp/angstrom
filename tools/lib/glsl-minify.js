const tokenizeString = require('glsl-tokenizer/string');
const parseTokens = require('glsl-parser/direct');
const deparser = require('glsl-deparser');

function minify(source) {
  const tokens = tokenizeString(source);
  const ast = parseTokens(tokens);
  const s = deparser(false);
  let result = '';
  s.on('data', (chunk) => { result += chunk; });
  s.on('error', (error) => { throw new Error(error); });
  ast.children.forEach(node => s.write(node));
  s.write(null);
  return result;
}

module.exports = minify;
