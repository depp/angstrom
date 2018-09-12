precision lowp float;

varying vec3 Direction;

uniform vec4 LightPos[8];
uniform vec4 LightColor[8];
const mat3 NormalSpace = mat3(1.0);
const vec3 Pos = vec3(0.0);

#include "lighting.glsl"

void main() {
    gl_FragColor = vec4(light(Direction), 1.0);
    // gl_FragColor = vec4(Direction * 0.5 + 0.5, 1.0);
}
