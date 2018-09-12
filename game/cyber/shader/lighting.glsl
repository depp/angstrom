// Apply lighting calculations.

vec3 light(vec3 normal) {
    vec3 lighting, light;
    normal = normalize(NormalSpace * normal);
    for (int i = 0; i < 4; i++) {
        light = LightPos[i] - Pos;
        float d = dot(normal, light);
        if (d > 0.0) {
            lighting += d / dot(light, light) * LightColor[i];
        }
    }
    return 1.0 - 1.0 / (lighting + 1.0);
}
