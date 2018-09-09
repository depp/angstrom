// @generate_source

/* eslint no-loop-func: off */

const minify = require('../../tools/lib/glsl-minify');

const shaders = {
  spriteProgram: {
    vname: 'sprite',
    fname: 'sprite',
    attributes: [
      'Pos',
      'TexCoord',
    ],
  },
  tileProgram: {
    vname: 'tile',
    fname: 'tile',
    attributes: [
      'Pos',
    ],
  },
};

module.exports = async function generate(build) {
  const { DEBUG, load } = build;
  let body = '';
  if (DEBUG) {
    body += 'import { defineShaderProgram } from \'/game/cyber/shader\';\n';
  } else {
    body += 'import { compileShaderProgram } from \'/game/cyber/shader\';\n';
  }
  const filename = /^[-_a-zA-Z0-9]+(?:\.[-_a-zA-Z0-9]+)?$/;
  const identifier = /^[_a-zA-Z][_a-zA-Z0-9]*$/;

  const promises = [];
  for (const [name, shader] of Object.entries(shaders)) {
    const {
      vname, fname, attributes,
    } = shader;
    if (!name.match(identifier)) {
      throw new Error(`Invalid name: ${JSON.stringify(name)}`);
    }
    if (!vname || !vname.match(filename)) {
      throw Error(`Invalid vertex shader: ${JSON.stringify(vname)}`);
    }
    if (!fname || !fname.match(filename)) {
      throw Error(`Invalid fragment shader: ${JSON.stringify(fname)}`);
    }
    if (!attributes) {
      throw Error('Missing attributes');
    }
    for (const attribute of attributes) {
      if (!attribute.match(identifier)) {
        throw new Error(`Bad attribute name: ${JSON.stringify(name)}`);
      }
    }
    if (DEBUG) {
      const args = [
        ['attributes', attributes],
        ['vname', vname],
        ['fname', fname],
      ];
      body += `export let ${name};\n`;
      body += 'defineShaderProgram({\n';
      for (const [k, v] of args) {
        body += `  ${k}: ${JSON.stringify(v)},\n`;
      }
      body += `  func(prog) { ${name} = prog; },\n`;
      body += '});\n';
    } else {
      promises.push(Promise.all([
        load(`game/cyber/shader/${vname}.vert.glsl`),
        load(`game/cyber/shader/${vname}.frag.glsl`),
      ]).then((srcs) => {
        const vsource = minify(srcs[0]);
        const fsource = minify(srcs[1]);
        const args = [attributes.join(' '), vsource, fsource];
        return `export const ${name} = compileShaderProgram(\n`
          + `  ${args.map(a => JSON.stringify(a)).join(',\n  ')},\n`
          + ');\n';
      }));
    }
  }
  for (const chunk of await Promise.all(promises)) {
    body += chunk;
  }
  return body;
};
