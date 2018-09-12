attribute vec3 aPos;
attribute vec4 aTexPos;
attribute mat3 aNormalSpace;

uniform mat4 ModelViewProjection;

varying vec3 Pos;
varying vec4 TexPos;
varying mat3 NormalSpace;

void main() {
    Pos = aPos;
    TexPos = aTexPos;
    NormalSpace = aNormalSpace;
    gl_Position = ModelViewProjection * vec4(Pos, 1.0);
}
