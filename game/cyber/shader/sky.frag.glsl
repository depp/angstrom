precision lowp float;

varying vec3 Direction;

void main() {
    gl_FragColor = vec4(Direction * 0.5 + 0.5, 1.0);
}
