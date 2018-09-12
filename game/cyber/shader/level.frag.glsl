precision lowp float;

varying vec3 Pos;
varying vec4 TexPos;
varying mat3 NormalSpace;

uniform sampler2D Texture;
uniform vec3 LightPos[4];
uniform vec3 LightColor[4];

#include "voronoi.glsl"

void main() {
    vec4 vor = voronoi(TexPos.xy * 2.0);
    vec3 lighting, light, norm = normalize(NormalSpace * vor.xyz);
    for (int i = 0; i < 4; i++) {
        light = LightPos[i] - Pos;
        float d = dot(norm, light);
        if (d > 0.0) {
            lighting += d / dot(light, light) * LightColor[i];
        }
    }
    gl_FragColor = vec4((1.0 - 1.0 / (lighting + 1.0)) * min(1.0, vor.w * 1.0) *
                            min(1.0, TexPos.z * 10.0),
                        1.0);
}
