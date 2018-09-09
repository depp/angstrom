const fs = require('fs');
const minify = require('./lib/glsl-minify');

let text = fs.readFileSync(process.argv[2], 'UTF-8');
try {
  text = minify(text);
} catch (e) {
  console.error(e);
  process.exit(1);
}
process.stdout.write(text);
