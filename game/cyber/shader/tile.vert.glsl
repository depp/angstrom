attribute vec3 Pos;
uniform mat4 M;
varying vec2 TexPos;
void main() {
    TexPos = Pos.xy;
    gl_Position = M * vec4(Pos, 1.0);
}
