attribute vec2 aPos;

varying vec3 Direction;

uniform mat4 InverseCameraMatrix;

void main() {
    vec4 p = InverseCameraMatrix * vec4(aPos, 0.0, 1.0);
    Direction = p.xyz;
    gl_Position = vec4(aPos, 0.99, 1.0);
}
