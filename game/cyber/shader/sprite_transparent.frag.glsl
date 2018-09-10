precision lowp float;

varying vec2 TexPos;
varying vec4 BlendColor;

uniform sampler2D Texture;

void main() {
    float a = texture2D(Texture, TexPos).a;
    a *= a;
    gl_FragColor = mix(a * BlendColor, vec4(1.0), a * a * a);
}
