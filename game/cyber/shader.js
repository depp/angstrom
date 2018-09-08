import { gl } from '/game/cyber/global';

class ShaderError extends Error {}

// Compile a shader program.
//
// attributes: string, space-separated list of attribute names.
// scalarUniforms: string, space-separated list of scalar uniform names.
// arrayUniforms: string, space-separated list of array uniform names.
// vSource: string, vertex shader source code.
// fSource: string, fragment shader source code.
export function compileShaderProgram(
  attributes, scalarUniforms, arrayUniforms, vSource, fSource,
) {
  const program = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vSource], [gl.FRAGMENT_SHADER, fSource],
  ]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      if (DEBUG) {
        throw new ShaderError(
          'Failed to compile shader:\n' + gl.getShaderInfoLog(shader),
        );
      }
      return null;
    }
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  const attribs = attributes.split(' ');
  for (let i = 0; i < attribs.length; i++) {
    gl.bindAttribLocation(program, i, attribs[i]);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    if (DEBUG) {
      throw new ShaderError(
        'Failed to link program:\n' + gl.getProgramInfoLog(program),
      );
    }
    return null;
  }
  const obj = { program };
  for (const uniform of scalarUniforms.split(' ')) {
    obj[uniform] = gl.getUniformLocation(program, uniform);
  }
  for (const uniform of arrayUniforms.split(' ')) {
    obj[uniform] = gl.getUniformLocation(program, uniform + '[0]');
  }
  return obj;
}

// Map from filename to shader source.
const shaderSource = {};

// Map from filename to list of program compilers.
const shaderPrograms = {};

// Shader program definition so the program can be recompiled as the source
// changes.
class ShaderProgram {
  // Define a new shader program.
  constructor(options) {
    const {
      attributes,
      scalarUniforms,
      arrayUniforms,
      vname,
      fname,
      func,
    } = options;
    this.attributes = attributes;
    this.scalarUniforms = scalarUniforms;
    this.arrayUniforms = arrayUniforms;
    this.vname = `${vname}.vert.glsl`;
    this.fname = `${fname}.frag.glsl`;
    this.func = func;
  }

  compile() {
    const vsource = shaderSource[this.vname];
    const fsource = shaderSource[this.fname];
    if (vsource == null || fsource == null) {
      return;
    }
    let prog;
    try {
      prog = compileShaderProgram(
        this.attributes,
        this.scalarUniforms,
        this.arrayUniforms,
        vsource,
        fsource,
      );
    } catch (e) {
      if (e instanceof ShaderError) {
        console.error(e);
        return;
      }
      throw e;
    }
    const { func } = this;
    func(prog);
  }
}

// Define a shader program to be compiled when the sources are available.
//
// options.attributes: space-delimited attributes.
// options.scalarUniforms: space-separated scalar uniforms (optional).
// options.arrayUniforms: space-separated array uniforms (optional).
// options.vname: name of vertex shader source, without .vert.glsl.
// options.fname: name of fragment shader source, without .frag.glsl.
// options.func: callback for successful compilation, takes program as argument.
export function defineShaderProgram(options) {
  const program = new ShaderProgram(options);
  for (const name of [program.vname, program.fname]) {
    let programs = shaderPrograms[name];
    if (!programs) {
      programs = [];
      shaderPrograms[name] = programs;
    }
    programs.push(program);
  }
}

// Callback for when shader source code is loaded.
export function loadedShaderSource(name, data) {
  if (!name.endsWith('.vert.glsl') && !name.endsWith('.frag.glsl')) {
    console.warn(`Unknown shader type ${JSON.stringify(name)}`);
    return;
  }
  if (data == null) {
    delete shaderSource[name];
    return;
  }
  shaderSource[name] = data;
  const programs = shaderPrograms[name];
  if (!programs) {
    console.warn(`Unused shader source ${JSON.stringify(name)}`);
    return;
  }
  for (const program of programs) {
    program.compile();
  }
}
