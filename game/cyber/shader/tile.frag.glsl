precision lowp float;
varying vec2 TexPos;
void main() {
    gl_FragColor = vec4(mod(TexPos, 1.0), 0.0, 1.0);
}
