// @generate_source

/* eslint no-loop-func: off */

const terser = require('terser');
const minify = require('../../tools/lib/glsl-minify');

const spriteAttr = [
  'aPos',
  'aTexPos',
  'aColor',
];

const levelAttr = [
  'aPos',
  'aTexPos',
  'aNormalSpace',
];

const shaders = {
  spriteOpaqueProgram: {
    vname: 'sprite',
    fname: 'sprite_opaque',
    attributes: spriteAttr,
  },
  spriteTransparentProgram: {
    vname: 'sprite',
    fname: 'sprite_transparent',
    attributes: spriteAttr,
  },
  spriteCompositeProgram: {
    vname: 'sprite',
    fname: 'sprite_composite',
    attributes: spriteAttr,
  },
  levelStoneProgram: {
    vname: 'level',
    fname: 'level_stone',
    attributes: levelAttr,
  },
  skyProgram: {
    vname: 'sky',
    fname: 'sky',
    attributes: ['aPos'],
  },
};

const includes = [
  'levelfrag.glsl',
  'lighting.glsl',
  'voronoi.glsl',
];

function expandIncludes(sources, name) {
  const source = sources[name];
  if (source == null) {
    throw new Error(`Unknown shader: ${JSON.stringify(name)}`);
  }
  const include = /^[ \t]*#[ \t]*include[ \t]+"(.*)"[ \t]*$/mg;
  let match;
  let body = '';
  let pos = 0;
  /* eslint-disable no-cond-assign */
  while ((match = include.exec(source))) {
    /* eslint-enable no-cond-assign */
    body += source.substring(pos, match.index);
    pos = include.lastIndex;
    const name = match[1];
    const isource = sources[name];
    if (isource == null) {
      throw new Error(`Unknown shader include: ${JSON.stringify(name)}`);
    }
    body += isource;
    if (body != '' && !body.endsWith('\n')) {
      body += '\n';
    }
  }
  body += source.substring(pos);
  return body;
}

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

  const sources = {};
  if (!DEBUG) {
    for (const { vname, fname } of Object.values(shaders)) {
      sources[`${vname}.vert.glsl`] = null;
      sources[`${fname}.frag.glsl`] = null;
    }
    for (const include of includes) {
      sources[include] = null;
    }
    await Promise.all(Object.keys(sources).map(async (name) => {
      const data = await load(`game/cyber/shader/${name}`);
      if (data == null) {
        throw new Error(`Missing shader ${name}`);
      }
      sources[name] = data;
    }));
  }

  const uniformMap = {};
  const localMap = {};
  const varyingMap = {};
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
      let vsource = expandIncludes(sources, `${vname}.vert.glsl`);
      let fsource = expandIncludes(sources, `${fname}.frag.glsl`);
      const attributeMap = {};
      for (let i = 0; i < attributes.length; i++) {
        attributeMap[attributes[i]] = `A${i}`;
      }
      vsource = minify(vsource, {
        attributeMap,
        uniformMap,
        varyingMap,
        localMap,
      });
      fsource = minify(fsource, {
        uniformMap,
        varyingMap,
        localMap,
      });
      const args = [attributes.length, vsource, fsource];
      body += `export const ${name} = compileShaderProgram(\n`
        + `  ${args.map(a => JSON.stringify(a)).join(',\n  ')},\n`
        + ');\n';
    }
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
