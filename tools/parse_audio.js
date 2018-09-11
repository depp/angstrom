const fs = require('fs');
const parseSFX = require('./lib/parse_sfx');

for (let i = 2; i < process.argv.length; i++) {
  const text = fs.readFileSync(process.argv[i], 'UTF-8');
  let data;
  try {
    data = parseSFX.parseScript(text);
  } catch (e) {
    if (e instanceof parseSFX.ParseError) {
      console.error(`${process.argv[i]}:{e.line}: ${e.message}`);
    } else {
      console.error(e);
    }
    process.exit(1);
  }
  process.stdout.write(JSON.stringify(parseSFX.encodeProgram(data)) + '\n');
}
