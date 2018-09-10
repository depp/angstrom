// @generate_source

/* eslint no-loop-func: off */

const terser = require('terser');
const minify = require('../../tools/lib/glsl-minify');

const shaders = {
  spriteSolidProgram: {
    vname: 'sprite',
    fname: 'sprite_solid',
    attributes: [
      'Pos',
      'TexCoord',
      'Color',
    ],
  },
  spriteTransparentProgram: {
    vname: 'sprite',
    fname: 'sprite_transparent',
    attributes: [
      'Pos',
      'TexCoord',
      'Color',
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
  const uniformMap = {};
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
        load(`game/cyber/shader/${fname}.frag.glsl`),
      ]).then((srcs) => {
        if (srcs[0] == null) {
          throw new Error('could not load vertex shader');
        }
        if (srcs[1] == null) {
          throw new Error('could not load fragment shader');
        }
        const attributeMap = {};
        for (let i = 0; i < attributes.length; i++) {
          attributeMap[attributes[i]] = `A${i}`;
        }
        const varyingMap = {};
        const vsource = minify(srcs[0], {
          attributeMap,
          uniformMap,
          varyingMap,
        });
        const fsource = minify(srcs[1], {
          uniformMap,
          varyingMap,
        });
        const args = [attributes.length, vsource, fsource];
        return `export const ${name} = compileShaderProgram(\n`
          + `  ${args.map(a => JSON.stringify(a)).join(',\n  ')},\n`
          + ');\n';
      }));
    }
  }
  for (const chunk of await Promise.all(promises)) {
    body += chunk;
  }
  build.addTransformer((node) => {
    //    .
    //   / \
    //  .   <name>
    // / \
    //    uniforms
    if (node instanceof terser.AST_Dot) {
      const { expression, property } = node;
      if (expression instanceof terser.AST_Dot
          && expression.property === 'uniforms') {
        const uName = uniformMap[property];
        if (uName) {
          const r = new terser.AST_Sub(node);
          r.expression = expression.expression;
          r.property = new terser.AST_String({
            value: uName,
          });
          return r;
        }
      }
    }
    return undefined;
  });
  return body;
};
