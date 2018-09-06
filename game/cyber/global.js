// Canvas element.
export const canvas = document.getElementById('g');
// WebGL rendering context.
export const gl = canvas.getContext('webgl', { alpha: false });
gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
