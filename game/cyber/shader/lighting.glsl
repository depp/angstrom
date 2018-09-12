// Apply lighting calculations.

// vec4 LightPos[8];
//     xyz is position
//     w 0=directional source, 1=point source
// vec4 LightColor[8];
//     rgb is color
//     a 0=full, shadow 1=flat

vec3 light(vec3 normal) {
    vec3 lighting, light;
    normal = normalize(NormalSpace * normal);
    for (int i = 0; i < 8; i++) {
        light = normalize(LightPos[i].xyz - LightPos[i].w * Pos);
        float d = mix(dot(normal, light), 1.0, LightColor[i].a);
        if (d > 0.0) {
            lighting += d / dot(light, light) * LightColor[i].rgb;
        }
    }
    return 1.0 - 1.0 / (lighting + 1.0);
}
