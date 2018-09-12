precision lowp float;

varying vec3 Direction;

uniform vec4 LightPos[8];
uniform vec4 LightColor[8];
const mat3 NormalSpace = mat3(1.0);
const vec3 Pos = vec3(0.0);

void main() {
    vec3 lighting, light, normal = normalize(Direction);
    for (int i = 0; i < 8; i++) {
        light = normalize(LightPos[i].xyz - LightPos[i].w * Pos);
        float d = mix(dot(normal, light), 1.0, LightColor[i].a);
        if (d > 0.0) {
            lighting += d * LightColor[i].rgb;
        }
    }
    gl_FragColor = vec4(1.0 - 1.0 / (lighting + 1.0), 1.0);
    // gl_FragColor = vec4(Direction * 0.5 + 0.5, 1.0);
}
