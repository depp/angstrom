attribute vec3 Pos;

uniform mat4 ModelViewProjection;

varying vec3 TexPos;

void main() {
    TexPos = Pos;
    gl_Position = ModelViewProjection * vec4(Pos, 1.0);
}
