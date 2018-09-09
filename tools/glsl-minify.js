const fs = require('fs');
const minify = require('./lib/glsl-minify');

let text = fs.readFileSync(process.argv[2], 'UTF-8');
text = minify(text);
process.stdout.write(text);
