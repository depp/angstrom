attribute vec3 aPos;
attribute vec2 aTexPos;
attribute vec4 aColor;

varying vec2 TexPos;
varying vec4 BlendColor;

uniform mat4 ModelViewProjection;

void main() {
    TexPos = aTexPos;
    BlendColor = aColor;
    gl_Position = ModelViewProjection * vec4(aPos, 1.0);
}
