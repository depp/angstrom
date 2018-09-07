precision mediump float;
varying vec2 TexPos;
uniform sampler2D Texture;
void main() {
    gl_FragColor = texture2D(Texture, TexPos);
}
