precision lowp float;

varying vec2 TexPos;
varying vec4 BlendColor;

uniform sampler2D Texture;

void main() {
    vec4 t = texture2D(Texture, TexPos);
    gl_FragColor = vec4(
        mix(BlendColor.rgb * dot(t.rgb, vec3(0.3)), t.rgb, BlendColor.a), t.a);
    if (t.a < 0.5) {
        discard;
    }
}
