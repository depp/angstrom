import { gl } from '/game/cyber/global';

// Compile a shader program.
export function compileShaderProgram(attributes, uniforms, auniforms, vertex, fragment) {
  const program = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    // TODO: remove in release??
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error('Failed to compile shader:\n' + gl.getShaderInfoLog(shader));
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
    // TODO: remove in release??
    throw new Error('Failed to link program:\n' + gl.getProgramInfoLog(program));
  }
  const obj = { program };
  for (const uniform of uniforms.split(' ')) {
    obj[uniform] = gl.getUniformLocation(program, uniform);
  }
  for (const uniform of auniforms.split(' ')) {
    obj[uniform] = gl.getUniformLocation(program, uniform + '[0]');
  }
  return obj;
}
