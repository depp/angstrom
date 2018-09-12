precision lowp float;

varying vec3 Pos;
varying vec4 TexPos;
varying mat3 NormalSpace;

uniform sampler2D Texture;
uniform vec3 LightPos[4];
uniform vec3 LightColor[4];

vec4 voronoi(in vec2 v) {
    vec2 tile = floor(v), center;
    v -= tile;
    vec3 d1 = vec3(1.0), d2 = d1, n;
    float dist;
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            center = vec2(x, y);
            center += texture2D(Texture, (tile + center) / 128.0).xy - v;
            float dist = dot(center, center);
            if (dist < d1.z) {
                d2 = d1;
                d1 = vec3(center, dist);
            } else if (dist < d2.z) {
                d2 = vec3(center, dist);
            }
        }
    }
    dist = sqrt(d2.z - d1.z);
    if (dist < 0.5) {
        n = normalize(vec3(normalize(d2.xy - d1.xy), 6.0));
    } else {
        n = vec3(0.0, 0.0, 1.0);
    }
    return vec4(n, dist);
}

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
    gl_FragColor =
        vec4((1.0 - 1.0 / (lighting + 1.0)) * min(1.0, vor.w * 5.0), 1.0);
}
