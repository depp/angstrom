// @generate_source

const parseSFX = require('../../tools/lib/parse_sfx');

const sfx = [
  'shot',
];

module.exports = async function generate(build) {
  const { DEBUG, load } = build;
  const data = [];
  if (!DEBUG) {
    const fnames = sfx.map(name => `game/cyber/sfx/${name}.txt`);
    const sources = await Promise.all(fnames.map(load));
    for (let i = 0; i < sfx.length; i++) {
      const fname = fnames[i];
      const source = sources[i];
      let program;
      try {
        program = parseSFX.parseScript(source);
      } catch (e) {
        if (e instanceof parseSFX.ParseError) {
          e.file = fname;
        }
        throw e;
      }
      data.push(parseSFX.encodeProgram(program));
    }
  }
  let body = '';
  body += `export const cmap = ${JSON.stringify(parseSFX.cmap)};`;
  body += 'export const oscillatorTypes = '
    + `${JSON.stringify(parseSFX.oscillators)};\n`;
  const { operations } = parseSFX;
  for (let i = 0; i < operations.length; i++) {
    const name = operations[i];
    const uname = name.charAt(0).toUpperCase() + name.substring(1);
    body += `export const op${uname} = ${i};\n`;
  }
  for (let i = 0; i < sfx.length; i++) {
    body += `export const ${sfx[i]}SFX = ${i};\n`;
  }
  body += `export const sfxData = ${JSON.stringify(data.join(' '))};\n`;
  body += `export const sfxNames = ${JSON.stringify(sfx)};\n`;
  return body;
};
