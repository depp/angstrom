precision mediump float;
attribute vec3 Pos;
attribute vec2 TexCoord;
varying vec2 TexPos;
uniform mat4 M;
void main() {
    TexPos = TexCoord;
    gl_Position = M * vec4(Pos, 1.0);
}
