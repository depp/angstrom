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

/* START.RELEASE _ONLY */

// Compile a shader program.
//
// attributes: number of attributes (must be named A0..AN).
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
      throw new Error('Failed to compile shader.\n'
                      + gl.getShaderInfoLog(shader)
                      + source);
    }
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  for (let i = 0; i < attributes; i++) {
    gl.bindAttribLocation(program, i, `A${i}`);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error('Failed to link shader.\n'
                    + gl.getProgramInfoLog(program));
  }
  const obj = { program };
  const uCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < uCount; i++) {
    const { name } = gl.getActiveUniform(program, i);
    obj[name.split('[')[0]] = gl.getUniformLocation(program, name);
  }
  return obj;
}

/* END.RELEASE _ONLY */

// =============================================================================
// Debug build
// =============================================================================

/* START.DEBUG_ONLY */

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

function expandIncludes(sources, src) {
  const include = /^\s*#\s*include\s+"(.*)"\s*/mg;
  let match;
  let body = '';
  let success = true;
  let pos = 0;
  /* eslint-disable no-cond-assign */
  while ((match = include.exec(src))) {
    /* eslint-enable no-cond-assign */
    body += src.substring(pos, match.index);
    pos = include.lastIndex;
    const iname = match[1];
    const isrc = shaderSource[iname];
    sources.push(iname);
    if (isrc == null) {
      success = false;
    } else {
      body += isrc;
      if (body != '' && !body.endsWith('\n')) {
        body += '\n';
      }
    }
  }
  body += src.substring(pos);
  return success ? body : null;
}

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
    this.sources = [];
  }

  compile() {
    let vSource = shaderSource[this.vname];
    let fSource = shaderSource[this.fname];
    if (vSource == null || fSource == null) {
      return;
    }
    const sources = [];
    vSource = expandIncludes(sources, vSource);
    fSource = expandIncludes(sources, fSource);
    for (const name of this.sources) {
      const list = shaderDefs[name];
      const idx = list.indexOf(this);
      if (idx == -1) {
        console.error('Missing dependency');
      } else {
        list.splice(idx, 1);
      }
    }
    for (const name of sources) {
      let list = shaderDefs[name];
      if (!list) {
        list = [];
        shaderDefs[name] = list;
      }
      list.push(this);
    }
    this.sources = sources;
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
    const uniforms = {};
    const uCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < uCount; i++) {
      const { name } = gl.getActiveUniform(program, i);
      uniforms[name.split('[')[0]] = gl.getUniformLocation(program, name);
    }
    const { func } = this;
    func({
      program,
      uniforms: new Proxy(uniforms, handler),
    });
    if (this.program) {
      gl.deleteProgram(this.program);
    }
    this.program = program;
    console.log(`Reloaded shader ${this.vname} ${this.fname} `
                + `${this.sources.join(' ')}`);
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
  if (!name.endsWith('.glsl')) {
    console.warn(`Unknown shader type ${JSON.stringify(name)}`);
    return;
  }
  if (data == null) {
    delete shaderSource[name];
    return;
  }
  shaderSource[name] = data;
  const defs = shaderDefs[name];
  if (defs) {
    for (const def of defs) {
      def.compile();
    }
  }
}

/* END.DEBUG_ONLY */
