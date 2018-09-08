// @generate_source

const shaders = {
  spriteProgram: {
    vname: 'sprite',
    fname: 'sprite',
    attributes: [
      'Pos',
      'TexCoord',
    ],
    uniforms: [
      'Scale',
      'M',
    ],
  },
};

module.exports = async function generate(build) {
  const { DEBUG, loadGLSL } = build;
  let body = '';
  if (DEBUG) {
    body += 'import { defineShaderProgram } from \'/game/cyber/shader\';\n';
  } else {
    body += 'import { compileShaderProgram } from \'/game/cyber/shader\';\n';
  }
  const filename = /^[-_a-zA-Z0-9]+(?:\.[-_a-zA-Z0-9]+)?$/;
  const identifier = /^[_a-zA-Z][_a-zA-Z0-9]*$/;
  const uniformName = /^([_a-zA-Z][_a-zA-Z0-9]*)(\[\])?$/;

  const promises = [];
  for (const [name, shader] of Object.entries(shaders)) {
    const {
      vname, fname, attributes, uniforms,
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
    if (!uniforms) {
      throw Error('Missign uniforms');
    }
    for (const attribute of attributes) {
      if (!attribute.match(identifier)) {
        throw new Error(`Bad attribute name: ${JSON.stringify(name)}`);
      }
    }
    const scalarUniforms = [];
    const arrayUniforms = [];
    for (const uniform of uniforms) {
      const match = uniform.match(uniformName);
      if (!match) {
        throw new Error(`Bad uniform name: ${JSON.stringify(uniformName)}`);
      }
      if (match[2]) {
        arrayUniforms.push(match[1]);
      } else {
        scalarUniforms.push(match[1]);
      }
    }
    const args = [
      ['attributes', attributes.join(' ')],
      ['scalarUniforms', scalarUniforms.join(' ')],
      ['arrayUniforms', arrayUniforms.join(' ')],
    ];
    if (DEBUG) {
      body += `export let ${name};\n`;
      body += 'defineShaderProgram({\n';
      args.push(
        ['fname', fname],
        ['vname', vname],
      );
      for (const [k, v] of args) {
        body += `  ${k}: ${JSON.stringify(v)},\n`;
      }
      body += `  func(prog) { ${name} = prog; },\n`;
      body += '});\n';
    } else {
      const argList = args.map(a => a[1]);
      promises.push(Promise.all([
        loadGLSL(`game/cyber/shader/${vname}.vert.glsl`),
        loadGLSL(`game/cyber/shader/${vname}.frag.glsl`),
      ]).then((srcs) => {
        argList.push(...srcs);
        return `export const ${name} = compileShaderProgram(\n`
          + `  ${argList.map(a => JSON.stringify(a)).join(',\n  ')},\n`
          + ');\n';
      }));
    }
  }
  for (const chunk of await Promise.all(promises)) {
    body += chunk;
  }
  return body;
};
