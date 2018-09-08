// Code for loading shader programs.
//
// This module is only imported by main.js (to load shader source code
// dynamically) and by shaders.js (to define shader programs). There is code for
// both the debug and release build here, and rollup will only include the
// correct version.

import { gl } from '/game/cyber/global';

// =============================================================================
// Release build
// =============================================================================

// Compile a shader program.
//
// attributes: string, space-separated list of attribute names.
// vSource: string, vertex shader source code.
// fSource: string, fragment shader source code.
export function compileShaderProgram(
  attributes, vSource, fSource,
) {
  const program = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vSource], [gl.FRAGMENT_SHADER, fSource],
  ]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
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
    return null;
  }
  const obj = { program };
  const uCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < uCount; i++) {
    const { name } = gl.getActiveUniform(program, i);
    obj[name] = gl.getUniformLocation(program, name);
  }
  return obj;
}

// =============================================================================
// Debug build
// =============================================================================

// Map from filename to shader source.
const shaderSource = {};

// Map from filename to list of program compilers.
const shaderDefs = {};

const handler = {
  get(obj, prop) {
    if (prop in obj) {
      return obj[prop];
    }
    console.warn(`Uniform does not exist: ${JSON.stringify(prop)}`);
    obj[prop] = null;
    return null;
  },
};

// Shader program definition so the program can be recompiled as the source
// changes.
class ShaderProgramDefinition {
  // Define a new shader program.
  constructor(options) {
    const {
      attributes,
      vname,
      fname,
      func,
    } = options;
    this.attributes = attributes;
    this.vname = `${vname}.vert.glsl`;
    this.fname = `${fname}.frag.glsl`;
    this.func = func;
    this.program = null;
  }

  compile() {
    const vSource = shaderSource[this.vname];
    const fSource = shaderSource[this.fname];
    if (vSource == null || fSource == null) {
      return;
    }
    const program = gl.createProgram();
    for (const [type, source] of [
      [gl.VERTEX_SHADER, vSource], [gl.FRAGMENT_SHADER, fSource],
    ]) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(
          'Failed to compile shader:\n' + gl.getShaderInfoLog(shader),
        );
        return;
      }
      gl.attachShader(program, shader);
      gl.deleteShader(shader);
    }
    const attributes = {};
    for (let i = 0; i < this.attributes.length; i++) {
      const name = this.attributes[i];
      attributes[name] = false;
      gl.bindAttribLocation(program, i, name);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(
        'Failed to link program:\n' + gl.getProgramInfoLog(program),
      );
      return;
    }
    const aCount = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < aCount; i++) {
      const { name } = gl.getActiveAttrib(program, i);
      if (!(name in attributes)) {
        console.warn(`Unexpected attribute: ${JSON.stringify(name)}`);
      } else {
        attributes[name] = true;
      }
    }
    for (const [name, flag] of Object.entries(attributes)) {
      if (!flag) {
        console.warn(`Missing attribute: ${JSON.stringify(name)}`);
      }
    }
    const obj = { program };
    const uCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < uCount; i++) {
      const { name } = gl.getActiveUniform(program, i);
      obj[name] = gl.getUniformLocation(program, name);
    }
    const { func } = this;
    func(new Proxy(obj, handler));
    if (this.program) {
      gl.deleteProgram(this.program);
    }
    this.program = program;
  }
}

// Define a shader program to be compiled when the sources are available.
//
// options.attributes: list of attributes.
// options.vname: name of vertex shader source, without .vert.glsl.
// options.fname: name of fragment shader source, without .frag.glsl.
// options.func: callback for successful compilation, takes program as argument.
export function defineShaderProgram(options) {
  const def = new ShaderProgramDefinition(options);
  for (const name of [def.vname, def.fname]) {
    let defs = shaderDefs[name];
    if (!defs) {
      defs = [];
      shaderDefs[name] = defs;
    }
    defs.push(def);
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
  const defs = shaderDefs[name];
  if (!defs) {
    console.warn(`Unused shader source ${JSON.stringify(name)}`);
    return;
  }
  for (const def of defs) {
    def.compile();
  }
}
