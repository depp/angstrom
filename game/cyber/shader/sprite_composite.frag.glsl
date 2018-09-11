precision lowp float;

varying vec2 TexPos;
varying vec4 BlendColor;

uniform sampler2D Texture;

void main() {
    gl_FragColor = BlendColor * texture2D(Texture, TexPos);
}
