precision lowp float;

varying vec2 TexPos;
varying vec4 BlendColor;

uniform sampler2D Texture;

void main() {
    gl_FragColor = texture2D(Texture, TexPos) * BlendColor;
    if (gl_FragColor.a < 0.5) {
        discard;
    }
}
