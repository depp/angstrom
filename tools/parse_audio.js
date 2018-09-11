const fs = require('fs');
const rollup = require('rollup');
const evalModule = require('eval');
const sourceMap = require('source-map-support');

sourceMap.install();

const fname = 'game/cyber/audio_data.js';

async function main() {
  const bundle = await rollup.rollup({
    input: fname,
  });
  const { code, map } = await bundle.generate({
    format: 'cjs',
    sourcemap: true,
  });
  let src = code;
  if (!code.endsWith('\n')) {
     src += '\n';
  }
  src += '//# sourceMappingURL=data:application/json;base64,';
  src += Buffer.from(JSON.stringify(map)).toString('base64');
  const audio = evalModule(src, fname, null, true);

  for (let i = 2; i < process.argv.length; i++) {
    const text = fs.readFileSync(process.argv[2], 'UTF-8');
    let data;
    try {
      data = audio.parseScript(text);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
    process.stdout.write(JSON.stringify(audio.encodeData(data)) + '\n');
  }
}

main();
