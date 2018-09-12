attribute vec2 aPos;

varying vec2 TexPos;

void main() {
    TexPos = aPos * 0.5 + 0.4;
    gl_Position = vec4(aPos, 0.99, 1.0);
}
