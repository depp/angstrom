attribute vec3 Pos;
attribute vec2 TexCoord;
attribute vec4 Color;

varying vec2 TexPos;
varying vec4 BlendColor;

uniform mat4 ModelViewProjection;

void main() {
    TexPos = TexCoord;
    BlendColor = Color;
    gl_Position = ModelViewProjection * vec4(Pos, 1.0);
}
